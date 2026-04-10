import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const { claimId } = params;

    const logs = await db
      .select()
      .from(agent_logs)
      .where(eq(agent_logs.claim_id, claimId))
      .orderBy(asc(agent_logs.step_number));

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("GET /api/claims/[claimId]/logs error:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
