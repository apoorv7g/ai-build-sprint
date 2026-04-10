import { getClientForSlot } from "@/lib/groq";
import { calculateConfidence } from "@/lib/confidenceCalculator";
import { imageUrlToBase64 } from "@/lib/imageUtils";
import { db } from "@/db";
import { claims, claim_results } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { claimAnalysisAgent } from "@/agents/claimAnalysisAgent";
import { coverageAndFraudAgent } from "@/agents/coverageAndFraudAgent";
import { damageAssessmentAgent } from "@/agents/damageAssessmentAgent";
import { payoutEstimationAgent } from "@/agents/payoutEstimationAgent";
import { customerCommunicationAgent } from "@/agents/customerCommunicationAgent";
import { ClaimInput, ClaimResult } from "@/types";
import { MODELS, getGroqClient } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";

export async function runClaim(
  userId: string,
  input: ClaimInput,
  claimSlot: 0 | 1 | 2 = 0
): Promise<ClaimResult> {
  const pipelineStart = Date.now();
  const groqClient = getClientForSlot(claimSlot);

  // STEP 1 — Intake & Validation
  if (!input.claimId?.trim()) {
    return errorResult("", "Invalid input", "Missing required field: claimId");
  }
  if (!input.description?.trim()) {
    return errorResult(input.claimId, "Invalid input", "Missing required field: description");
  }
  if (!input.policyType || !["Comprehensive", "Third-Party"].includes(input.policyType)) {
    return errorResult(input.claimId, "Invalid input", "Invalid policy type. Must be Comprehensive or Third-Party");
  }
  if (!input.claimAmount || input.claimAmount <= 0) {
    return errorResult(input.claimId, "Invalid input", "Invalid claim amount");
  }
  if (!input.documentsStatus || !["Complete", "Missing"].includes(input.documentsStatus)) {
    return errorResult(input.claimId, "Invalid input", "Invalid documents status");
  }

  // Insert claim into DB
  try {
    await db.insert(claims).values({
      user_id: userId,
      claim_id: input.claimId,
      description: input.description,
      policy_type: input.policyType,
      claim_amount: input.claimAmount,
      past_claims: input.pastClaims ?? 0,
      documents_status: input.documentsStatus,
      image_url: input.imageUrl,
    });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    
    // Handle database errors with user-friendly message
    if (error?.code === "23505" || error?.message?.includes("unique")) {
      const userMessage = await generateErrorMessage(
        "A claim with this ID already exists in our system. Please use a different claim ID or contact support if you believe this is an error.",
        groqClient,
        claimSlot
      );
      const dbError: any = new Error(userMessage);
      dbError.status = 409;
      dbError.originalError = "Duplicate claim ID";
      throw dbError;
    }
    
    // Generic database error handler
    const userMessage = await generateErrorMessage(
      `Database error occurred while processing your claim: ${error?.message || "Unknown error"}. Please try again later`,
      groqClient,
      claimSlot
    );
    const dbError: any = new Error(userMessage);
    dbError.status = 500;
    dbError.originalError = error?.message;
    throw dbError;
  }

  // Image handling
  let imageBase64 = input.imageBase64;
  let imageMediaType = input.imageMediaType;

  if (!imageBase64 && input.imageUrl) {
    try {
      const fetched = await imageUrlToBase64(input.imageUrl);
      imageBase64 = fetched.base64;
      imageMediaType = fetched.mediaType;
    } catch {
      // Image fetch failed, proceed without image
      imageBase64 = undefined;
      imageMediaType = undefined;
    }
  }

  // STEP 2 — Claim Analysis
  let analysisResult;
  try {
    analysisResult = await claimAnalysisAgent({
      userId,
      claimId: input.claimId,
      description: input.description,
      policyType: input.policyType,
      claimAmount: input.claimAmount,
      pastClaims: input.pastClaims ?? 0,
      documentsStatus: input.documentsStatus,
      groqClient,
      keySlot: claimSlot,
    });
  } catch {
    // On failure, set status to Pending and abort
    const processingTimeMs = Date.now() - pipelineStart;
    const fallback: ClaimResult = {
      claimId: input.claimId,
      status: "Pending",
      estimatedPayout: 0,
      payoutBreakdown: { claimAmount: input.claimAmount, payoutPercentage: 0, grossPayout: 0, deductible: 3000, netPayout: 0 },
      confidenceScore: 0.10,
      damageType: "Unknown",
      fraudRisk: "Unknown",
      fraudFlags: [],
      coverageValid: false,
      reason: "Claim analysis failed. Manual review required.",
      customerMessage: "",
      customerMessageSubject: "",
      groqKeySlotUsed: claimSlot,
      agentWorkflow: [],
      processingTimeMs,
    };
    await persistResult(userId, fallback, processingTimeMs, claimSlot);
    return fallback;
  }

  // STEP 3 — Coverage + Fraud Check
  const coverageResult = await coverageAndFraudAgent({
    userId,
    claimId: input.claimId,
    policyType: input.policyType,
    incidentType: analysisResult.incidentType,
    documentsStatus: input.documentsStatus,
    claimAmount: input.claimAmount,
    pastClaims: input.pastClaims ?? 0,
    description: input.description,
    initialDamageSeverity: analysisResult.initialDamageSeverity,
    groqClient,
    keySlot: claimSlot,
  });

  const fraudFlags = [...(coverageResult.fraudFlags || [])];

  // Decision gate after Step 3
  const shouldShortCircuit =
    coverageResult.coverageValid === false ||
    coverageResult.fraudRisk === "High" ||
    coverageResult.recommendation === "reject";

  let damageResult = {
    finalDamageType: analysisResult.initialDamageSeverity as "Minor" | "Moderate" | "Major",
    imageMatchesDescription: true as boolean,
    imageAnalysisSummary: "Skipped",
    confidenceFromImage: 0.5,
    reasoning: "Skipped due to early rejection",
    modelUsed: "N/A",
  };

  let payoutResult = {
    status: "Rejected" as "Approved" | "Rejected" | "Pending",
    payoutPercentage: 0,
    grossPayout: 0,
    deductibleApplied: 3000,
    estimatedPayout: 0,
    justification: coverageResult.coverageValid === false
      ? "Coverage invalid for this policy type."
      : "High fraud risk detected.",
    reasoning: "Short-circuited due to coverage/fraud rejection.",
  };

  if (!shouldShortCircuit) {
    // STEP 4 — Damage Assessment
    damageResult = await damageAssessmentAgent({
      userId,
      claimId: input.claimId,
      description: input.description,
      initialDamageSeverity: analysisResult.initialDamageSeverity,
      imageBase64,
      imageMediaType,
      groqClient,
      keySlot: claimSlot,
    });

    // Add mismatch flag if detected
    if (damageResult.imageMatchesDescription === false) {
      fraudFlags.push("Image-description mismatch detected");
    }

    // STEP 5 — Payout Estimation
    payoutResult = await payoutEstimationAgent({
      userId,
      claimId: input.claimId,
      claimAmount: input.claimAmount,
      finalDamageType: damageResult.finalDamageType,
      fraudRisk: coverageResult.fraudRisk,
      coverageValid: coverageResult.coverageValid,
      documentsStatus: input.documentsStatus,
      groqClient,
      keySlot: claimSlot,
    });
  }

  // STEP 6 — Customer Communication (always runs)
  const reason = buildReason(analysisResult, coverageResult, damageResult, payoutResult);
  const commResult = await customerCommunicationAgent({
    userId,
    claimId: input.claimId,
    status: payoutResult.status,
    estimatedPayout: payoutResult.estimatedPayout,
    reason,
    fraudFlags,
    coverageReason: coverageResult.coverageReason,
    damageType: damageResult.finalDamageType,
    documentIssue: coverageResult.documentIssue,
    groqClient,
    keySlot: claimSlot,
  });

  // STEP 7 — Confidence Score
  const { score: confidenceScore, breakdown: confidenceBreakdown } = calculateConfidence({
    fraudRisk: coverageResult.fraudRisk,
    documentsStatus: input.documentsStatus,
    imageMatchesDescription: damageResult.imageMatchesDescription,
    pastClaims: input.pastClaims ?? 0,
    coverageValid: coverageResult.coverageValid,
  });

  const processingTimeMs = Date.now() - pipelineStart;

  const result: ClaimResult = {
    claimId: input.claimId,
    status: payoutResult.status,
    estimatedPayout: payoutResult.estimatedPayout,
    payoutBreakdown: {
      claimAmount: input.claimAmount,
      payoutPercentage: payoutResult.payoutPercentage,
      grossPayout: payoutResult.grossPayout,
      deductible: 3000,
      netPayout: payoutResult.estimatedPayout,
    },
    confidenceScore,
    confidenceBreakdown,
    damageType: damageResult.finalDamageType,
    fraudRisk: coverageResult.fraudRisk,
    fraudFlags,
    coverageValid: coverageResult.coverageValid,
    reason,
    customerMessage: commResult.customerMessage,
    customerMessageSubject: commResult.subject,
    groqKeySlotUsed: claimSlot,
    agentWorkflow: [],
    processingTimeMs,
  };

  // STEP 8 — Persist & Return
  await persistResult(userId, result, processingTimeMs, claimSlot);

  // Fetch agent logs for the workflow
  const { agent_logs: agentLogsTable } = await import("@/db/schema");
  const logs = await db
    .select()
    .from(agentLogsTable)
    .where(and(eq(agentLogsTable.claim_id, input.claimId), eq(agentLogsTable.user_id, userId)));

  result.agentWorkflow = logs
    .sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
    .map((log) => ({
      stepNumber: log.step_number || 0,
      agentName: log.agent_name || "",
      modelUsed: log.model_used || "",
      groqKeySlot: log.groq_key_slot || 0,
      status: (log.status as "waiting" | "running" | "completed" | "failed" | "skipped") || "completed",
      latencyMs: log.latency_ms || 0,
      tokensUsed: log.tokens_used || 0,
      inputSummary: log.input_summary || "",
      outputSummary: log.output_summary || "",
    }));

  return result;
}

function errorResult(claimId: string, status: "Rejected" | "Invalid input" | string, message: string): ClaimResult {
  return {
    claimId,
    status: "Rejected",
    estimatedPayout: 0,
    payoutBreakdown: { claimAmount: 0, payoutPercentage: 0, grossPayout: 0, deductible: 3000, netPayout: 0 },
    confidenceScore: 0.10,
    damageType: "Unknown",
    fraudRisk: "Unknown",
    fraudFlags: [],
    coverageValid: false,
    reason: message,
    customerMessage: "",
    customerMessageSubject: "",
    groqKeySlotUsed: 0,
    agentWorkflow: [],
    processingTimeMs: 0,
    error: message,
  };
}

async function persistResult(userId: string, result: ClaimResult, processingTimeMs: number, keySlot: number) {
  try {
    await db.insert(claim_results).values({
      user_id: userId,
      claim_id: result.claimId,
      status: result.status,
      estimated_payout: result.estimatedPayout,
      confidence_score: String(result.confidenceScore),
      damage_type: result.damageType,
      payout_percentage: result.payoutBreakdown.payoutPercentage,
      reason: result.reason,
      customer_message: result.customerMessage,
      fraud_flags: result.fraudFlags,
      coverage_valid: result.coverageValid,
      processing_time_ms: processingTimeMs,
      groq_key_slot: keySlot,
    });
  } catch {
    // Best effort persistence
  }
}

function buildReason(
  analysis: { incidentType: string; initialDamageSeverity: string; reasoning?: string },
  coverage: { coverageReason: string; fraudRisk: string; fraudFlags: string[]; reasoning?: string },
  damage: { finalDamageType: string; reasoning?: string },
  payout: { status: string; justification: string }
): string {
  const parts = [
    `Incident: ${analysis.incidentType} (${analysis.initialDamageSeverity} severity).`,
    `Coverage: ${coverage.coverageReason}.`,
  ];
  if (coverage.fraudRisk !== "None") {
    parts.push(`Fraud risk: ${coverage.fraudRisk}${coverage.fraudFlags.length ? ` (${coverage.fraudFlags.join(", ")})` : ""}.`);
  }
  parts.push(`Final damage: ${damage.finalDamageType}.`);
  parts.push(`Decision: ${payout.justification}`);
  return parts.join(" ");
}

async function generateErrorMessage(dbError: string, groqClient: any, keySlot: number): Promise<string> {
  try {
    const response = await groqCall(async () =>
      groqClient.chat.completions.create({
        model: MODELS.text,
        messages: [
          {
            role: "system",
            content:
              "You are a professional insurance customer support assistant. Convert technical database/system errors into clear, empathetic user-friendly messages. Be brief (one sentence max) and suggest next steps.",
          },
          {
            role: "user",
            content: `Convert this technical error into a user-friendly message: "${dbError}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      })
    );

    const message = response.choices[0]?.message?.content?.trim();
    return message || dbError;
  } catch {
    // Fallback if LLM call fails
    return dbError;
  }
}
