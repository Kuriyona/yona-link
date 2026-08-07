import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { authed, createAuthedTestDb, loginAs, TEST_ADMIN, testConfig } from './helpers';

function createAppForTest() {
  return createAuthedTestDb().then((db) => ({ db, app: createApp(db, testConfig()) }));
}

describe('merged app', () => {
  it('短链跳转与 API 共用同一实例', async () => {
    const { app } = await createAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const created = await app.handle(
      authed('http://localhost/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'hash',
          targetUrl: 'https://example.com/x',
          permanent: false
        })
      })
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { data: { code: string } };
    const redirected = await app.handle(new Request(`http://localhost/${body.data.code}`));
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get('location')).toBe('https://example.com/x');
  });

  it('/api 为保留路径，返回 404 而非跳转', async () => {
    const { app } = await createAppForTest();
    const res = await app.handle(new Request('http://localhost/api'));
    expect(res.status).toBe(404);
  });

  it('/api 子路径不会命中短链路由', async () => {
    const { app } = await createAppForTest();
    const res = await app.handle(new Request('http://localhost/api/not-a-route'));
    expect(res.status).toBe(404);
  });

  it('/health 返回健康检查', async () => {
    const { app } = await createAppForTest();
    const res = await app.handle(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
  });

  it('拒绝创建 code=api 的别名（保留路径）', async () => {
    const { app } = await createAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.handle(
      authed('http://localhost/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'api',
          targetUrl: 'https://example.com',
          permanent: false
        })
      })
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('reserved_path');
  });

  it('拒绝创建 code=health 的别名（保留路径，忽略大小写）', async () => {
    const { app } = await createAppForTest();
    const token = await loginAs(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const res = await app.handle(
      authed('http://localhost/api/links', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'alias',
          code: 'Health',
          targetUrl: 'https://example.com',
          permanent: false
        })
      })
    );
    expect(res.status).toBe(400);
  });
});
