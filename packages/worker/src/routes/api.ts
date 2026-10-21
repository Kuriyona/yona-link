import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { csrfGuard, optionalAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { ensureAdminBootstrapped } from '../services/user-service';
import { createAuthRoutes } from './auth';
import { createLinkRoutes } from './links';
import { createSystemRoutes } from './system';
import { createUserRoutes } from './users';

export function createApiRoutes() {
  const api = new Hono<AppEnv>();

  api.use('*', rateLimit);
  api.use('*', optionalAuth);
  api.use('*', csrfGuard);
  api.use('*', async (c, next) => {
    await ensureAdminBootstrapped(c.get('db'), c.get('config'));
    await next();
  });

  api.get('/', (c) =>
    c.json(
      { ok: false as const, error: { code: 'reserved_path', message: 'API 路径为保留路径' } },
      404
    )
  );

  api.route('/auth', createAuthRoutes());
  api.route('/system', createSystemRoutes());
  api.route('/links', createLinkRoutes());
  api.route('/users', createUserRoutes());

  // 兜底：/api 下未匹配的路径统一返回 JSON 404（子应用的 notFound 不会被挂载路由继承）。
  api.all('*', (c) =>
    c.json({ ok: false as const, error: { code: 'not_found', message: '接口不存在' } }, 404)
  );

  return api;
}
