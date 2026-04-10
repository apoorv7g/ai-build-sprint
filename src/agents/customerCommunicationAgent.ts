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

  const systemPrompt = `You are a professional, empathetic insurance customer communications specialist. Write a warm, professional customer letter.

LETTER REQUIREMENTS:
- Start with a greeting mentioning the claim ID
- Clearly state the decision (Approved/Rejected/Pending)
- If APPROVED: Show the payout amount in ₹ and mention 5-7 business day timeline
- If REJECTED: Give the reason clearly but WITHOUT accusatory language
- If PENDING: List exactly what documents/information to submit with a 10-day deadline
- End with professional closing and placeholder contact info [claims@insureco.in / 1800-XXX-XXXX]

Return ONLY valid JSON with keys: subject (email subject line), customerMessage (full letter text)`;

  const userPrompt = `Claim ID: ${claimId}
Status: ${status}
Estimated Payout: ₹${estimatedPayout}
Damage Type: ${damageType}
Coverage Reason: ${coverageReason}
Document Issue: ${documentIssue}
Fraud Flags: ${fraudFlags.length > 0 ? fraudFlags.join(", ") : "None"}
Summary Reason: ${reason}`;

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
