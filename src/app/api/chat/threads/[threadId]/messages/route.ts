import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chat_messages, chat_threads } from "@/db/schema";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { getGroqClient, MODELS } from "@/lib/groq";
import { groqCall } from "@/lib/groqCall";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    const thread = await db
      .select()
      .from(chat_threads)
      .where(and(eq(chat_threads.thread_id, threadId), eq(chat_threads.user_id, user.id)))
      .limit(1);

    if (!thread.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const messages = await db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.thread_id, threadId))
      .orderBy(asc(chat_messages.created_at));

    return NextResponse.json({ thread: thread[0], messages });
  } catch (err) {
    console.error("GET /api/chat/threads/[threadId]/messages error:", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;
    const body = await request.json();
    const message = String(body?.message ?? "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const thread = await db
      .select()
      .from(chat_threads)
      .where(and(eq(chat_threads.thread_id, threadId), eq(chat_threads.user_id, user.id)))
      .limit(1);

    if (!thread.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await db.insert(chat_messages).values({
      thread_id: threadId,
      sender: "user",
      message,
      metadata: { username: user.username },
    });

    const recent = await db
      .select({ sender: chat_messages.sender, message: chat_messages.message })
      .from(chat_messages)
      .where(eq(chat_messages.thread_id, threadId))
      .orderBy(desc(chat_messages.created_at))
      .limit(12);

    const contextMessages = recent.reverse().map((msg) => ({
      role: msg.sender === "assistant" ? "assistant" : "user",
      content: msg.message,
    })) as Array<{ role: "assistant" | "user"; content: string }>;

    const aiText = await groqCall(async () => {
      const response = await getGroqClient().chat.completions.create({
        model: MODELS.text,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are Cache Memory Assistant. Help users with insurance claim processing, payout interpretation, and next actions. Be concise and practical.",
          },
          ...contextMessages,
        ],
      });
      return response.choices[0]?.message?.content?.trim() || "I could not generate a response. Please try again.";
    });

    await db.insert(chat_messages).values({
      thread_id: threadId,
      sender: "assistant",
      message: aiText,
    });

    const messages = await db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.thread_id, threadId))
      .orderBy(asc(chat_messages.created_at));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("POST /api/chat/threads/[threadId]/messages error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
