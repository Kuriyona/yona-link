import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { authed, createAuthedTestDb, loginAs, TEST_ADMIN, testConfig } from './helpers';

function createApiAppForTest() {
  return createAuthedTestDb().then((db) => ({ db, app: createApp(db, testConfig()) }));
}

async function readJson(res: Response) {
  return (await res.json()) as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string };
  };
}

async function createUser(
  app: ReturnType<typeof createApp>,
  adminToken: string,
  username: string,
  password: string
) {
  const res = await app.handle(
    authed('http://localhost/api/users', adminToken, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  );
  return (await readJson(res)).data as { id: number };
}

describe('links api', () => {
  it('创建 hash 链接并展示短链', async () => {
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.handle(
      authed('http://localhost/api/links', token, {
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
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const body = JSON.stringify({
      type: 'alias',
      code: 'dup',
      targetUrl: 'https://example.com',
      permanent: false
    });
    await app.handle(authed('http://localhost/api/links', token, { method: 'POST', body }));
    const res = await app.handle(
      authed('http://localhost/api/links', token, { method: 'POST', body })
    );
    expect(res.status).toBe(409);
  });

  it('用户列表只包含自己的链接', async () => {
    const { app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(app, adminToken, 'alice', 'alice-password-1');
    await createUser(app, adminToken, 'bob', 'bob-password-1');
    const aliceToken = await loginAs(app, 'alice', 'alice-password-1');
    const bobToken = await loginAs(app, 'bob', 'bob-password-1');

    await app.handle(
      authed('http://localhost/api/links', aliceToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'a1',
          targetUrl: 'https://example.com/a1',
          permanent: true
        })
      })
    );
    await app.handle(
      authed('http://localhost/api/links', bobToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'b1',
          targetUrl: 'https://example.com/b1',
          permanent: true
        })
      })
    );

    const aliceList = await app.handle(
      new Request('http://localhost/api/links', {
        headers: { authorization: `Bearer ${aliceToken}` }
      })
    );
    const aliceData = await readJson(aliceList);
    expect(aliceData.data?.total).toBe(1);
    const items = aliceData.data?.items as Array<{ code: string }>;
    expect(items[0]?.code).toBe('a1');

    const bobList = await app.handle(
      new Request('http://localhost/api/links', {
        headers: { authorization: `Bearer ${bobToken}` }
      })
    );
    const bobData = await readJson(bobList);
    expect(bobData.data?.total).toBe(1);
    expect((bobData.data?.items as Array<{ code: string }>)[0]?.code).toBe('b1');
  });

  it('用户不能查看/编辑/删除他人链接', async () => {
    const { app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(app, adminToken, 'alice', 'alice-password-1');
    await createUser(app, adminToken, 'bob', 'bob-password-1');
    const aliceToken = await loginAs(app, 'alice', 'alice-password-1');
    const bobToken = await loginAs(app, 'bob', 'bob-password-1');

    await app.handle(
      authed('http://localhost/api/links', aliceToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'owned',
          targetUrl: 'https://example.com/x',
          permanent: true
        })
      })
    );

    const get = await app.handle(
      new Request('http://localhost/api/links/owned', {
        headers: { authorization: `Bearer ${bobToken}` }
      })
    );
    expect(get.status).toBe(404);

    const patch = await app.handle(
      authed('http://localhost/api/links/owned', bobToken, {
        method: 'PATCH',
        body: JSON.stringify({ targetUrl: 'https://example.com/hack' })
      })
    );
    expect(patch.status).toBe(404);

    const del = await app.handle(
      authed('http://localhost/api/links/owned', bobToken, { method: 'DELETE' })
    );
    expect(del.status).toBe(404);
  });

  it('管理员可通过 /links/all 查看全部并按用户筛选', async () => {
    const { app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(app, adminToken, 'alice', 'alice-password-1');
    await createUser(app, adminToken, 'bob', 'bob-password-1');
    const aliceToken = await loginAs(app, 'alice', 'alice-password-1');
    const bobToken = await loginAs(app, 'bob', 'bob-password-1');

    await app.handle(
      authed('http://localhost/api/links', aliceToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'from-alice',
          targetUrl: 'https://example.com/a',
          permanent: true
        })
      })
    );
    await app.handle(
      authed('http://localhost/api/links', bobToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'from-bob',
          targetUrl: 'https://example.com/b',
          permanent: true
        })
      })
    );

    const all = await app.handle(
      new Request('http://localhost/api/links/all', {
        headers: { authorization: `Bearer ${adminToken}` }
      })
    );
    expect(all.status).toBe(200);
    const allData = await readJson(all);
    const items = allData.data?.items as Array<{ code: string; createdBy: string | null }>;
    expect(allData.data?.total).toBe(2);
    expect(items.map((i) => i.code).sort()).toEqual(['from-alice', 'from-bob']);
    expect(items.some((i) => i.createdBy === 'alice')).toBe(true);

    const users = await app.handle(
      new Request('http://localhost/api/users', {
        headers: { authorization: `Bearer ${adminToken}` }
      })
    );
    const userRows = (await readJson(users)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const alice = userRows.find((u) => u.username === 'alice')!;
    const filtered = await app.handle(
      new Request(`http://localhost/api/links/all?userId=${alice.id}`, {
        headers: { authorization: `Bearer ${adminToken}` }
      })
    );
    const filteredData = await readJson(filtered);
    expect(filteredData.data?.total).toBe(1);
    expect((filteredData.data?.items as Array<{ code: string }>)[0]?.code).toBe('from-alice');
  });

  it('普通用户访问 /links/all 返回 403', async () => {
    const { app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(app, adminToken, 'alice', 'alice-password-1');
    const aliceToken = await loginAs(app, 'alice', 'alice-password-1');
    const res = await app.handle(
      new Request('http://localhost/api/links/all', {
        headers: { authorization: `Bearer ${aliceToken}` }
      })
    );
    expect(res.status).toBe(403);
  });

  it('详情、统计、更新、删除', async () => {
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await app.handle(
      authed('http://localhost/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'stats1',
          targetUrl: 'https://example.com/s',
          permanent: false
        })
      })
    );
    const detail = await app.handle(authed('http://localhost/api/links/stats1', token));
    expect(detail.status).toBe(200);
    const detailData = await readJson(detail);
    expect((detailData.data as { code: string }).code).toBe('stats1');

    const stats = await app.handle(authed('http://localhost/api/links/stats1/stats', token));
    const statsData = await readJson(stats);
    expect((statsData.data as { clickCount: number }).clickCount).toBe(0);

    const upd = await app.handle(
      authed('http://localhost/api/links/stats1', token, {
        method: 'PATCH',
        body: JSON.stringify({ targetUrl: 'https://example.com/new', permanent: true })
      })
    );
    expect(upd.status).toBe(200);
    expect((await readJson(upd)).data?.targetUrl).toBe('https://example.com/new');

    const del = await app.handle(
      authed('http://localhost/api/links/stats1', token, { method: 'DELETE' })
    );
    expect(del.status).toBe(200);
  });

  it('非法 URL 返回 400', async () => {
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.handle(
      authed('http://localhost/api/links', token, {
        method: 'POST',
        body: JSON.stringify({ type: 'hash', targetUrl: 'javascript:alert(1)', permanent: false })
      })
    );
    expect(res.status).toBe(400);
  });

  it('system/info 返回配置与用户数', async () => {
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.handle(authed('http://localhost/api/system/info', token));
    const data = await readJson(res);
    expect((data.data as { hashLength: number }).hashLength).toBe(6);
    expect((data.data as { userCount: number }).userCount).toBe(1);
  });
});
