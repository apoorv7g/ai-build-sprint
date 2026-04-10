import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { CoverageAndFraudOutput } from "@/types";

interface CoverageAndFraudInput {
  userId: string;
  claimId: string;
  policyType: string;
  incidentType: string;
  documentsStatus: string;
  claimAmount: number;
  pastClaims: number;
  description: string;
  initialDamageSeverity: string;
  groqClient: Groq;
  keySlot: number;
}

export async function coverageAndFraudAgent(
  input: CoverageAndFraudInput
): Promise<CoverageAndFraudOutput> {
  const start = Date.now();
  const { userId, claimId, policyType, incidentType, documentsStatus, claimAmount, pastClaims, description, initialDamageSeverity, groqClient, keySlot } = input;

  const systemPrompt = `You are a dual-purpose insurance analyst handling both coverage validation and fraud detection.

COVERAGE RULES:
- Comprehensive policy covers own damage (collision, theft, fire, flood, vandalism)
- Third-Party policy does NOT cover own damage under any circumstances
- Return coverageValid: true only if the policy type covers the incident type

FRAUD DETECTION — score each indicator:
- pastClaims > 3 = strong fraud indicator
- pastClaims 1-3 = moderate fraud indicator
- claimAmount > 50000 for Minor damage = suspicious
- claimAmount > 100000 for Moderate damage = suspicious
- documentsStatus "Missing" = significant flag
- description under 20 words or vague = linguistic flag
- incident inconsistent with damage component = red flag

Assign fraudRisk: exactly one of "None", "Low", "Medium", "High"
Set fraudScore as a number 0-10 (0=no fraud, 10=definite fraud)
recommendation: "approve", "review", or "reject"

Return ONLY valid JSON with keys: coverageValid, coverageReason, documentIssue, fraudRisk, fraudFlags (array), fraudScore, recommendation, reasoning`;

  const userPrompt = `Claim ID: ${claimId}
Policy Type: ${policyType}
Incident Type: ${incidentType}
Initial Damage Severity: ${initialDamageSeverity}
Claim Amount: ₹${claimAmount}
Past Claims: ${pastClaims}
Documents Status: ${documentsStatus}
Description: ${description}`;

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
    const result = JSON.parse(content) as CoverageAndFraudOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    await db.insert(agent_logs).values({
      user_id: userId,
      claim_id: claimId,
      step_number: 3,
      agent_name: "CoverageAndFraudAgent",
      status: "completed",
      input_summary: `Policy: ${policyType}, Incident: ${incidentType}, Amount: ₹${claimAmount}`,
      output_summary: `Coverage: ${result.coverageValid}, FraudRisk: ${result.fraudRisk}, Rec: ${result.recommendation}`,
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
      step_number: 3,
      agent_name: "CoverageAndFraudAgent",
      status: "failed",
      input_summary: `Policy: ${policyType}, Incident: ${incidentType}`,
      output_summary: `Error: ${String(err).slice(0, 200)}`,
      tokens_used: 0,
      latency_ms: latencyMs,
      model_used: MODELS.text,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return {
      coverageValid: policyType === "Comprehensive",
      coverageReason: "Fallback: agent failed",
      documentIssue: documentsStatus === "Missing" ? "Missing documents" : "None",
      fraudRisk: "Low",
      fraudFlags: [],
      fraudScore: 1,
      recommendation: "review",
      reasoning: "Agent failed, using fallback values.",
    };
  }
}
