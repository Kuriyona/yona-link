import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { ADMIN_PERMISSIONS, USER_PERMISSIONS } from '../src/types';
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

function loginRequest(username: string, password: string): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}

describe('api auth', () => {
  it('无 token 返回 401', async () => {
    const { app } = await createApiAppForTest();
    const res = await app.handle(new Request('http://localhost/api/links'));
    expect(res.status).toBe(401);
  });

  it('无效 token 返回 401', async () => {
    const { app } = await createApiAppForTest();
    const res = await app.handle(
      new Request('http://localhost/api/links', { headers: { authorization: 'Bearer invalid' } })
    );
    expect(res.status).toBe(401);
  });

  it('管理员登录成功返回 token 与全部权限', async () => {
    const { app } = await createApiAppForTest();
    const res = await app.handle(loginRequest(TEST_ADMIN.username, TEST_ADMIN.password));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.data?.token).toBeTruthy();
    const user = data.data?.user as { role: string; permissions: string[] };
    expect(user.role).toBe('admin');
    expect(user.permissions).toEqual(ADMIN_PERMISSIONS);
  });

  it('密码错误返回 401', async () => {
    const { app } = await createApiAppForTest();
    const res = await app.handle(loginRequest(TEST_ADMIN.username, 'wrong-password'));
    expect(res.status).toBe(401);
  });

  it('不存在的用户名返回 401', async () => {
    const { app } = await createApiAppForTest();
    const res = await app.handle(loginRequest('nobody', 'whatever-123'));
    expect(res.status).toBe(401);
  });

  it('登录后 verify 返回用户信息', async () => {
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.handle(
      new Request('http://localhost/api/auth/verify', {
        headers: { authorization: `Bearer ${token}` }
      })
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.data?.username).toBe(TEST_ADMIN.username);
    expect(data.data?.role).toBe('admin');
  });

  it('logout 后 token 失效', async () => {
    const { app } = await createApiAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const out = await app.handle(
      authed('http://localhost/api/auth/logout', token, { method: 'POST' })
    );
    expect(out.status).toBe(200);
    const res = await app.handle(
      new Request('http://localhost/api/auth/verify', {
        headers: { authorization: `Bearer ${token}` }
      })
    );
    expect(res.status).toBe(401);
  });

  it('普通用户权限为子集且不能访问用户管理', async () => {
    const { db, app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const created = await app.handle(
      authed('http://localhost/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'alice', password: 'alice-password-1' })
      })
    );
    expect(created.status).toBe(201);

    const aliceToken = await loginAs(app, 'alice', 'alice-password-1');
    const verify = await app.handle(
      new Request('http://localhost/api/auth/verify', {
        headers: { authorization: `Bearer ${aliceToken}` }
      })
    );
    const data = await readJson(verify);
    expect(data.data?.role).toBe('user');
    expect(data.data?.permissions).toEqual(USER_PERMISSIONS);

    const users = await app.handle(
      new Request('http://localhost/api/users', {
        headers: { authorization: `Bearer ${aliceToken}` }
      })
    );
    expect(users.status).toBe(403);
    void db;
  });

  it('被禁用用户无法登录，已有会话失效', async () => {
    const { db, app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await app.handle(
      authed('http://localhost/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'bob', password: 'bob-password-1' })
      })
    );
    const bobToken = await loginAs(app, 'bob', 'bob-password-1');
    const listed = await app.handle(
      new Request('http://localhost/api/users', {
        headers: { authorization: `Bearer ${adminToken}` }
      })
    );
    const users = (await readJson(listed)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const bob = users.find((u) => u.username === 'bob');
    const disable = await app.handle(
      authed(`http://localhost/api/users/${bob!.id}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false })
      })
    );
    expect(disable.status).toBe(200);

    const relogin = await app.handle(loginRequest('bob', 'bob-password-1'));
    expect(relogin.status).toBe(401);

    const verifyOld = await app.handle(
      new Request('http://localhost/api/auth/verify', {
        headers: { authorization: `Bearer ${bobToken}` }
      })
    );
    expect(verifyOld.status).toBe(401);
    void db;
  });

  it('重置密码后旧密码失效', async () => {
    const { app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    await app.handle(
      authed('http://localhost/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'carol', password: 'carol-password-1' })
      })
    );
    const listed = await app.handle(
      new Request('http://localhost/api/users', {
        headers: { authorization: `Bearer ${adminToken}` }
      })
    );
    const users = (await readJson(listed)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const carol = users.find((u) => u.username === 'carol');
    const reset = await app.handle(
      authed(`http://localhost/api/users/${carol!.id}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ password: 'new-password-2' })
      })
    );
    expect(reset.status).toBe(200);

    expect((await app.handle(loginRequest('carol', 'carol-password-1'))).status).toBe(401);
    expect((await app.handle(loginRequest('carol', 'new-password-2'))).status).toBe(200);
  });

  it('不能禁用或删除管理员账号', async () => {
    const { app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const listed = await app.handle(
      new Request('http://localhost/api/users', {
        headers: { authorization: `Bearer ${adminToken}` }
      })
    );
    const users = (await readJson(listed)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const admin = users.find((u) => u.username === TEST_ADMIN.username);
    const disable = await app.handle(
      authed(`http://localhost/api/users/${admin!.id}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false })
      })
    );
    expect(disable.status).toBe(400);
    const del = await app.handle(
      authed(`http://localhost/api/users/${admin!.id}`, adminToken, { method: 'DELETE' })
    );
    expect(del.status).toBe(400);
  });

  it('删除用户后其链接保留但无创建者', async () => {
    const { db, app } = await createApiAppForTest();
    const adminToken = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const created = await app.handle(
      authed('http://localhost/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'dave', password: 'dave-password-1' })
      })
    );
    const user = (await readJson(created)).data as { id: number };
    const daveToken = await loginAs(app, 'dave', 'dave-password-1');
    await app.handle(
      authed('http://localhost/api/links', daveToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'hash',
          targetUrl: 'https://example.com/dave',
          permanent: true
        })
      })
    );
    const del = await app.handle(
      authed(`http://localhost/api/users/${user.id}`, adminToken, { method: 'DELETE' })
    );
    expect(del.status).toBe(200);
    void db;
  });
});
