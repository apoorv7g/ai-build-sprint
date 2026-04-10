import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chat_messages, chat_threads, claims, claim_results } from "@/db/schema";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { getGroqClient, MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    const thread = await db
      .select()
      .from(chat_threads)
      .where(and(eq(chat_threads.thread_id, threadId), eq(chat_threads.user_id, user.id)))
      .limit(1);

    if (!thread.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const messages = await db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.thread_id, threadId))
      .orderBy(asc(chat_messages.created_at));

    return NextResponse.json({ thread: thread[0], messages });
  } catch (err) {
    console.error("GET /api/chat/threads/[threadId]/messages error:", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;
    const body = await request.json();
    const message = String(body?.message ?? "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const thread = await db
      .select()
      .from(chat_threads)
      .where(and(eq(chat_threads.thread_id, threadId), eq(chat_threads.user_id, user.id)))
      .limit(1);

    if (!thread.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await db.insert(chat_messages).values({
      thread_id: threadId,
      sender: "user",
      message,
      metadata: { username: user.username },
    });

    const recent = await db
      .select({ sender: chat_messages.sender, message: chat_messages.message })
      .from(chat_messages)
      .where(eq(chat_messages.thread_id, threadId))
      .orderBy(desc(chat_messages.created_at))
      .limit(12);

    const contextMessages = recent.reverse().map((msg) => ({
      role: msg.sender === "assistant" ? "assistant" : "user",
      content: msg.message,
    })) as Array<{ role: "assistant" | "user"; content: string }>;

    // Fetch claim context if thread is linked to a claim
    let claimContext = "";
    if (thread[0].claim_id) {
      try {
        const claimRecord = await db
          .select()
          .from(claims)
          .where(and(eq(claims.claim_id, thread[0].claim_id), eq(claims.user_id, user.id)))
          .limit(1);

        const claimResultRecord = await db
          .select()
          .from(claim_results)
          .where(and(eq(claim_results.claim_id, thread[0].claim_id), eq(claim_results.user_id, user.id)))
          .orderBy(desc(claim_results.created_at))
          .limit(1);

        if (claimRecord[0]) {
          const claim = claimRecord[0];
          const result = claimResultRecord[0];
          
          // Calculate inferences from database data
          let riskAssessment = "";
          if (claim.past_claims > 3) {
            riskAssessment = "High claim history - flags for potential pattern";
          } else if (claim.past_claims > 0) {
            riskAssessment = "Moderate claim history";
          } else {
            riskAssessment = "First-time claimant - lower risk profile";
          }
          
          let documentAssessment = "";
          if (claim.documents_status === "Missing") {
            documentAssessment = " - May require follow-up documentation";
          } else {
            documentAssessment = " - Documentation verified";
          }
          
          let payoutAnalysis = "";
          if (result) {
            const reductionAmount = claim.claim_amount - result.estimated_payout;
            payoutAnalysis = `\n  Payout Analysis: ₹${claim.claim_amount} claimed → ₹${result.estimated_payout} approved (${result.payout_percentage}% coverage)`;
            if (reductionAmount > 0) {
              payoutAnalysis += `\n  Reduction of ₹${reductionAmount} due to: damage severity (${result.damage_type}), policy limits, deductibles`;
            }
          }
          
          claimContext = `\n\n---CLAIM CONTEXT---\nClaim ID: ${claim.claim_id}\nPolicy Type: ${claim.policy_type}\nClaim Amount: ₹${claim.claim_amount}\nPast Claims: ${claim.past_claims} (${riskAssessment})\nDocuments Status: ${claim.documents_status}${documentAssessment}\nDescription: ${claim.description}`;

          if (result) {
            claimContext += `\n\nAnalysis Results:\n  Status: ${result.status}\n  Estimated Payout: ₹${result.estimated_payout}\n  Confidence Score: ${result.confidence_score}%\n  Damage Type: ${result.damage_type}\n  Coverage Valid: ${result.coverage_valid ? "Yes" : "No"}\n  Reason: ${result.reason}`;
            if (result.fraud_flags && Object.keys(result.fraud_flags).length > 0) {
              claimContext += `\n  Fraud Flags: ${JSON.stringify(result.fraud_flags)}`;
            }
            claimContext += payoutAnalysis;
          }
        }
      } catch {
        // Silently fail - continue without claim context
      }
    }

    const aiText = await groqCall(async () => {
      const response = await getGroqClient().chat.completions.create({
        model: MODELS.text,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are Cache Memory Assistant, an expert insurance specialist. Help users understand claim processing, payout decisions, and next steps.\n\n" +
              "RESPONSE FORMAT (Plain Text Only):\n" +
              "- Be clear and direct without markdown headers (### etc.)\n" +
              "- Use **bold** only for key terms and important numbers\n" +
              "- Use bullet points with - for lists when needed\n" +
              "- Include specific claim data (amounts in ₹, percentages, dates)\n" +
              "- Write in conversational, professional tone\n" +
              "- Always cite claim-specific data from context\n" +
              "- Maximize inferences: explain policy impact, damage implications, next steps based on available data\n" +
              "- NO markdown tables or ### section headers\n" +
              "- NO dollar signs ($), use ₹ only for currency\n\n" +
              "- REMEMBER deductible IS ALWAYS 3000\n\n" +
              " ₹3000 is the deductible amount for all claims. not 500 Always factor this into payout explanations and next steps guidance.\n\n" +
              "- ALSO NO MATH SYMBOLS , OR ANY MATH MARKDOWN OR HIGHTHNG , DO IT WITHOUT IT and no ### AT ALL.\n "+
              "Your expertise: Connect claim data to policy rules, explain decision rationale, provide actionable guidance." +
              claimContext,
          },
          ...contextMessages,
        ],
      });
      return response.choices[0]?.message?.content?.trim() || "I could not generate a response. Please try again.";
    });

    await db.insert(chat_messages).values({
      thread_id: threadId,
      sender: "assistant",
      message: aiText,
    });

    const messages = await db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.thread_id, threadId))
      .orderBy(asc(chat_messages.created_at));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("POST /api/chat/threads/[threadId]/messages error:", err);
    const errorMsg = err instanceof Error ? err.message : "Failed to send message";
    // Use claim-specific error message if applicable
    const userMessage = errorMsg.includes("claim") ? "claim id has to be unique" : "Failed to send message";
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
