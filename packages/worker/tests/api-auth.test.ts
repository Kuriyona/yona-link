import { beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_PERMISSIONS, USER_PERMISSIONS } from '../src/types';
import { app, authed, env, loginAs, loginCookie, seedAdmin, TEST_ADMIN } from './helpers';

beforeEach(seedAdmin);

async function readJson(res: Response) {
  return (await res.json()) as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string };
  };
}

function loginRequest(username: string, password: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  };
}

describe('api auth', () => {
  it('无 token 返回 401', async () => {
    const res = await app.request('/api/links', {}, env);
    expect(res.status).toBe(401);
  });

  it('无效 token 返回 401', async () => {
    const res = await app.request(
      '/api/links',
      { headers: { authorization: 'Bearer invalid' } },
      env
    );
    expect(res.status).toBe(401);
  });

  it('管理员登录成功返回 token 与全部权限', async () => {
    const res = await app.request(
      '/api/auth/login',
      loginRequest(TEST_ADMIN.username, TEST_ADMIN.password),
      env
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.data?.token).toBeTruthy();
    const user = data.data?.user as { role: string; permissions: string[] };
    expect(user.role).toBe('admin');
    expect(user.permissions).toEqual(ADMIN_PERMISSIONS);
  });

  it('登录写入 HttpOnly Cookie，Cookie 可鉴权', async () => {
    const res = await app.request(
      '/api/auth/login',
      loginRequest(TEST_ADMIN.username, TEST_ADMIN.password),
      env
    );
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('kl_session=');
    expect(setCookie.toLowerCase()).toContain('httponly');

    const cookie = setCookie.split(';')[0] ?? '';
    const verifyRes = await app.request('/api/auth/verify', { headers: { cookie } }, env);
    expect(verifyRes.status).toBe(200);
  });

  it('跨站 Origin 的登录请求被拒绝', async () => {
    const res = await app.request(
      'http://localhost/api/auth/login',
      {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        body: JSON.stringify({ username: TEST_ADMIN.username, password: TEST_ADMIN.password })
      },
      env
    );
    expect(res.status).toBe(403);
  });

  it('Cookie 写操作校验 Origin', async () => {
    const cookie = await loginCookie(TEST_ADMIN.username, TEST_ADMIN.password);
    const body = JSON.stringify({
      type: 'alias',
      code: 'cookie-csrf',
      targetUrl: 'https://example.com/csrf',
      permanent: true
    });

    const denied = await app.request(
      'http://localhost/api/links',
      {
        method: 'POST',
        headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' },
        body
      },
      env
    );
    expect(denied.status).toBe(403);

    const allowed = await app.request(
      'http://localhost/api/links',
      {
        method: 'POST',
        headers: { cookie, origin: 'http://localhost', 'content-type': 'application/json' },
        body
      },
      env
    );
    expect(allowed.status).toBe(201);
  });

  it('logout 同时清除 Cookie 与会话', async () => {
    const cookie = await loginCookie(TEST_ADMIN.username, TEST_ADMIN.password);
    const out = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } }, env);
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie') ?? '').toContain('kl_session=');

    const verifyRes = await app.request('/api/auth/verify', { headers: { cookie } }, env);
    expect(verifyRes.status).toBe(401);
  });

  it('密码错误返回 401', async () => {
    const res = await app.request(
      '/api/auth/login',
      loginRequest(TEST_ADMIN.username, 'wrong-password'),
      env
    );
    expect(res.status).toBe(401);
  });

  it('不存在的用户名返回 401', async () => {
    const res = await app.request('/api/auth/login', loginRequest('nobody', 'whatever-123'), env);
    expect(res.status).toBe(401);
  });

  it('登录后 verify 返回用户信息', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.request(
      '/api/auth/verify',
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.data?.username).toBe(TEST_ADMIN.username);
    expect(data.data?.role).toBe('admin');
  });

  it('logout 后 token 失效', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const out = await app.request(
      '/api/auth/logout',
      authed('/api/auth/logout', token, { method: 'POST' }),
      env
    );
    expect(out.status).toBe(200);
    const res = await app.request(
      '/api/auth/verify',
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(res.status).toBe(401);
  });

  it('普通用户权限为子集且不能访问用户管理', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const created = await app.request(
      '/api/users',
      authed('/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'alice', password: 'alice-password-1' })
      }),
      env
    );
    expect(created.status).toBe(201);

    const aliceToken = await loginAs('alice', 'alice-password-1');
    const verify = await app.request(
      '/api/auth/verify',
      { headers: { authorization: `Bearer ${aliceToken}` } },
      env
    );
    const data = await readJson(verify);
    expect(data.data?.role).toBe('user');
    expect(data.data?.permissions).toEqual(USER_PERMISSIONS);

    const users = await app.request(
      '/api/users',
      { headers: { authorization: `Bearer ${aliceToken}` } },
      env
    );
    expect(users.status).toBe(403);
  });

  it('被禁用用户无法登录，已有会话失效', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await app.request(
      '/api/users',
      authed('/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'bob', password: 'bob-password-1' })
      }),
      env
    );
    const bobToken = await loginAs('bob', 'bob-password-1');
    const listed = await app.request(
      '/api/users',
      { headers: { authorization: `Bearer ${adminToken}` } },
      env
    );
    const users = (await readJson(listed)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const bob = users.find((user) => user.username === 'bob');
    const disable = await app.request(
      `/api/users/${bob!.id}`,
      authed(`/api/users/${bob!.id}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false })
      }),
      env
    );
    expect(disable.status).toBe(200);

    const relogin = await app.request(
      '/api/auth/login',
      loginRequest('bob', 'bob-password-1'),
      env
    );
    expect(relogin.status).toBe(401);

    const verifyOld = await app.request(
      '/api/auth/verify',
      { headers: { authorization: `Bearer ${bobToken}` } },
      env
    );
    expect(verifyOld.status).toBe(401);
  });

  it('重置密码后旧密码失效', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    await app.request(
      '/api/users',
      authed('/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'carol', password: 'carol-password-1' })
      }),
      env
    );
    const listed = await app.request(
      '/api/users',
      { headers: { authorization: `Bearer ${adminToken}` } },
      env
    );
    const users = (await readJson(listed)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const carol = users.find((user) => user.username === 'carol');
    const reset = await app.request(
      `/api/users/${carol!.id}`,
      authed(`/api/users/${carol!.id}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ password: 'new-password-2' })
      }),
      env
    );
    expect(reset.status).toBe(200);

    expect(
      (await app.request('/api/auth/login', loginRequest('carol', 'carol-password-1'), env)).status
    ).toBe(401);
    expect(
      (await app.request('/api/auth/login', loginRequest('carol', 'new-password-2'), env)).status
    ).toBe(200);
  });

  it('不能禁用或删除管理员账号', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const listed = await app.request(
      '/api/users',
      { headers: { authorization: `Bearer ${adminToken}` } },
      env
    );
    const users = (await readJson(listed)).data as unknown as Array<{
      id: number;
      username: string;
    }>;
    const admin = users.find((user) => user.username === TEST_ADMIN.username);
    const disable = await app.request(
      `/api/users/${admin!.id}`,
      authed(`/api/users/${admin!.id}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false })
      }),
      env
    );
    expect(disable.status).toBe(400);
    const del = await app.request(
      `/api/users/${admin!.id}`,
      authed(`/api/users/${admin!.id}`, adminToken, { method: 'DELETE' }),
      env
    );
    expect(del.status).toBe(400);
  });

  it('删除用户后其链接保留但无创建者', async () => {
    const adminToken = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const created = await app.request(
      '/api/users',
      authed('/api/users', adminToken, {
        method: 'POST',
        body: JSON.stringify({ username: 'dave', password: 'dave-password-1' })
      }),
      env
    );
    const user = (await readJson(created)).data as { id: number };
    const daveToken = await loginAs('dave', 'dave-password-1');
    await app.request(
      '/api/links',
      authed('/api/links', daveToken, {
        method: 'POST',
        body: JSON.stringify({
          type: 'hash',
          targetUrl: 'https://example.com/dave',
          permanent: true
        })
      }),
      env
    );
    const del = await app.request(
      `/api/users/${user.id}`,
      authed(`/api/users/${user.id}`, adminToken, { method: 'DELETE' }),
      env
    );
    expect(del.status).toBe(200);
  });
});
