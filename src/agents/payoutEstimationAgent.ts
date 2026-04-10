import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { PayoutEstimationOutput } from "@/types";

interface PayoutEstimationInput {
  claimId: string;
  claimAmount: number;
  finalDamageType: string;
  fraudRisk: string;
  coverageValid: boolean;
  documentsStatus: string;
  groqClient: Groq;
  keySlot: number;
}

export async function payoutEstimationAgent(
  input: PayoutEstimationInput
): Promise<PayoutEstimationOutput> {
  const start = Date.now();
  const { claimId, claimAmount, finalDamageType, fraudRisk, coverageValid, documentsStatus, groqClient, keySlot } = input;

  const systemPrompt = `You are an insurance payout calculation specialist. Calculate the payout using these exact rules.

PAYOUT RANGES:
- Minor damage: 70-90% of claim amount
- Moderate damage: 50-70% of claim amount
- Major damage: 30-50% of claim amount

OVERRIDE RULES (apply in this exact order):
1. If coverageValid is false → status = "Rejected", payoutPercentage = 0
2. If fraudRisk is "High" → status = "Rejected", payoutPercentage = 0
3. If fraudRisk is "Medium" → use lower bound of range, status = "Pending"
4. If documentsStatus is "Missing" → status = "Pending" regardless of other factors
5. If claimAmount > 500000 → status = "Pending", add manual review flag

DEDUCTIBLE: Always subtract ₹3000 from final payout. Final = (percentage/100 × claimAmount) - 3000, minimum 0.

Otherwise for valid claims: choose the optimal percentage within range based on damage evidence quality, status = "Approved".

Return ONLY valid JSON with keys: status (exactly "Approved", "Rejected", or "Pending"), payoutPercentage, grossPayout, deductibleApplied (always 3000), estimatedPayout, justification (one sentence), reasoning`;

  const userPrompt = `Claim ID: ${claimId}
Claim Amount: ₹${claimAmount}
Final Damage Type: ${finalDamageType}
Fraud Risk: ${fraudRisk}
Coverage Valid: ${coverageValid}
Documents Status: ${documentsStatus}`;

  try {
    const response = await groqCall(() =>
      groqClient.chat.completions.create({
        model: MODELS.text,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      })
    );

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content) as PayoutEstimationOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    // Ensure deductible is always 3000
    result.deductibleApplied = 3000;
    result.estimatedPayout = Math.max(0, result.grossPayout - 3000);

    await db.insert(agent_logs).values({
      claim_id: claimId,
      step_number: 5,
      agent_name: "PayoutEstimationAgent",
      status: "completed",
      input_summary: `Amount: ₹${claimAmount}, Damage: ${finalDamageType}, Fraud: ${fraudRisk}`,
      output_summary: `Status: ${result.status}, Payout: ₹${result.estimatedPayout}, Pct: ${result.payoutPercentage}%`,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      model_used: MODELS.text,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    await db.insert(agent_logs).values({
      claim_id: claimId,
      step_number: 5,
      agent_name: "PayoutEstimationAgent",
      status: "failed",
      input_summary: `Amount: ₹${claimAmount}, Damage: ${finalDamageType}`,
      output_summary: `Error: ${String(err).slice(0, 200)}`,
      tokens_used: 0,
      latency_ms: latencyMs,
      model_used: MODELS.text,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return {
      status: "Pending",
      payoutPercentage: 0,
      grossPayout: 0,
      deductibleApplied: 3000,
      estimatedPayout: 0,
      justification: "Agent failed, claim set to Pending for manual review.",
      reasoning: "Agent failed, using fallback values.",
    };
  }
}
