import { runClaim } from "./runClaim";
import { ClaimInput, ClaimResult, BatchResult } from "@/types";

export async function runBatch(claims: ClaimInput[]): Promise<BatchResult> {
  const batchStart = Date.now();

  // Run all pipelines simultaneously via Promise.all
  const results = await Promise.allSettled(
    claims.map((claim, index) => {
      const slot = (index % 3) as 0 | 1 | 2;
      return runClaim(claim, slot);
    })
  );

  const claimResults: ClaimResult[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      // One pipeline failed — return error result without crashing batch
      const claim = claims[index];
      return {
        claimId: claim.claimId,
        status: "Rejected" as const,
        estimatedPayout: 0,
        payoutBreakdown: {
          claimAmount: claim.claimAmount,
          payoutPercentage: 0,
          grossPayout: 0,
          deductible: 3000,
          netPayout: 0,
        },
        confidenceScore: 0.10,
        damageType: "Unknown",
        fraudRisk: "Unknown",
        fraudFlags: [],
        coverageValid: false,
        reason: `Pipeline failed: ${result.reason?.message || "Unknown error"}`,
        customerMessage: "",
        customerMessageSubject: "",
        groqKeySlotUsed: index % 3,
        agentWorkflow: [],
        processingTimeMs: 0,
        error: result.reason?.message || "Pipeline failed",
      };
    }
  });

  return {
    results: claimResults,
    batchProcessingTimeMs: Date.now() - batchStart,
  };
}
