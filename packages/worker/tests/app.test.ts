import { beforeEach, describe, expect, it } from 'vitest';

import { app, authed, env, loginAs, seedAdmin, TEST_ADMIN } from './helpers';

beforeEach(seedAdmin);

describe('merged app', () => {
  it('短链跳转与 API 共用同一实例', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const created = await app.request(
      '/api/links',
      authed('/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'hash',
          targetUrl: 'https://example.com/x',
          permanent: false
        })
      }),
      env
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { data: { code: string } };
    const redirected = await app.request(`/${body.data.code}`, {}, env);
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get('location')).toBe('https://example.com/x');
  });

  it('/api 为保留路径，返回 404 而非跳转', async () => {
    const res = await app.request('/api', {}, env);
    expect(res.status).toBe(404);
  });

  it('/api 子路径不会命中短链路由', async () => {
    const res = await app.request('/api/not-a-route', {}, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('not_found');
  });

  it('/health 返回健康检查', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
  });

  it('拒绝创建 code=api 的别名（保留路径）', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.request(
      '/api/links',
      authed('/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'api',
          targetUrl: 'https://example.com',
          permanent: false
        })
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('reserved_path');
  });

  it('拒绝创建 code=panel 的别名（保留路径）', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.request(
      '/api/links',
      authed('/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'Panel',
          targetUrl: 'https://example.com',
          permanent: false
        })
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('reserved_path');
  });

  it('拒绝创建 code=health 的别名（保留路径，忽略大小写）', async () => {
    const token = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.request(
      '/api/links',
      authed('/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'Health',
          targetUrl: 'https://example.com',
          permanent: false
        })
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});
