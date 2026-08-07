import { Elysia } from 'elysia';

import type { Db } from '../db/client';
import { resolveSession } from '../services/session-service';
import { permissionsForRole, type Permission } from '../types';

export interface AuthContext {
  userId: number;
  username: string;
  role: 'admin' | 'user';
  permissions: Permission[];
}

export function extractToken(headers: Record<string, string | undefined>): string | null {
  const authz = headers.authorization ?? headers.Authorization;
  if (authz?.toLowerCase().startsWith('bearer ')) return authz.slice(7).trim();
  return headers['x-api-key'] ?? headers['X-Api-Key'] ?? null;
}

export async function authenticateSession(db: Db, raw: string): Promise<AuthContext | null> {
  const session = await resolveSession(db, raw);
  if (!session) return null;
  return {
    userId: session.userId,
    username: session.username,
    role: session.role,
    permissions: permissionsForRole(session.role)
  };
}

export function createAuthPlugin(db: Db) {
  return new Elysia({ name: 'auth' }).derive({ as: 'global' }, async ({ headers }) => ({
    auth:
      (await authenticateSession(db, extractToken(headers as Record<string, string>) ?? '')) || null
  }));
}

export function permissionGuard(perms: Permission | Permission[]) {
  const list = Array.isArray(perms) ? perms : [perms];
  return ({ auth, set }: { auth: AuthContext | null; set: { status?: number | string } }) => {
    if (!auth) {
      set.status = 401;
      return { ok: false, error: { code: 'unauthorized', message: '缺少或无效的登录会话' } };
    }
    const granted = new Set(auth.permissions);
    const missing = list.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      set.status = 403;
      return {
        ok: false,
        error: { code: 'forbidden', message: `缺少权限: ${missing.join(', ')}` }
      };
    }
  };
}

export function createRateLimitPlugin(max: number) {
  const hits = new Map<string, number[]>();
  return new Elysia({ name: 'rate-limit' }).onBeforeHandle(({ request, set }) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const now = Date.now();
    const windowStart = now - 60_000;
    const list = (hits.get(ip) ?? []).filter((t) => t > windowStart);
    if (list.length >= max) {
      set.status = 429;
      return { ok: false, error: { code: 'rate_limited', message: '请求过于频繁' } };
    }
    list.push(now);
    hits.set(ip, list);
  });
}
