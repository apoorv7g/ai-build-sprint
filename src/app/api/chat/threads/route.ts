import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chat_threads, claims, claim_results } from "@/db/schema";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threads = await db
      .select()
      .from(chat_threads)
      .where(eq(chat_threads.user_id, user.id))
      .orderBy(desc(chat_threads.created_at));

    return NextResponse.json({ threads });
  } catch (err) {
    console.error("GET /api/chat/threads error:", err);
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const threadId = String(body?.threadId ?? crypto.randomUUID());
    const title = String(body?.title ?? "New Chat").trim() || "New Chat";
    const claimId = body?.claimId ? String(body.claimId) : null;

    // Validate claim ID exists if provided
    if (claimId) {
      const trimmedClaimId = claimId.trim();
      
      // Check if claim exists in DB
      const existingClaim = await db
        .select()
        .from(claims)
        .where(and(eq(claims.user_id, user.id), eq(claims.claim_id, trimmedClaimId)))
        .limit(1);

      if (!existingClaim.length) {
        return NextResponse.json(
          { error: "Claim ID does not exist" },
          { status: 400 }
        );
      }

      // Check if thread already exists for this claim
      const existingThread = await db
        .select()
        .from(chat_threads)
        .where(and(eq(chat_threads.user_id, user.id), eq(chat_threads.claim_id, trimmedClaimId)))
        .limit(1);

      if (existingThread.length) {
        return NextResponse.json(
          { error: "This claim is already being chatted about" },
          { status: 400 }
        );
      }
    }

    const created = await db
      .insert(chat_threads)
      .values({
        user_id: user.id,
        thread_id: threadId,
        claim_id: claimId,
        title,
      })
      .returning();

    // Enrich with claim data if linked
    let threadData: Record<string, unknown> = created[0];
    if (claimId) {
      const claimRecord = await db
        .select()
        .from(claims)
        .where(and(eq(claims.user_id, user.id), eq(claims.claim_id, claimId)))
        .limit(1);

      const resultRecord = await db
        .select()
        .from(claim_results)
        .where(and(eq(claim_results.user_id, user.id), eq(claim_results.claim_id, claimId)))
        .orderBy(desc(claim_results.created_at))
        .limit(1);

      threadData = {
        ...threadData,
        claim_data: claimRecord[0] || null,
        claim_result: resultRecord[0] || null,
      };
    }

    return NextResponse.json({ thread: threadData });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Thread already exists" }, { status: 409 });
    }
    console.error("POST /api/chat/threads error:", err);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const threadId = String(body?.threadId ?? "");
    const title = String(body?.title ?? "").trim();

    if (!threadId) {
      return NextResponse.json({ error: "Thread ID is required" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Verify thread exists and belongs to user
    const thread = await db
      .select()
      .from(chat_threads)
      .where(and(eq(chat_threads.thread_id, threadId), eq(chat_threads.user_id, user.id)))
      .limit(1);

    if (!thread.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const updated = await db
      .update(chat_threads)
      .set({ title })
      .where(eq(chat_threads.thread_id, threadId))
      .returning();

    return NextResponse.json({ thread: updated[0] });
  } catch (err) {
    console.error("PUT /api/chat/threads error:", err);
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
  }
}
