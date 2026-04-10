import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { PayoutEstimationOutput } from "@/types";

interface PayoutEstimationInput {
  userId: string;
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
  const { userId, claimId, claimAmount, finalDamageType, fraudRisk, coverageValid, documentsStatus, groqClient, keySlot } = input;

  const systemPrompt = `You are an insurance payout calculation expert. Apply STRICT rules with zero discretion.

PAYOUT CALCULATION RULES (apply in exact order):

STEP 1: IMMEDIATE REJECTION (payoutPercentage = 0):
- If coverageValid = false → Reject "Coverage doesn't apply"
- If fraudRisk = "High" → Reject "Fraud detected"

STEP 2: PENDING REVIEW (assign status = "Pending"):
- If fraudRisk = "Medium" → Use LOWER end of range only
- If documentsStatus = "Missing" → Flag "Requires documentation"
- If claimAmount > 500000 → Flag "Manual review for large claim"

STEP 3: CALCULATE PAYOUT RANGE:
- Minor damage: 70-90% of claim amount
- Moderate damage: 50-70% of claim amount
- Major damage: 30-50% of claim amount

STEP 4: SELECT PERCENTAGE (for Approved claims):
- Use UPPER range if damage well-documented and no fraud indicators
- Use MIDDLE range for standard claims
- Use LOWER range if any documentation concerns

STEP 5: APPLY DEDUCTIBLE (always ₹3000):
- Gross Payout = (percentage/100) × claimAmount
- Deductible = 3000 (fixed)
- Net Payout = max(0, Gross - 3000)

STATUS ASSIGNMENT:
- "Rejected" if fraud high or coverage invalid or net payout would be zero
- "Pending" if fraud medium, docs missing, or amount >500k
- "Approved" if all checks passed and fraudRisk is "None" or "Low"

Return ONLY valid JSON with keys: status (Approved|Rejected|Pending), payoutPercentage (0-100), grossPayout, deductibleApplied (3000), estimatedPayout, flags (array of notes), justification, reasoning`;

  const userPrompt = `Claim ID: ${claimId}
Claim Amount: ₹${claimAmount}
Final Damage Type: ${finalDamageType}
Fraud Risk Level: ${fraudRisk}
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
      user_id: userId,
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
      user_id: userId,
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
