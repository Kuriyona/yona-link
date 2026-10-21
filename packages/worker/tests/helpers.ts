import { env } from 'cloudflare:test';

import { app } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb } from '../src/db/client';
import { links, sessions, users } from '../src/db/schema';
import { ensureAdminUser } from '../src/services/user-service';

export const TEST_ADMIN = { username: 'admin', password: 'test-admin-password' };

export { app, env };

export function testConfig() {
  return loadConfig(env);
}

// Vitest 4 的 Workers 集成按测试文件隔离存储，同文件内需手动清空。
export async function resetDb(): Promise<void> {
  const db = createDb(env.DB);
  await db.delete(links);
  await db.delete(sessions);
  await db.delete(users);
}

export async function seedAdmin(): Promise<void> {
  await resetDb();
  await ensureAdminUser(createDb(env.DB), testConfig());
}

export async function loginAs(username: string, password: string): Promise<string> {
  const res = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    },
    env
  );
  const data = (await res.json()) as { data?: { token?: string } };
  return data.data?.token ?? '';
}

export async function loginCookie(username: string, password: string): Promise<string> {
  const res = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    },
    env
  );
  return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

export function authed(path: string, token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {})
    }
  };
}

export function createLinkRequest(
  token: string,
  body: Record<string, unknown>
): [string, RequestInit] {
  return [
    '/api/links',
    authed('/api/links', token, { method: 'POST', body: JSON.stringify(body) })
  ];
}
