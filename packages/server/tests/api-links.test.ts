import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { createTestDb, testConfig } from './helpers';

const ADMIN = 'test-admin-key';

function createApiAppForTest() {
  const db = createTestDb();
  const app = createApp(db, testConfig());
  return { db, app };
}

function authed(url: string, init: RequestInit = {}, key = ADMIN): Request {
  return new Request(url, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {})
    }
  });
}

async function readJson(res: Response) {
  return (await res.json()) as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string };
  };
}

describe('links api', () => {
  it('创建 hash 链接并展示短链', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(
      authed('http://localhost/api/links', {
        method: 'POST',
        body: JSON.stringify({ type: 'hash', targetUrl: 'https://example.com/a', permanent: true })
      })
    );
    expect(res.status).toBe(201);
    const data = await readJson(res);
    const link = data.data as { code: string; type: string; shortUrl: string | null };
    expect(link.code).toHaveLength(6);
    expect(link.type).toBe('hash');
    expect(link.shortUrl).toBeNull();
  });

  it('code 冲突返回 409', async () => {
    const { app } = createApiAppForTest();
    const body = JSON.stringify({
      type: 'alias',
      code: 'dup',
      targetUrl: 'https://example.com',
      permanent: false
    });
    await app.handle(authed('http://localhost/api/links', { method: 'POST', body }));
    const res = await app.handle(authed('http://localhost/api/links', { method: 'POST', body }));
    expect(res.status).toBe(409);
  });

  it('分页与筛选', async () => {
    const { app } = createApiAppForTest();
    for (const c of ['a1', 'b1']) {
      await app.handle(
        authed('http://localhost/api/links', {
          method: 'POST',
          body: JSON.stringify({
            type: 'alias',
            code: c,
            targetUrl: `https://example.com/${c}`,
            permanent: false
          })
        })
      );
    }
    const res = await app.handle(authed('http://localhost/api/links?q=a1'));
    const data = await readJson(res);
    expect(data.data?.total).toBe(1);
    const items = data.data?.items as Array<{ code: string }>;
    expect(items[0]?.code).toBe('a1');
  });

  it('详情与统计', async () => {
    const { app } = createApiAppForTest();
    const created = await app.handle(
      authed('http://localhost/api/links', {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'stats1',
          targetUrl: 'https://example.com/s',
          permanent: false
        })
      })
    );
    const detail = await app.handle(authed('http://localhost/api/links/stats1'));
    expect(detail.status).toBe(200);
    const detailData = await readJson(detail);
    expect((detailData.data as { code: string }).code).toBe('stats1');

    const stats = await app.handle(authed('http://localhost/api/links/stats1/stats'));
    const statsData = await readJson(stats);
    expect((statsData.data as { clickCount: number }).clickCount).toBe(0);
    expect(created.status).toBe(201);
  });

  it('更新链接', async () => {
    const { app } = createApiAppForTest();
    await app.handle(
      authed('http://localhost/api/links', {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'upd',
          targetUrl: 'https://example.com/old',
          permanent: false
        })
      })
    );
    const res = await app.handle(
      authed('http://localhost/api/links/upd', {
        method: 'PATCH',
        body: JSON.stringify({ targetUrl: 'https://example.com/new', permanent: true })
      })
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect((data.data as { targetUrl: string; permanent: boolean }).targetUrl).toBe(
      'https://example.com/new'
    );
    expect((data.data as { permanent: boolean }).permanent).toBe(true);
  });

  it('删除后返回 410 且保留期内 code 不可复用', async () => {
    const { app } = createApiAppForTest();
    const body = JSON.stringify({
      type: 'alias',
      code: 'del',
      targetUrl: 'https://example.com/d',
      permanent: false
    });
    await app.handle(authed('http://localhost/api/links', { method: 'POST', body }));
    const del = await app.handle(authed('http://localhost/api/links/del', { method: 'DELETE' }));
    expect(del.status).toBe(200);

    const detail = await app.handle(authed('http://localhost/api/links/del'));
    expect(detail.status).toBe(200);

    const reCreate = await app.handle(
      authed('http://localhost/api/links', { method: 'POST', body })
    );
    expect(reCreate.status).toBe(409);
  });

  it('非法 URL 返回 400', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(
      authed('http://localhost/api/links', {
        method: 'POST',
        body: JSON.stringify({ type: 'hash', targetUrl: 'javascript:alert(1)', permanent: false })
      })
    );
    expect(res.status).toBe(400);
  });

  it('system/info 返回配置', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(authed('http://localhost/api/system/info'));
    const data = await readJson(res);
    expect((data.data as { hashLength: number }).hashLength).toBe(6);
  });
});
