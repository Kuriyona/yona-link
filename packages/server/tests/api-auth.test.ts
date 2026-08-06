import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { createApiKey } from '../src/services/key-service';
import { ALL_PERMISSIONS } from '../src/types';
import { createTestDb, testConfig } from './helpers';

const ADMIN = 'test-admin-key';

function createApiAppForTest() {
  const db = createTestDb();
  const app = createApp(db, testConfig());
  return { db, app };
}

async function readJson(res: Response) {
  return (await res.json()) as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string };
  };
}

function authed(url: string, key: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {})
    }
  });
}

describe('api auth & permissions', () => {
  it('无 Key 返回 401', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(new Request('http://localhost/api/links'));
    expect(res.status).toBe(401);
  });

  it('无效 Key 返回 401', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(
      new Request('http://localhost/api/links', {
        headers: { authorization: 'Bearer invalid-key' }
      })
    );
    expect(res.status).toBe(401);
  });

  it('管理员 verify 返回全权限', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(
      new Request('http://localhost/api/auth/verify', {
        headers: { authorization: `Bearer ${ADMIN}` }
      })
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.data?.kind).toBe('admin');
    expect(data.data?.permissions).toEqual(ALL_PERMISSIONS);
  });

  it('管理员可创建链接', async () => {
    const { app } = createApiAppForTest();
    const res = await app.handle(
      authed('http://localhost/api/links', ADMIN, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'abc',
          targetUrl: 'https://example.com',
          permanent: true
        })
      })
    );
    expect(res.status).toBe(201);
    const data = await readJson(res);
    expect((data.data as { code: string }).code).toBe('abc');
  });

  it('普通 Key 缺权限返回 403', async () => {
    const { db, app } = createApiAppForTest();
    const { rawKey } = await createApiKey(db, { name: 'limited', permissions: [] }, 'yl_');
    const res = await app.handle(
      new Request('http://localhost/api/links', { headers: { authorization: `Bearer ${rawKey}` } })
    );
    expect(res.status).toBe(403);
  });

  it('普通 Key 拥有权限可操作', async () => {
    const { db, app } = createApiAppForTest();
    const { rawKey } = await createApiKey(
      db,
      { name: 'writer', permissions: ['links:create', 'links:read'] },
      'yl_'
    );
    const created = await app.handle(
      authed('http://localhost/api/links', rawKey, {
        method: 'POST',
        body: JSON.stringify({
          type: 'hash',
          targetUrl: 'https://example.com/x',
          permanent: false
        })
      })
    );
    expect(created.status).toBe(201);

    const listed = await app.handle(
      new Request('http://localhost/api/links', { headers: { 'x-api-key': rawKey } })
    );
    expect(listed.status).toBe(200);
  });

  it('管理员可创建并删除 Key', async () => {
    const { app } = createApiAppForTest();
    const created = await app.handle(
      authed('http://localhost/api/keys', ADMIN, {
        method: 'POST',
        body: JSON.stringify({ name: 'tmp', permissions: ['links:read'] })
      })
    );
    expect(created.status).toBe(201);
    const createdData = await readJson(created);
    expect(createdData.data?.rawKey).toBeTruthy();

    const keys = await app.handle(
      new Request('http://localhost/api/keys', { headers: { authorization: `Bearer ${ADMIN}` } })
    );
    const keysData = await readJson(keys);
    expect(Array.isArray(keysData.data)).toBe(true);
    const keyList = keysData.data as unknown as Array<{ id: number }>;
    const first = keyList[0];
    if (!first) throw new Error('预期有 Key 记录');
    const id = first.id;

    const del = await app.handle(
      authed(`http://localhost/api/keys/${id}`, ADMIN, { method: 'DELETE' })
    );
    expect(del.status).toBe(200);
  });

  it('普通 Key 不能管理 Key', async () => {
    const { db, app } = createApiAppForTest();
    const { rawKey } = await createApiKey(
      db,
      { name: 'limited', permissions: ['links:read'] },
      'yl_'
    );
    const res = await app.handle(
      new Request('http://localhost/api/keys', { headers: { authorization: `Bearer ${rawKey}` } })
    );
    expect(res.status).toBe(403);
  });

  it('创建 Key 后可用该 Key 鉴权', async () => {
    const { db, app } = createApiAppForTest();
    const { rawKey } = await createApiKey(
      db,
      { name: 'reader', permissions: ['links:read'] },
      'yl_'
    );
    const res = await app.handle(
      new Request('http://localhost/api/auth/verify', {
        headers: { authorization: `Bearer ${rawKey}` }
      })
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.data?.permissions).toEqual(['links:read']);
  });
});
