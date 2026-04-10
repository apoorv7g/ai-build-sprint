import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { extractJson } from "@/lib/extractJson";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { DamageAssessmentOutput } from "@/types";

interface DamageAssessmentInput {
  userId: string;
  claimId: string;
  description: string;
  initialDamageSeverity: string;
  imageBase64?: string;
  imageMediaType?: string;
  groqClient: Groq;
  keySlot: number;
}

export async function damageAssessmentAgent(
  input: DamageAssessmentInput
): Promise<DamageAssessmentOutput & { modelUsed: string }> {
  const start = Date.now();
  const { userId, claimId, description, initialDamageSeverity, imageBase64, imageMediaType, groqClient, keySlot } = input;
  const hasImage = !!(imageBase64 && imageMediaType);
  const modelUsed = hasImage ? MODELS.vision : MODELS.text;

  const systemPrompt = `You are a certified vehicle damage assessor with forensic expertise. Analyze damage with extreme scrutiny.

DAMAGE CLASSIFICATION (strict standards):
- Minor: Surface damage only - scratches, scuffs, dents <5cm, mirror damage, trim damage. Repair <10% of vehicle value
- Moderate: Structural but non-frame - panel damage, broken lights/windows, suspension, no frame involvement. Repair 10-40% of vehicle value  
- Major: Severe structural damage - frame damage, engine damage, severe deformation, potential total loss. Repair >40% of vehicle value

${hasImage ? `IMAGE ANALYSIS PROTOCOL:
1. VERIFY IMAGE AUTHENTICITY:
   - Check for photoshop/manipulation signs
   - Verify lighting consistency
   - Check for tampering indicators
   
2. MATCH TO DESCRIPTION:
   - Does image match described damage? (CRITICAL)
   - Severity must align
   - If mismatch, flag as HIGH FRAUD INDICATOR
   
3. ASSESS FROM IMAGE:
   - Is damage actually present?
   - How severe is it really?
   - Compare to claimed amount
   
4. CONFIDENCE SCORING:
   - Image quality (0-1)
   - Evidence clarity (0-1)
   - Average as confidenceFromImage` : "No image provided - score confidence lower due to lack of visual evidence"}

CRITICAL CHECK:
- If description is vague but severity is "Major" = red flag
- If claimAmount vastly exceeds damage visible = suspicious
- If minor damage shown but Major claimed = DEFINITE FRAUD

Return ONLY valid JSON with keys: finalDamageType (Minor|Moderate|Major), imageMatchesDescription (boolean or null if no image), imageAnalysisSummary (string), confidenceFromImage (0-1 or 0.5 if no image), verificationFlags (array), reasoning`;

  const userPrompt = `Claim ID: ${claimId}
Description: ${description}
Initial Severity Assessment: ${initialDamageSeverity}
${hasImage ? "IMAGE PROVIDED: Please analyze it very carefully for authenticity and match to description." : "NO IMAGE: Assess based on text description only - lower confidence expected"}`;

  try {
    let response;

    if (hasImage) {
      // Vision model - do NOT use response_format json_object
      response = await groqCall(() =>
        groqClient.chat.completions.create({
          model: MODELS.vision,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${imageMediaType};base64,${imageBase64}`,
                  },
                },
                { type: "text", text: userPrompt },
              ],
            },
          ],
          temperature: 0.1,
        })
      );
    } else {
      // Text model - can use response_format
      response = await groqCall(() =>
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
    }

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content || "{}";
    const result = extractJson(content) as unknown as DamageAssessmentOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    await db.insert(agent_logs).values({
      user_id: userId,
      claim_id: claimId,
      step_number: 4,
      agent_name: "DamageAssessmentAgent",
      status: "completed",
      input_summary: `Severity: ${initialDamageSeverity}, Image: ${hasImage ? "Yes" : "No"}`,
      output_summary: `FinalType: ${result.finalDamageType}, ImageMatch: ${result.imageMatchesDescription}`,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      model_used: modelUsed,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return { ...result, modelUsed };
  } catch (err) {
    const latencyMs = Date.now() - start;
    await db.insert(agent_logs).values({
      user_id: userId,
      claim_id: claimId,
      step_number: 4,
      agent_name: "DamageAssessmentAgent",
      status: "failed",
      input_summary: `Severity: ${initialDamageSeverity}, Image: ${hasImage ? "Yes" : "No"}`,
      output_summary: `Error: ${String(err).slice(0, 200)}`,
      tokens_used: 0,
      latency_ms: latencyMs,
      model_used: modelUsed,
      groq_key_slot: keySlot,
    }).catch(() => {});

    return {
      finalDamageType: initialDamageSeverity as "Minor" | "Moderate" | "Major",
      imageMatchesDescription: true,
      imageAnalysisSummary: "Assessment failed, using initial severity.",
      confidenceFromImage: 0.5,
      reasoning: "Agent failed, using fallback values.",
      modelUsed: modelUsed,
    };
  }
}
