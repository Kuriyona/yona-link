import { eq } from 'drizzle-orm';

import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import type { UserRole } from '../types';
import { randomBytes, toBase64Url, sha256Hex } from './crypto';

export function hashToken(raw: string): Promise<string> {
  return sha256Hex(raw);
}

export async function createSession(db: Db, userId: number, ttlDays: number): Promise<string> {
  const raw = toBase64Url(randomBytes(32));
  const now = new Date();
  await db.insert(sessions).values({
    tokenHash: await hashToken(raw),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlDays * 86_400_000).toISOString()
  });
  return raw;
}

export async function resolveSession(
  db: Db,
  raw: string
): Promise<{ userId: number; username: string; role: UserRole } | null> {
  if (!raw) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, await hashToken(raw)))
    .all();
  if (!session) return null;
  if (session.expiresAt <= new Date().toISOString()) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).all();
  if (!user || !user.enabled) return null;
  await db
    .update(sessions)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(sessions.id, session.id));
  return { userId: user.id, username: user.username, role: user.role };
}

export async function destroySession(db: Db, raw: string): Promise<void> {
  if (!raw) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, await hashToken(raw)));
}
