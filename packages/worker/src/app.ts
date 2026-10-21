import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { loadConfig } from './config';
import { createDb } from './db/client';
import type { AppEnv } from './env';
import { ApiError } from './errors';
import { createApiRoutes } from './routes/api';
import { cleanupRetired, resolveForRedirect } from './services/link-service';

const CLEANUP_INTERVAL_MS = 3_600_000;
let lastCleanupAt = 0;

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('db', createDb(c.env.DB));
    c.set('config', loadConfig(c.env));
    await next();
  });

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(
        { ok: false as const, error: { code: error.code, message: error.message } },
        error.status as ContentfulStatusCode
      );
    }
    console.error('[worker] 未处理的错误:', error);
    return c.json(
      { ok: false as const, error: { code: 'internal_error', message: '服务器内部错误' } },
      500
    );
  });

  app.get('/health', (c) => c.json({ ok: true }));

  // /panel 为管理面板；静态资源由 Workers Assets 直接返回，
  // 这里只处理 /panel 跳转和前端路由的 index.html 回退。
  app.get('/panel', (c) => c.redirect('/panel/', 302));
  app.get('/panel/*', async (c) => {
    const indexUrl = new URL('/panel/index.html', c.req.url);
    const asset = await c.env.ASSETS.fetch(new Request(indexUrl, { headers: c.req.raw.headers }));
    if (asset.status === 404) return c.json({ message: 'Not Found' }, 404);
    return asset;
  });

  app.route('/api', createApiRoutes());

  app.get('/', (c) => {
    const target = c.get('config').defaultRedirectUrl;
    return target ? c.redirect(target, 302) : c.json({ message: 'Not Found' }, 404);
  });

  app.get('/:code', async (c) => {
    const raw = c.req.param('code');
    const isAlias = raw.startsWith('@');
    const code = isAlias ? raw.slice(1) : raw;
    const config = c.get('config');
    const db = c.get('db');

    const now = Date.now();
    if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
      lastCleanupAt = now;
      await cleanupRetired(db, config.retentionDays, now);
    }

    const result = await resolveForRedirect(
      db,
      code,
      isAlias ? 'alias' : 'hash',
      new Date(now).toISOString()
    );
    if (result.kind === 'redirect') {
      return c.redirect(
        result.targetUrl,
        result.permanent && config.response301ForPermanent ? 301 : 302
      );
    }
    if (result.kind === 'retired') return c.json({ message: 'Gone' }, 410);
    return c.json({ message: 'Not Found' }, 404);
  });

  app.notFound((c) => c.json({ message: 'Not Found' }, 404));

  return app;
}

export const app = createApp();
