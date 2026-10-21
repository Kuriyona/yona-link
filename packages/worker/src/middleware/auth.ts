import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

import type { Db } from '../db/client';
import type { AppEnv } from '../env';
import { resolveSession } from '../services/session-service';
import { permissionsForRole, type Permission } from '../types';

export const SESSION_COOKIE = 'kl_session';

export interface AuthContext {
  userId: number;
  username: string;
  role: 'admin' | 'user';
  permissions: Permission[];
}

export function extractToken(headers: Headers): string | null {
  const authorization = headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
  return headers.get('x-api-key');
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

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const raw = getCookie(c, SESSION_COOKIE) ?? extractToken(c.req.raw.headers);
  c.set('auth', raw ? await authenticateSession(c.get('db'), raw) : null);
  await next();
});

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Cookie 会被浏览器自动携带，写操作需要校验来源，防止跨站请求伪造（也覆盖登录 CSRF）。
export const csrfGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const source = c.req.header('origin') ?? c.req.header('referer');
  if (source) {
    let sourceOrigin: string;
    try {
      sourceOrigin = new URL(source).origin;
    } catch {
      return c.json(
        { ok: false as const, error: { code: 'invalid_origin', message: '请求来源无效' } },
        403
      );
    }
    if (sourceOrigin !== new URL(c.req.url).origin) {
      return c.json(
        { ok: false as const, error: { code: 'invalid_origin', message: '请求来源不被允许' } },
        403
      );
    }
  }
  await next();
});

export function unauthorized() {
  return { ok: false as const, error: { code: 'unauthorized', message: '缺少或无效的登录会话' } };
}

export function requirePermission(perms: Permission | Permission[]) {
  const list = Array.isArray(perms) ? perms : [perms];
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) return c.json(unauthorized(), 401);
    const granted = new Set(auth.permissions);
    const missing = list.filter((permission) => !granted.has(permission));
    if (missing.length > 0) {
      return c.json(
        {
          ok: false as const,
          error: { code: 'forbidden', message: `缺少权限: ${missing.join(', ')}` }
        },
        403
      );
    }
    await next();
  });
}
