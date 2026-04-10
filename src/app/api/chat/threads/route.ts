import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chat_threads } from "@/db/schema";
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

    const created = await db
      .insert(chat_threads)
      .values({
        user_id: user.id,
        thread_id: threadId,
        claim_id: claimId,
        title,
      })
      .returning();

    return NextResponse.json({ thread: created[0] });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Thread already exists" }, { status: 409 });
    }
    console.error("POST /api/chat/threads error:", err);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }
}
