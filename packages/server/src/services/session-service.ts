import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export function hashToken(raw: string): string {
  return Bun.CryptoHasher.hash('sha256', raw, 'hex');
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(db: Db, userId: number, ttlDays: number): Promise<string> {
  const raw = generateToken();
  const now = new Date();
  await db.insert(sessions).values({
    tokenHash: hashToken(raw),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlDays * 86_400_000).toISOString()
  });
  return raw;
}

export async function resolveSession(
  db: Db,
  raw: string
): Promise<{ userId: number; username: string; role: 'admin' | 'user' } | null> {
  if (!raw) return null;
  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(raw)))
    .get();
  if (!session) return null;
  if (session.expiresAt <= new Date().toISOString()) return null;
  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user || !user.enabled) return null;
  await db
    .update(sessions)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(sessions.id, session.id));
  return { userId: user.id, username: user.username, role: user.role };
}

export async function destroySession(db: Db, raw: string): Promise<void> {
  if (!raw) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(raw)));
}
