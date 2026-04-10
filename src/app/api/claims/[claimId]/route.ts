import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { claims, claim_results } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { claimId } = await params;

    const claimData = await db
      .select()
      .from(claims)
      .where(and(eq(claims.claim_id, claimId), eq(claims.user_id, user.id)))
      .limit(1);

    if (!claimData.length) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const resultData = await db
      .select()
      .from(claim_results)
      .where(and(eq(claim_results.claim_id, claimId), eq(claim_results.user_id, user.id)))
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
