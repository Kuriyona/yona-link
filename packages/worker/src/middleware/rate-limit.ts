import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../env';

// 内存限流按 Worker isolate 生效：冷启动后重新计数，属于无状态部署下的近似限流。
const hits = new Map<string, number[]>();

export const rateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const max = c.get('config').rateLimitMax;
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (hits.get(ip) ?? []).filter((time) => time > windowStart);
  if (list.length >= max) {
    return c.json(
      { ok: false as const, error: { code: 'rate_limited', message: '请求过于频繁' } },
      429
    );
  }
  list.push(now);
  hits.set(ip, list);
  await next();
});
