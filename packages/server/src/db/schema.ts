import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { LinkStatus, LinkType } from '../types';

export const links = sqliteTable(
  'links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(),
    type: text('type').notNull().$type<LinkType>(),
    targetUrl: text('target_url').notNull(),
    permanent: integer('permanent', { mode: 'boolean' }).notNull().default(false),
    expiresAt: text('expires_at'),
    status: text('status').notNull().$type<LinkStatus>().default('active'),
    retiredAt: text('retired_at'),
    clickCount: integer('click_count').notNull().default(0),
    lastClickedAt: text('last_clicked_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [index('idx_links_status_retired').on(table.status, table.retiredAt)]
);

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  permissions: text('permissions').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  lastUsedAt: text('last_used_at')
});

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
