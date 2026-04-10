import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { ClaimAnalysisOutput } from "@/types";

interface ClaimAnalysisInput {
  userId: string;
  claimId: string;
  description: string;
  policyType: string;
  claimAmount: number;
  pastClaims: number;
  documentsStatus: string;
  groqClient: Groq;
  keySlot: number;
}

export async function claimAnalysisAgent(
  input: ClaimAnalysisInput
): Promise<ClaimAnalysisOutput> {
  const start = Date.now();
  const { userId, claimId, description, policyType, claimAmount, pastClaims, documentsStatus, groqClient, keySlot } = input;

  const systemPrompt = `You are an expert insurance claim analyst with 20+ years of experience. Your role is to scrutinize EVERY aspect of the claim submission.

CRITICAL ANALYSIS REQUIREMENTS:
1. LINGUISTIC SCRUTINY: Examine description for vagueness, contradictions, unusual phrasing, or red flags
   - Flag inconsistencies in timeline or facts
   - Note if description is suspiciously brief or overly detailed
   - Identify emotional manipulation attempts

2. INCIDENT CLASSIFICATION: Categorize the incident type ONLY if clear evidence exists
   - Collision, Theft, Fire, Flood, Vandalism, Weather Damage, etc.
   - If unclear, mark as "Unclear - requires investigation"

3. DAMAGE ASSESSMENT: Based on description alone
   - Minor (cosmetic, small repairs <10% of claim amount)
   - Moderate (structural impact, repairs 10-40% of claim amount)
   - Major (severe damage, repairs >40% of claim amount)

4. CLAIM PATTERN ANALYSIS:
   - Compare past claims count with current claim type
   - Flag if pattern seems suspicious
   - Cross-reference policy type validity

5. DOCUMENTATION COMPLETENESS CHECK:
   - Note gaps in evidence
   - Recommend what's needed for verification

Return ONLY valid JSON with these fields:
{
  "incidentType": "string",
  "affectedComponent": "string",
  "initialDamageSeverity": "Minor|Moderate|Major",
  "linguisticFlags": ["array of red flags"],
  "riskAssessment": "Low|Medium|High",
  "summaryForDownstreamAgents": "string",
  "reasoning": "detailed explanation of analysis"
}`;

  const userPrompt = `Claim ID: ${claimId}
Policy Type: ${policyType}
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
    const result = JSON.parse(content) as ClaimAnalysisOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    await db.insert(agent_logs).values({
      user_id: userId,
      claim_id: claimId,
      step_number: 2,
      agent_name: "ClaimAnalysisAgent",
      status: "completed",
      input_summary: `Policy: ${policyType}, Amount: ${claimAmount}, Docs: ${documentsStatus}`,
      output_summary: `Severity: ${result.initialDamageSeverity}, Type: ${result.incidentType}`,
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
      step_number: 2,
      agent_name: "ClaimAnalysisAgent",
      status: "failed",
      input_summary: `Policy: ${policyType}, Amount: ${claimAmount}`,
      output_summary: `Error: ${String(err).slice(0, 200)}`,
      tokens_used: 0,
      latency_ms: latencyMs,
      model_used: MODELS.text,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return {
      incidentType: "Unknown",
      affectedComponent: "Unknown",
      initialDamageSeverity: "Moderate",
      linguisticFlags: [],
      summaryForDownstreamAgents: description,
      reasoning: "Agent failed, using fallback values.",
    };
  }
}
