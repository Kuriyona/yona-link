import type { AppConfig } from '../src/config';
import { createDb, type Db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { createLinkApp } from '../src/link';
import { createApp } from '../src/app';
import { ensureAdminUser } from '../src/services/user-service';

export const TEST_ADMIN = { username: 'admin', password: 'test-admin-password' };

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    defaultRedirectUrl: 'https://default.example.com',
    publicLinkDomain: null,
    hashLength: 6,
    retentionDays: 7,
    adminUsername: TEST_ADMIN.username,
    adminPassword: TEST_ADMIN.password,
    databasePath: ':memory:',
    sessionTtlDays: 7,
    rateLimitMax: 120,
    response301ForPermanent: false,
    ...overrides
  };
}

export function createTestDb(): Db {
  const db = createDb(':memory:');
  runMigrations(db);
  return db;
}

export async function createAuthedTestDb(overrides: Partial<AppConfig> = {}): Promise<Db> {
  const db = createTestDb();
  await ensureAdminUser(db, testConfig(overrides));
  return db;
}

export async function loginAs(
  app: ReturnType<typeof createApp>,
  username: string,
  password: string
): Promise<string> {
  const res = await app.handle(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
  );
  const data = (await res.json()) as { data?: { token?: string } };
  return data.data?.token ?? '';
}

export function authed(url: string, token: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {})
    }
  });
}

export function createLinkAppWithDb(db: Db, overrides: Partial<AppConfig> = {}) {
  return createLinkApp(db, testConfig(overrides));
}
