import type { AppConfig } from '../src/config';
import { createDb, type Db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { createLinkApp } from '../src/link';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    defaultRedirectUrl: 'https://default.example.com',
    publicLinkDomain: null,
    hashLength: 6,
    retentionDays: 7,
    adminKey: 'test-admin-key',
    databasePath: ':memory:',
    apiKeyPrefix: 'yl_',
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

export function createLinkAppWithDb(db: Db, overrides: Partial<AppConfig> = {}) {
  return createLinkApp(db, testConfig(overrides));
}
