import { eq, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';

import type { AppConfig } from '../config';
import type { Db } from '../db/client';
import { links, users } from '../db/schema';
import { ApiError } from '../errors';
import { createSession, destroySession } from '../services/session-service';
import { getUserByUsername, verifyPassword } from '../services/user-service';
import { permissionsForRole } from '../types';
import { createAuthPlugin, createRateLimitPlugin, extractToken } from './auth';
import { createCorsPlugin } from './cors';
import { createLinksRouter } from './routes/links';
import { createUsersRouter } from './routes/users';

function unauthorized(set: { status?: number | string }) {
  set.status = 401;
  return { ok: false, error: { code: 'unauthorized', message: '缺少或无效的登录会话' } };
}

export function createApiApp(db: Db, config: AppConfig) {
  return new Elysia({ prefix: '/api' })
    .use(createCorsPlugin())
    .use(createAuthPlugin(db))
    .use(createRateLimitPlugin(config.rateLimitMax))
    .onError(({ error, set }) => {
      if (error instanceof ApiError) {
        set.status = error.status;
        return { ok: false, error: { code: error.code, message: error.message } };
      }
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 400
      ) {
        set.status = 400;
        return { ok: false, error: { code: 'invalid_body', message: error.message } };
      }
      console.error('[api] 未处理的错误:', error);
      set.status = 500;
      return { ok: false, error: { code: 'internal_error', message: '服务器内部错误' } };
    })
    .get('/', ({ set }) => {
      set.status = 404;
      return { ok: false, error: { code: 'reserved_path', message: 'API 路径为保留路径' } };
    })
    .post('/auth/login', async ({ body }) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const username = typeof b.username === 'string' ? b.username.trim() : '';
      const password = typeof b.password === 'string' ? b.password : '';
      if (!username || !password) {
        throw new ApiError(400, '必须提供用户名和密码', 'invalid_credentials');
      }
      const user = await getUserByUsername(db, username);
      if (!user || !user.enabled || !(await verifyPassword(password, user.passwordHash))) {
        throw new ApiError(401, '用户名或密码错误', 'invalid_credentials');
      }
      await db
        .update(users)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(users.id, user.id));
      const token = await createSession(db, user.id, config.sessionTtlDays);
      return {
        ok: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: permissionsForRole(user.role)
          }
        }
      };
    })
    .post('/auth/logout', async ({ auth, set, headers }) => {
      if (!auth) return unauthorized(set);
      const raw = extractToken(headers as Record<string, string>);
      if (raw) await destroySession(db, raw);
      return { ok: true, data: { loggedOut: true } };
    })
    .get('/auth/verify', ({ auth, set }) => {
      if (!auth) return unauthorized(set);
      return {
        ok: true,
        data: {
          id: auth.userId,
          username: auth.username,
          role: auth.role,
          permissions: auth.permissions
        }
      };
    })
    .get('/system/info', async ({ auth, set }) => {
      if (!auth) return unauthorized(set);
      const counts = await db
        .select({ n: sql<number>`count(*)`.as('n'), status: links.status })
        .from(links)
        .groupBy(links.status);
      const active = counts.find((c) => c.status === 'active')?.n ?? 0;
      const retired = counts.find((c) => c.status === 'retired')?.n ?? 0;
      const userCount = await db
        .select({ n: sql<number>`count(*)` })
        .from(users)
        .get();
      return {
        ok: true,
        data: {
          hashLength: config.hashLength,
          retentionDays: config.retentionDays,
          publicLinkDomain: config.publicLinkDomain,
          counts: { total: active + retired, active, retired },
          userCount: userCount?.n ?? 0
        }
      };
    })
    .use(createLinksRouter(db, config))
    .use(createUsersRouter(db));
}
