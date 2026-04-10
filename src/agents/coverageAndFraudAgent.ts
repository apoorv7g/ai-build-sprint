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

  const systemPrompt = `You are a highly experienced insurance fraud investigator and coverage specialist. Scrutinize EVERY red flag.

COVERAGE VALIDATION (strict):
- Comprehensive: covers collision, theft, fire, flood, vandalism, weather damage
- Third-Party: covers ONLY third-party liability, NOT own damage
- Return coverageValid=false if policy doesn't cover the incident type

CRITICAL FRAUD DETECTION - Investigate each factor:
1. CLAIM HISTORY ANALYSIS:
   - 5+ past claims = extremely high risk (red flag)
   - 3-4 past claims = high risk for new typology
   - 1-2 past claims = monitor if unusual pattern
   
2. AMOUNT SUSPICION:
   - Minor damage + amount >50k = major red flag
   - Moderate damage + amount >100k = major red flag
   - Major damage + amount <20k = might be underreported

3. DOCUMENTATION GAPS:
   - Missing = immediate manual review flag
   - Complete but vague = investigate further

4. PATTERN MATCHING:
   - Identical claim types in history = fraud indicator
   - Different types = legitimate customer
   - Timing between claims (if rapid) = red flag

5. CONSISTENCY CHECK:
   - Description matches severity? (yes = +score, no = -score)
   - Incident type matches damage? (yes = +score, no = major red flag)

FRAUD SCORING (0-10 scale):
- 0-2 = None (approve)
- 3-5 = Low (approve with notes)
- 6-7 = Medium (pending - needs review)
- 8-10 = High (reject or escalate)

Return ONLY valid JSON with keys: coverageValid, coverageReason, documentIssue, fraudRisk, fraudFlags (array of specific flags), fraudScore (0-10), recommendation (approve|review|reject), reasoning`;

  const userPrompt = `Claim ID: ${claimId}
Policy Type: ${policyType}
Incident Type: ${incidentType}
Initial Damage Severity: ${initialDamageSeverity}
Claim Amount: ₹${claimAmount}
Past Claims Count: ${pastClaims}
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
