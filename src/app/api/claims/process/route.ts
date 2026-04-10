import { NextRequest, NextResponse } from "next/server";
import { runClaim } from "@/orchestrator/runClaim";
import { ClaimInput } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ["claimId", "description", "policyType", "claimAmount", "documentsStatus"];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === "") {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    if (!["Comprehensive", "Third-Party"].includes(body.policyType)) {
      return NextResponse.json(
        { error: "Invalid policy type. Must be Comprehensive or Third-Party" },
        { status: 400 }
      );
    }

    if (Number(body.claimAmount) <= 0) {
      return NextResponse.json(
        { error: "Invalid claim amount" },
        { status: 400 }
      );
    }

    const input: ClaimInput = {
      claimId: body.claimId,
      description: body.description,
      policyType: body.policyType,
      claimAmount: Number(body.claimAmount),
      pastClaims: Number(body.pastClaims ?? 0),
      documentsStatus: body.documentsStatus,
      imageUrl: body.imageUrl,
      imageBase64: body.imageBase64,
      imageMediaType: body.imageMediaType,
    };

    try {
      const result = await runClaim(input, 0);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error?.status === 409) {
        return NextResponse.json({ error: "Duplicate claim ID" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /api/claims/process error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
