import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, SESSION_COOKIE } from "@/lib/auth";

function validUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!validUsername(username)) {
      return NextResponse.json(
        { error: "Username must be 3-24 chars and use only letters, numbers, underscore" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const inserted = await db
      .insert(users)
      .values({ username, password_hash: hashPassword(password) })
      .returning({ id: users.id, username: users.username });

    const user = inserted[0];
    const token = await createSession(user.id);

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
