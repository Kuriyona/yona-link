import { eq, sql } from 'drizzle-orm';

import type { AppConfig } from '../config';
import type { Db } from '../db/client';
import { links, sessions, users } from '../db/schema';
import { ApiError } from '../errors';

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/;
const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function validateUsername(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new ApiError(400, '用户名须为 2-32 位字母/数字/下划线/短横线', 'invalid_username');
  }
}

export function validatePassword(password: string): void {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `密码长度至少 ${MIN_PASSWORD_LENGTH} 位`, 'invalid_password');
  }
}

export async function ensureAdminUser(db: Db, config: AppConfig): Promise<void> {
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(config.adminPassword);
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, config.adminUsername))
    .get();
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: 'admin', enabled: true, updatedAt: now })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      username: config.adminUsername,
      passwordHash,
      role: 'admin',
      enabled: true,
      createdAt: now,
      updatedAt: now
    });
  }
  const admin = await db.select().from(users).where(eq(users.username, config.adminUsername)).get();
  if (!admin) return;
  await db
    .update(links)
    .set({ createdBy: admin.id })
    .where(sql`${links.createdBy} IS NULL`);
}

export async function getUserByUsername(db: Db, username: string) {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export async function getUserById(db: Db, id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function listUsers(db: Db) {
  return db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      enabled: users.enabled,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      linkCount: sql<number>`(select count(*) from ${links} where ${links.createdBy} = ${users.id})`
    })
    .from(users)
    .orderBy(users.createdAt);
}

export async function createUser(db: Db, input: { username: string; password: string }) {
  const username = input.username.trim();
  validateUsername(username);
  validatePassword(input.password);
  const existing = await getUserByUsername(db, username);
  if (existing) throw new ApiError(409, '用户名已存在', 'username_conflict');
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  return db
    .insert(users)
    .values({
      username,
      passwordHash,
      role: 'user',
      enabled: true,
      createdAt: now,
      updatedAt: now
    })
    .returning()
    .get();
}

export async function updateUser(
  db: Db,
  id: number,
  patch: { enabled?: boolean; password?: string },
  selfId: number
) {
  const existing = await getUserById(db, id);
  if (!existing) throw new ApiError(404, '用户不存在', 'not_found');
  if (existing.role === 'admin' && patch.enabled === false) {
    throw new ApiError(400, '不能禁用管理员账号', 'cannot_disable_admin');
  }
  if (patch.enabled === false && existing.id === selfId) {
    throw new ApiError(400, '不能禁用当前登录账号', 'self_operation');
  }
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.password !== undefined) {
    validatePassword(patch.password);
    data.passwordHash = await hashPassword(patch.password);
  }
  const row = await db.update(users).set(data).where(eq(users.id, id)).returning().get();
  await db.delete(sessions).where(eq(sessions.userId, id));
  return row;
}

export async function deleteUser(db: Db, id: number, selfId: number): Promise<void> {
  const existing = await getUserById(db, id);
  if (!existing) throw new ApiError(404, '用户不存在', 'not_found');
  if (existing.role === 'admin')
    throw new ApiError(400, '不能删除管理员账号', 'cannot_delete_admin');
  if (existing.id === selfId) throw new ApiError(400, '不能删除当前登录账号', 'self_operation');
  await db.update(links).set({ createdBy: null }).where(eq(links.createdBy, id));
  await db.delete(users).where(eq(users.id, id));
}
