import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
