import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { claims, claim_results } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const { claimId } = params;

    const claimData = await db
      .select()
      .from(claims)
      .where(eq(claims.claim_id, claimId))
      .limit(1);

    if (!claimData.length) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const resultData = await db
      .select()
      .from(claim_results)
      .where(eq(claim_results.claim_id, claimId))
      .limit(1);

    return NextResponse.json({
      claim: claimData[0],
      result: resultData[0] || null,
    });
  } catch (err) {
    console.error("GET /api/claims/[claimId] error:", err);
    return NextResponse.json({ error: "Failed to fetch claim" }, { status: 500 });
  }
}
