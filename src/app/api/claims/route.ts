import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { claims, claim_results } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "10", 10);
    const offset = (page - 1) * perPage;

    // Join claims with claim_results
    const query = db
      .select({
        claim_id: claims.claim_id,
        description: claims.description,
        policy_type: claims.policy_type,
        claim_amount: claims.claim_amount,
        past_claims: claims.past_claims,
        documents_status: claims.documents_status,
        submitted_at: claims.submitted_at,
        status: claim_results.status,
        estimated_payout: claim_results.estimated_payout,
        confidence_score: claim_results.confidence_score,
        damage_type: claim_results.damage_type,
        payout_percentage: claim_results.payout_percentage,
        groq_key_slot: claim_results.groq_key_slot,
        processing_time_ms: claim_results.processing_time_ms,
      })
      .from(claims)
      .leftJoin(claim_results, and(eq(claims.claim_id, claim_results.claim_id), eq(claims.user_id, claim_results.user_id)));

    let results;
    if (status) {
      results = await query
        .where(and(eq(claims.user_id, user.id), eq(claim_results.status, status)))
        .limit(perPage)
        .offset(offset);
    } else {
      results = await query.where(eq(claims.user_id, user.id)).limit(perPage).offset(offset);
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(eq(claims.user_id, user.id));

    return NextResponse.json({
      data: results,
      page,
      perPage,
      total: Number(countResult[0]?.count || 0),
    });
  } catch (err) {
    console.error("GET /api/claims error:", err);
    return NextResponse.json({ error: "Failed to fetch claims" }, { status: 500 });
  }
}
