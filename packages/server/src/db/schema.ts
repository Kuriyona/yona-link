import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { LinkStatus, LinkType, UserRole } from '../types';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().$type<UserRole>().default('user'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastLoginAt: text('last_login_at')
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  lastUsedAt: text('last_used_at')
});

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
    updatedAt: text('updated_at').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => [index('idx_links_status_retired').on(table.status, table.retiredAt)]
);

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
