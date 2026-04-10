import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies, invalidateSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      await invalidateSession(token);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    console.error("POST /api/auth/logout error:", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, user: { id: user.id, username: user.username } });
}
