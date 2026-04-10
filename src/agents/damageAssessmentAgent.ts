import Groq from "groq-sdk";
import { MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";
import { extractJson } from "@/lib/extractJson";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { DamageAssessmentOutput } from "@/types";

interface DamageAssessmentInput {
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
  const { claimId, description, initialDamageSeverity, imageBase64, imageMediaType, groqClient, keySlot } = input;
  const hasImage = !!(imageBase64 && imageMediaType);
  const modelUsed = hasImage ? MODELS.vision : MODELS.text;

  const systemPrompt = `You are an expert vehicle damage assessment specialist. Classify the damage severity and analyze the claim.

Damage Classification:
- Minor: scratches, scuffs, dents, broken mirrors, minor bumper damage
- Moderate: panel damage, broken lights, non-structural body damage
- Major: frame damage, engine damage, severe deformation, total loss

${hasImage ? `If an image is provided, carefully examine it and:
1. Determine if the image matches the described damage severity
2. Flag any mismatch between the image and description
3. Use the image as primary evidence` : ""}

Return ONLY valid JSON with keys: finalDamageType (exactly "Minor", "Moderate", or "Major"), imageMatchesDescription (boolean), imageAnalysisSummary, confidenceFromImage (0-1), reasoning`;

  const userPrompt = `Claim ID: ${claimId}
Description: ${description}
Initial Severity Assessment: ${initialDamageSeverity}
${hasImage ? "An image has been provided. Please analyze it carefully." : "No image provided. Assess based on description only."}`;

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
