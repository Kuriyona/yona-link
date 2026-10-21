import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { links, users } from '../db/schema';
import type { AppEnv } from '../env';
import { unauthorized } from '../middleware/auth';

export function createSystemRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get('/info', async (c) => {
    if (!c.get('auth')) return c.json(unauthorized(), 401);
    const db = c.get('db');
    const config = c.get('config');
    const counts = await db
      .select({ n: sql<number>`count(*)`.as('n'), status: links.status })
      .from(links)
      .groupBy(links.status)
      .all();
    const active = counts.find((row) => row.status === 'active')?.n ?? 0;
    const retired = counts.find((row) => row.status === 'retired')?.n ?? 0;
    const [userCount] = await db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .all();
    return c.json({
      ok: true as const,
      data: {
        hashLength: config.hashLength,
        retentionDays: config.retentionDays,
        publicLinkDomain: config.publicLinkDomain,
        counts: { total: active + retired, active, retired },
        userCount: userCount?.n ?? 0
      }
    });
  });

  return routes;
}
