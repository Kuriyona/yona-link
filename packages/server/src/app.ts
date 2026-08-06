import { Elysia } from 'elysia';

import { createApiApp } from './api/app';
import type { AppConfig } from './config';
import type { Db } from './db/client';
import { createLinkApp } from './link';

export function createApp(db: Db, config: AppConfig) {
  return new Elysia()
    .onError(({ code, set }) => {
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { ok: false, error: { code: 'not_found', message: '接口不存在' } };
      }
    })
    .use(createApiApp(db, config))
    .use(createLinkApp(db, config));
}
