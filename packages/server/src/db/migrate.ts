import { resolve } from 'node:path';

import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import type { Db } from './client';

export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: resolve(import.meta.dir, '../../drizzle') });
}
