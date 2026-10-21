import { beforeEach, describe, expect, it } from 'vitest';

import { app, authed, env, loginAs, seedAdmin, TEST_ADMIN } from './helpers';

beforeEach(seedAdmin);

async function readJson(res: Response) {
  return (await res.json()) as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string };
  };
}

function request(path: string, token: string, init: RequestInit = {}) {
  return app.request(path, authed(path, token, init), env);
}

async function createUser(adminToken: string, username: string, password: string) {
  const res = await request('/api/users', adminToken, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  return (await readJson(res)).data as { id: number };
}

describe('links api', () => {
  it('创建 hash 链接并展示短链', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await request('/api/links', token, {
      method: 'POST',
      body: JSON.stringify({ type: 'hash', targetUrl: 'https://example.com/a', permanent: true })
    });
    expect(res.status).toBe(201);
    const data = await readJson(res);
    const link = data.data as { code: string; type: string; shortUrl: string | null };
    expect(link.code).toHaveLength(6);
    expect(link.type).toBe('hash');
    expect(link.shortUrl).toBeNull();
  });

  it('code 冲突返回 409', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const body = JSON.stringify({
      type: 'alias',
      code: 'dup',
      targetUrl: 'https://example.com',
      permanent: false
    });
    await request('/api/links', token, { method: 'POST', body });
    const res = await request('/api/links', token, { method: 'POST', body });
    expect(res.status).toBe(409);
  });

  it('用户列表只包含自己的链接', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(adminToken, 'alice', 'alice-password-1');
    await createUser(adminToken, 'bob', 'bob-password-1');
    const aliceToken = await loginAs('alice', 'alice-password-1');
    const bobToken = await loginAs('bob', 'bob-password-1');

    await request('/api/links', aliceToken, {
      method: 'POST',
      body: JSON.stringify({
        type: 'alias',
        code: 'a1',
        targetUrl: 'https://example.com/a1',
        permanent: true
      })
    });
    await request('/api/links', bobToken, {
      method: 'POST',
      body: JSON.stringify({
        type: 'alias',
        code: 'b1',
        targetUrl: 'https://example.com/b1',
        permanent: true
      })
    });

    const aliceData = await readJson(await request('/api/links', aliceToken));
    expect(aliceData.data?.total).toBe(1);
    expect((aliceData.data?.items as Array<{ code: string }>)[0]?.code).toBe('a1');

    const bobData = await readJson(await request('/api/links', bobToken));
    expect(bobData.data?.total).toBe(1);
    expect((bobData.data?.items as Array<{ code: string }>)[0]?.code).toBe('b1');
  });

  it('用户不能查看/编辑/删除他人链接', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(adminToken, 'alice', 'alice-password-1');
    await createUser(adminToken, 'bob', 'bob-password-1');
    const aliceToken = await loginAs('alice', 'alice-password-1');
    const bobToken = await loginAs('bob', 'bob-password-1');

    await request('/api/links', aliceToken, {
      method: 'POST',
      body: JSON.stringify({
        type: 'alias',
        code: 'owned',
        targetUrl: 'https://example.com/x',
        permanent: true
      })
    });

    expect((await request('/api/links/owned', bobToken)).status).toBe(404);
    expect(
      (
        await request('/api/links/owned', bobToken, {
          method: 'PATCH',
          body: JSON.stringify({ targetUrl: 'https://example.com/hack' })
        })
      ).status
    ).toBe(404);
    expect((await request('/api/links/owned', bobToken, { method: 'DELETE' })).status).toBe(404);
  });

  it('管理员可通过 /links/all 查看全部并按用户筛选', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(adminToken, 'alice', 'alice-password-1');
    await createUser(adminToken, 'bob', 'bob-password-1');
    const aliceToken = await loginAs('alice', 'alice-password-1');
    const bobToken = await loginAs('bob', 'bob-password-1');

    await request('/api/links', aliceToken, {
      method: 'POST',
      body: JSON.stringify({
        type: 'alias',
        code: 'from-alice',
        targetUrl: 'https://example.com/a',
        permanent: true
      })
    });
    await request('/api/links', bobToken, {
      method: 'POST',
      body: JSON.stringify({
        type: 'alias',
        code: 'from-bob',
        targetUrl: 'https://example.com/b',
        permanent: true
      })
    });

    const all = await request('/api/links/all', adminToken);
    expect(all.status).toBe(200);
    const allData = await readJson(all);
    const items = allData.data?.items as Array<{ code: string; createdBy: string | null }>;
    expect(allData.data?.total).toBe(2);
    expect(items.map((item) => item.code).sort()).toEqual(['from-alice', 'from-bob']);
    expect(items.some((item) => item.createdBy === 'alice')).toBe(true);

    const userRows = (await readJson(await request('/api/users', adminToken)))
      .data as unknown as Array<{ id: number; username: string }>;
    const alice = userRows.find((user) => user.username === 'alice')!;
    const filteredData = await readJson(
      await request(`/api/links/all?userId=${alice.id}`, adminToken)
    );
    expect(filteredData.data?.total).toBe(1);
    expect((filteredData.data?.items as Array<{ code: string }>)[0]?.code).toBe('from-alice');
  });

  it('普通用户访问 /links/all 返回 403', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await createUser(adminToken, 'alice', 'alice-password-1');
    const aliceToken = await loginAs('alice', 'alice-password-1');
    expect((await request('/api/links/all', aliceToken)).status).toBe(403);
  });

  it('详情、统计、更新、删除', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await request('/api/links', token, {
      method: 'POST',
      body: JSON.stringify({
        type: 'alias',
        code: 'stats1',
        targetUrl: 'https://example.com/s',
        permanent: false
      })
    });
    const detail = await request('/api/links/stats1', token);
    expect(detail.status).toBe(200);
    expect(((await readJson(detail)).data as { code: string }).code).toBe('stats1');

    const statsData = await readJson(await request('/api/links/stats1/stats', token));
    expect((statsData.data as { clickCount: number }).clickCount).toBe(0);

    const updated = await request('/api/links/stats1', token, {
      method: 'PATCH',
      body: JSON.stringify({ targetUrl: 'https://example.com/new', permanent: true })
    });
    expect(updated.status).toBe(200);
    expect((await readJson(updated)).data?.targetUrl).toBe('https://example.com/new');

    expect((await request('/api/links/stats1', token, { method: 'DELETE' })).status).toBe(200);
  });

  it('非法 URL 返回 400', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await request('/api/links', token, {
      method: 'POST',
      body: JSON.stringify({
        type: 'hash',
        targetUrl: 'javascript:alert(1)',
        permanent: false
      })
    });
    expect(res.status).toBe(400);
  });

  it('system/info 返回配置与用户数', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const data = await readJson(await request('/api/system/info', token));
    expect((data.data as { hashLength: number }).hashLength).toBe(6);
    expect((data.data as { userCount: number }).userCount).toBe(1);
  });
});
