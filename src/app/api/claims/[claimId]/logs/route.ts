import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agent_logs } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
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

    const logs = await db
      .select()
      .from(agent_logs)
      .where(and(eq(agent_logs.claim_id, claimId), eq(agent_logs.user_id, user.id)))
      .orderBy(asc(agent_logs.step_number));

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("GET /api/claims/[claimId]/logs error:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
