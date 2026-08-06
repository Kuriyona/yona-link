import { sql } from 'drizzle-orm';
import { Elysia } from 'elysia';

import type { AppConfig } from '../config';
import type { Db } from '../db/client';
import { links } from '../db/schema';
import { ApiError } from '../errors';
import { createAuthPlugin, createRateLimitPlugin } from './auth';
import { createCorsPlugin } from './cors';
import { createKeysRouter } from './routes/keys';
import { createLinksRouter } from './routes/links';

function unauthorized(set: { status?: number | string }) {
  set.status = 401;
  return { ok: false, error: { code: 'unauthorized', message: '缺少或无效的 API Key' } };
}

export function createApiApp(db: Db, config: AppConfig) {
  return new Elysia({ prefix: '/api' })
    .use(createCorsPlugin())
    .use(createAuthPlugin(db, config))
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
    .get('/auth/verify', ({ auth, set }) => {
      if (!auth) return unauthorized(set);
      return {
        ok: true,
        data: { kind: auth.kind, name: auth.name, permissions: auth.permissions }
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
      return {
        ok: true,
        data: {
          hashLength: config.hashLength,
          retentionDays: config.retentionDays,
          publicLinkDomain: config.publicLinkDomain,
          counts: { total: active + retired, active, retired }
        }
      };
    })
    .use(createLinksRouter(db, config))
    .use(createKeysRouter(db, config));
}
