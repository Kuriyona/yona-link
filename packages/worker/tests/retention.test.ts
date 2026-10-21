import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../src/db/client';
import { links } from '../src/db/schema';
import { cleanupRetired, createLink, deleteLink } from '../src/services/link-service';
import { app, env, resetDb } from './helpers';

beforeEach(resetDb);

describe('retention logic', () => {
  it('临时链接过期后返回 410', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      {
        type: 'hash',
        targetUrl: 'https://example.com/e',
        permanent: false,
        expiresAt: new Date(Date.now() - 1000).toISOString()
      },
      { hashLength: 6 }
    );

    const res = await app.request(`/${link.code}`, {}, env);
    expect(res.status).toBe(410);
  });

  it('删除后处于保留期返回 410', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      { type: 'hash', targetUrl: 'https://example.com/f', permanent: false },
      { hashLength: 6 }
    );

    await deleteLink(db, link.code);
    const res = await app.request(`/${link.code}`, {}, env);
    expect(res.status).toBe(410);
  });

  it('保留期内 code 不可复用', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      { type: 'alias', code: 'keepme', targetUrl: 'https://example.com/g', permanent: false },
      { hashLength: 6 }
    );

    await deleteLink(db, link.code);
    await expect(
      createLink(
        db,
        {
          type: 'alias',
          code: 'keepme',
          targetUrl: 'https://example.com/other',
          permanent: false
        },
        { hashLength: 6 }
      )
    ).rejects.toThrow();
  });

  it('超过保留期清理后可复用 code', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      { type: 'alias', code: 'reuse', targetUrl: 'https://example.com/h', permanent: false },
      { hashLength: 6 }
    );

    await deleteLink(db, link.code);
    await db
      .update(links)
      .set({ retiredAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(links.code, link.code));
    await cleanupRetired(db, 0, Date.now());

    const gone = await app.request('/@reuse', {}, env);
    expect(gone.status).toBe(404);

    const recreated = await createLink(
      db,
      { type: 'alias', code: 'reuse', targetUrl: 'https://example.com/new', permanent: false },
      { hashLength: 6 }
    );
    expect(recreated.code).toBe('reuse');

    const ok = await app.request('/@reuse', {}, env);
    expect(ok.status).toBe(302);
  });

  it('cleanupRetired 删除超期记录', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      { type: 'hash', targetUrl: 'https://example.com/i', permanent: false },
      { hashLength: 6 }
    );
    await deleteLink(db, link.code);
    await db
      .update(links)
      .set({ retiredAt: new Date(Date.now() - 10 * 86_400_000).toISOString() })
      .where(eq(links.code, link.code));

    await cleanupRetired(db, 7, Date.now());
    const [remaining] = await db.select().from(links).where(eq(links.code, link.code)).all();
    expect(remaining).toBeUndefined();
  });
});
