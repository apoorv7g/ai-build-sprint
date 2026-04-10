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

  const systemPrompt = `You are an expert insurance claim analyst. Analyze the insurance claim and identify:
- incidentType: the type of incident (e.g., collision, theft, fire, flood, vandalism)
- affectedComponent: the main vehicle component affected
- initialDamageSeverity: exactly "Minor", "Moderate", or "Major"
- linguisticFlags: array of flags like "vague", "short", "contradictory" if applicable
- summaryForDownstreamAgents: a clear concise summary for other agents
- reasoning: your reasoning for these determinations

Return ONLY valid JSON with these exact keys.`;

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
