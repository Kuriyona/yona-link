import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { Db } from '../db/client';
import { apiKeys } from '../db/schema';
import { ApiError } from '../errors';
import { ALL_PERMISSIONS, type Permission } from '../types';

export function hashApiKey(raw: string): string {
  return Bun.CryptoHasher.hash('sha256', raw, 'hex');
}

export function generateApiKey(prefix: string): string {
  const token = randomBytes(24).toString('base64url');
  return `${prefix}${token}`;
}

export function normalizePermissions(perms: unknown): Permission[] {
  if (!Array.isArray(perms)) return [];
  return perms.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));
}

export function parsePermissions(raw: string): Permission[] {
  try {
    return normalizePermissions(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function createApiKey(
  db: Db,
  input: { name: string; permissions: Permission[] },
  prefix: string
): Promise<{ key: { id: number; permissions: Permission[]; enabled: boolean }; rawKey: string }> {
  const rawKey = generateApiKey(prefix);
  const now = new Date().toISOString();
  const row = await db
    .insert(apiKeys)
    .values({
      name: input.name,
      keyHash: hashApiKey(rawKey),
      permissions: JSON.stringify(normalizePermissions(input.permissions)),
      enabled: true,
      createdAt: now
    })
    .returning()
    .get();
  return {
    key: { id: row.id, permissions: parsePermissions(row.permissions), enabled: row.enabled },
    rawKey
  };
}

export async function listApiKeys(db: Db) {
  const rows = await db.select().from(apiKeys).orderBy(apiKeys.createdAt);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    permissions: parsePermissions(row.permissions),
    enabled: row.enabled,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt
  }));
}

export async function updateApiKey(
  db: Db,
  id: number,
  patch: { name?: string; permissions?: Permission[]; enabled?: boolean }
) {
  const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
  if (!existing) throw new ApiError(404, 'API Key 不存在', 'not_found');

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.permissions !== undefined)
    data.permissions = JSON.stringify(normalizePermissions(patch.permissions));
  if (patch.enabled !== undefined) data.enabled = patch.enabled;

  const rows = await db.update(apiKeys).set(data).where(eq(apiKeys.id, id)).returning();
  const row = rows[0];
  if (!row) throw new ApiError(500, '更新失败', 'update_failed');
  return {
    id: row.id,
    name: row.name,
    permissions: parsePermissions(row.permissions),
    enabled: row.enabled,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt
  };
}

export async function deleteApiKey(db: Db, id: number): Promise<void> {
  const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
  if (!existing) throw new ApiError(404, 'API Key 不存在', 'not_found');
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
}
