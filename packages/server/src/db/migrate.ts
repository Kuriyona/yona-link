import { resolve } from 'node:path';

import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { createDb, type Db } from './client';

const DEFAULT_MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

export function runMigrations(db: Db, migrationsFolder: string = DEFAULT_MIGRATIONS_FOLDER): void {
  migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  const databasePath = Bun.env.DATABASE_PATH ?? resolve(process.cwd(), 'data/yona-link.db');
  const db = createDb(databasePath);
  runMigrations(db, Bun.env.MIGRATIONS_FOLDER);
  db.$client.close();
  console.log('[Yona-Link] 数据库迁移完成');
}
