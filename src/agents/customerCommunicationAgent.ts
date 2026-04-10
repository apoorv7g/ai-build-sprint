import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { CustomerCommunicationOutput } from "@/types";

interface CustomerCommunicationInput {
  userId: string;
  claimId: string;
  status: string;
  estimatedPayout: number;
  reason: string;
  fraudFlags: string[];
  coverageReason: string;
  damageType: string;
  documentIssue: string;
  groqClient: Groq;
  keySlot: number;
}

export async function customerCommunicationAgent(
  input: CustomerCommunicationInput
): Promise<CustomerCommunicationOutput> {
  const start = Date.now();
  const { userId, claimId, status, estimatedPayout, reason, fraudFlags, coverageReason, damageType, documentIssue, groqClient, keySlot } = input;

  const systemPrompt = `You are an expert insurance customer communications specialist. Write clear, professional communications.

COMMUNICATION PROTOCOL FOR EACH STATUS:

APPROVED:
- Congratulate customer on approval
- State exact payout amount in ₹
- Mention 5-7 business day processing timeline
- Explain what happens next (bank transfer details)
- Professional, positive tone

REJECTED:
- Start with acknowledgment of their claim
- State the decision clearly but compassionately
- Provide ONE clear reason (coverage doesn't apply OR fraud detected)
- If fraud: Do NOT accuse, say "inconsistencies detected that require investigation"
- Offer appeal process with timeframe
- Provide contact info for clarification

PENDING:
- Thank them for submission
- List EXACTLY what's missing or needed
- Provide deadline (10 days)
- Show them what each document should contain
- Explain what happens when submission is complete
- Provide support contact information

TONE RULES:
- Always professional and empathetic
- No jargon - explain in simple terms
- Be transparent about amounts and timelines
- Never sound accusatory or dismissive

Return ONLY valid JSON with keys: subject (email subject line), customerMessage (full letter text - 150-250 words)`;

  const userPrompt = `Claim ID: ${claimId}
Decision Status: ${status}
Estimated Payout Amount: ₹${estimatedPayout}
Damage Type: ${damageType}
Coverage Analysis: ${coverageReason}
Missing Documentation: ${documentIssue}
Fraud Risk Flags: ${fraudFlags.length > 0 ? fraudFlags.join(", ") : "None"}
Overall Reason: ${reason}`;

  try {
    const response = await groqCall(() =>
      groqClient.chat.completions.create({
        model: MODELS.text,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      })
    );

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content) as CustomerCommunicationOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    await db.insert(agent_logs).values({
      user_id: userId,
      claim_id: claimId,
      step_number: 6,
      agent_name: "CustomerCommunicationAgent",
      status: "completed",
      input_summary: `Status: ${status}, Payout: ₹${estimatedPayout}`,
      output_summary: `Subject: ${result.subject?.slice(0, 80)}`,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      model_used: MODELS.text,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    await db.insert(agent_logs).values({
      user_id: userId,
      claim_id: claimId,
      step_number: 6,
      agent_name: "CustomerCommunicationAgent",
      status: "failed",
      input_summary: `Status: ${status}`,
      output_summary: `Error: ${String(err).slice(0, 200)}`,
      tokens_used: 0,
      latency_ms: latencyMs,
      model_used: MODELS.text,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return {
      subject: `Your Insurance Claim ${claimId} — ${status}`,
      customerMessage: `Dear Policyholder,\n\nRegarding your claim ${claimId}, the status is: ${status}.\n\nPayout: ₹${estimatedPayout}\n\nReason: ${reason}\n\nPlease contact us at claims@insureco.in or 1800-XXX-XXXX for further assistance.\n\nWarm regards,\nInsureCo Claims Team`,
    };
  }
}
