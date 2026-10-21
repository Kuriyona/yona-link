import { beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../src/db/client';
import { createLink, getLinkByCode } from '../src/services/link-service';
import { app, env, resetDb } from './helpers';

beforeEach(resetDb);

describe('link redirect service', () => {
  it('根路径跳转到默认目标', async () => {
    const res = await app.request('/', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://default.example.com');
  });

  it('hash 链接跳转', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      { type: 'hash', targetUrl: 'https://example.com/a', permanent: false },
      { hashLength: 6 }
    );
    expect(link.code).toHaveLength(6);

    const res = await app.request(`/${link.code}`, {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://example.com/a');
  });

  it('alias 链接跳转', async () => {
    const db = createDb(env.DB);
    await createLink(
      db,
      { type: 'alias', code: 'myalias', targetUrl: 'https://example.com/b', permanent: false },
      { hashLength: 6 }
    );

    const res = await app.request('/@myalias', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://example.com/b');
  });

  it('不存在的链接返回 404', async () => {
    const res = await app.request('/notexist', {}, env);
    expect(res.status).toBe(404);
  });

  it('跳转后点击计数自增', async () => {
    const db = createDb(env.DB);
    const link = await createLink(
      db,
      { type: 'hash', targetUrl: 'https://example.com/c', permanent: false },
      { hashLength: 6 }
    );

    await app.request(`/${link.code}`, {}, env);
    await app.request(`/${link.code}`, {}, env);

    const updated = await getLinkByCode(db, link.code);
    expect(updated?.clickCount).toBe(2);
  });

  it('alias 不会被 hash 路由命中', async () => {
    const db = createDb(env.DB);
    await createLink(
      db,
      { type: 'alias', code: 'zzz123', targetUrl: 'https://example.com/d', permanent: false },
      { hashLength: 6 }
    );

    const res = await app.request('/zzz123', {}, env);
    expect(res.status).toBe(404);
  });
});
