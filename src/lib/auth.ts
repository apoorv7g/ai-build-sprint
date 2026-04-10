import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "cache_memory_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(":");
  if (!salt || !originalHash) return false;
  if (!/^[a-f0-9]+$/i.test(originalHash)) return false;
  const incomingHash = scryptSync(password, salt, 64).toString("hex");
  const incoming = Buffer.from(incomingHash, "hex");
  const original = Buffer.from(originalHash, "hex");
  if (incoming.length !== original.length) return false;
  return timingSafeEqual(incoming, original);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
  return token;
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token_hash, sha256(token)));
}

export async function getCurrentUserFromToken(token: string) {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.user_id))
    .where(and(eq(sessions.token_hash, sha256(token)), gt(sessions.expires_at, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCurrentUserFromCookies() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getCurrentUserFromToken(token);
}

export { SESSION_COOKIE };
