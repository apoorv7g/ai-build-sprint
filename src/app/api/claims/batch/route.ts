import { NextRequest, NextResponse } from "next/server";
import { runBatch } from "@/orchestrator/runBatch";
import { ClaimInput } from "@/types";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const claimsInput: ClaimInput[] = body.claims;

    if (!Array.isArray(claimsInput) || claimsInput.length < 2 || claimsInput.length > 3) {
      return NextResponse.json(
        { error: "Batch must contain 2–3 claims" },
        { status: 400 }
      );
    }

    // Validate each claim
    for (let i = 0; i < claimsInput.length; i++) {
      const claim = claimsInput[i];
      const required = ["claimId", "description", "policyType", "claimAmount", "documentsStatus"];
      for (const field of required) {
        const val = (claim as unknown as Record<string, unknown>)[field];
        if (val === undefined || val === null || val === "") {
          return NextResponse.json(
            { error: `Missing required field: ${field} in claim ${i + 1}` },
            { status: 400 }
          );
        }
      }
    }

    const result = await runBatch(user.id, claimsInput);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/claims/batch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
