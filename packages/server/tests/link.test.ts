import { describe, expect, it } from 'bun:test';

import { createLink } from '../src/services/link-service';
import { createLinkAppWithDb, createTestDb } from './helpers';

describe('link redirect service', () => {
  it('根路径跳转到默认目标', async () => {
    const db = createTestDb();
    const app = createLinkAppWithDb(db);
    const res = await app.handle(new Request('http://localhost/'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://default.example.com');
  });

  it('hash 链接跳转', async () => {
    const db = createTestDb();
    const app = createLinkAppWithDb(db);
    const link = await createLink(
      db,
      {
        type: 'hash',
        targetUrl: 'https://example.com/a',
        permanent: false
      },
      { hashLength: 6 }
    );
    expect(link.code).toHaveLength(6);

    const res = await app.handle(new Request(`http://localhost/${link.code}`));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://example.com/a');
  });

  it('alias 链接跳转', async () => {
    const db = createTestDb();
    const app = createLinkAppWithDb(db);
    await createLink(
      db,
      {
        type: 'alias',
        code: 'myalias',
        targetUrl: 'https://example.com/b',
        permanent: false
      },
      { hashLength: 6 }
    );

    const res = await app.handle(new Request('http://localhost/@myalias'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://example.com/b');
  });

  it('不存在的链接返回 404', async () => {
    const db = createTestDb();
    const app = createLinkAppWithDb(db);
    const res = await app.handle(new Request('http://localhost/notexist'));
    expect(res.status).toBe(404);
  });

  it('跳转后点击计数自增', async () => {
    const db = createTestDb();
    const app = createLinkAppWithDb(db);
    const link = await createLink(
      db,
      {
        type: 'hash',
        targetUrl: 'https://example.com/c',
        permanent: false
      },
      { hashLength: 6 }
    );

    await app.handle(new Request(`http://localhost/${link.code}`));
    await app.handle(new Request(`http://localhost/${link.code}`));

    const { getLinkByCode } = await import('../src/services/link-service');
    const updated = await getLinkByCode(db, link.code);
    expect(updated?.clickCount).toBe(2);
  });

  it('alias 不会被 hash 路由命中', async () => {
    const db = createTestDb();
    const app = createLinkAppWithDb(db);
    await createLink(
      db,
      {
        type: 'alias',
        code: 'zzz123',
        targetUrl: 'https://example.com/d',
        permanent: false
      },
      { hashLength: 6 }
    );

    const res = await app.handle(new Request('http://localhost/zzz123'));
    expect(res.status).toBe(404);
  });
});
