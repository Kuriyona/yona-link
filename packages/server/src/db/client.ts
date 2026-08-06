import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import * as schema from './schema';

export function createDb(databasePath: string) {
  if (databasePath !== ':memory:') {
    const dir = dirname(databasePath);
    if (dir && dir !== '.') {
      mkdirSync(dir, { recursive: true });
    }
  }
  const sqlite = new Database(databasePath, { create: true });
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;
