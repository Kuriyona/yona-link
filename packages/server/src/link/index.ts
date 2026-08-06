import { Elysia } from 'elysia';

import type { AppConfig } from '../config';
import type { Db } from '../db/client';
import { cleanupRetired, resolveForRedirect } from '../services/link-service';

function notFound(set: { status?: number | string }) {
  set.status = 404;
  return { message: 'Not Found' };
}

function redirectTo(
  set: { status?: number | string; headers: Record<string, string | number> },
  target: string,
  permanent: boolean
) {
  set.status = permanent ? 301 : 302;
  set.headers.Location = target;
  return null;
}

export function createLinkApp(db: Db, config: AppConfig) {
  return new Elysia()
    .get('/health', () => ({ ok: true }))
    .get('/', ({ set }) => {
      if (!config.defaultRedirectUrl) return notFound(set);
      return redirectTo(set, config.defaultRedirectUrl, false);
    })
    .get('/:code', async ({ params, set }) => {
      const raw = (params as { code: string }).code;
      const isAlias = raw.startsWith('@');
      const code = isAlias ? raw.slice(1) : raw;
      const expectedType = isAlias ? ('alias' as const) : ('hash' as const);
      await cleanupRetired(db, config.retentionDays, Date.now());
      const result = await resolveForRedirect(db, code, expectedType, new Date().toISOString());
      if (result.kind === 'redirect')
        return redirectTo(
          set,
          result.targetUrl,
          result.permanent && config.response301ForPermanent
        );
      if (result.kind === 'retired') {
        set.status = 410;
        return { message: 'Gone' };
      }
      return notFound(set);
    });
}
