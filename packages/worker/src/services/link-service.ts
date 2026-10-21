import { and, desc, eq, like, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { links, users } from '../db/schema';
import { ApiError } from '../errors';
import { isReservedPath, type LinkType } from '../types';
import { generateHash } from './hash-service';

const MAX_HASH_ATTEMPTS = 10;

export interface CreateLinkInput {
  type: LinkType;
  code?: string | null;
  targetUrl: string;
  permanent: boolean;
  expiresAt?: string | null;
  createdBy?: number | null;
}

export interface UpdateLinkInput {
  targetUrl?: string;
  permanent?: boolean;
  expiresAt?: string | null;
}

export interface ListLinksParams {
  page: number;
  pageSize: number;
  type?: LinkType;
  status?: 'active' | 'retired';
  q?: string;
}

export type ResolveResult =
  | { kind: 'redirect'; targetUrl: string; permanent: boolean }
  | { kind: 'retired' }
  | { kind: 'not_found' };

export async function cleanupRetired(db: Db, retentionDays: number, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - retentionDays * 86_400_000).toISOString();
  await db.delete(links).where(and(eq(links.status, 'retired'), lt(links.retiredAt, cutoff)));
}

async function findCode(db: Db, code: string) {
  const [row] = await db.select({ id: links.id }).from(links).where(eq(links.code, code)).all();
  return row;
}

async function generateUniqueHash(db: Db, length: number): Promise<string> {
  const seen = new Set<string>();
  for (let i = 0; i < MAX_HASH_ATTEMPTS; i++) {
    const code = generateHash(length);
    if (seen.has(code) || isReservedPath(code)) continue;
    seen.add(code);
    const existing = await findCode(db, code);
    if (!existing) return code;
  }
  throw new ApiError(500, '无法生成唯一短链 hash', 'hash_exhausted');
}

export async function createLink(
  db: Db,
  input: CreateLinkInput,
  opts: { hashLength: number }
): Promise<typeof links.$inferSelect> {
  const now = new Date().toISOString();
  const code = input.type === 'alias' ? input.code : await generateUniqueHash(db, opts.hashLength);

  if (!code) throw new ApiError(400, '自定义链接必须提供 code', 'invalid_alias');
  if (isReservedPath(code)) {
    throw new ApiError(400, `code 为保留路径，不能使用: ${code}`, 'reserved_path');
  }

  const existing = await findCode(db, code);
  if (existing) {
    throw new ApiError(409, `链接 code 已存在或处于保留期: ${code}`, 'code_conflict');
  }

  const [inserted] = await db
    .insert(links)
    .values({
      code,
      type: input.type,
      targetUrl: input.targetUrl,
      permanent: input.permanent,
      expiresAt: input.permanent ? null : (input.expiresAt ?? null),
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy ?? null
    })
    .returning()
    .all();
  return inserted!;
}

export async function getLinkByCode(db: Db, code: string) {
  const [link] = await db.select().from(links).where(eq(links.code, code)).all();
  return link;
}

export async function listLinks(
  db: Db,
  params: ListLinksParams,
  ownerId?: number
): Promise<{ items: (typeof links.$inferSelect)[]; total: number }> {
  const conditions = [];
  if (params.type) conditions.push(eq(links.type, params.type));
  if (params.status) conditions.push(eq(links.status, params.status));
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(or(like(links.code, pattern), like(links.targetUrl, pattern)));
  }
  if (ownerId !== undefined) conditions.push(eq(links.createdBy, ownerId));

  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(links)
    .where(where)
    .all();
  const items = await db
    .select()
    .from(links)
    .where(where)
    .orderBy(desc(links.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)
    .all();

  return { items, total: totalRow?.n ?? 0 };
}

export async function listAllLinks(
  db: Db,
  params: ListLinksParams,
  createdById?: number
): Promise<{
  items: { link: typeof links.$inferSelect; creatorUsername: string | null }[];
  total: number;
}> {
  const conditions = [];
  if (params.type) conditions.push(eq(links.type, params.type));
  if (params.status) conditions.push(eq(links.status, params.status));
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(or(like(links.code, pattern), like(links.targetUrl, pattern)));
  }
  if (createdById !== undefined) conditions.push(eq(links.createdBy, createdById));

  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(links)
    .where(where)
    .all();
  const rows = await db
    .select({ link: links, creatorUsername: users.username })
    .from(links)
    .leftJoin(users, eq(links.createdBy, users.id))
    .where(where)
    .orderBy(desc(links.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)
    .all();

  return { items: rows, total: totalRow?.n ?? 0 };
}

export async function updateLink(
  db: Db,
  code: string,
  patch: UpdateLinkInput
): Promise<typeof links.$inferSelect> {
  const link = await getLinkByCode(db, code);
  if (!link) throw new ApiError(404, '链接不存在', 'not_found');
  if (link.status === 'retired') throw new ApiError(410, '链接已失效，处于保留期', 'retired');

  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.targetUrl !== undefined) data.targetUrl = patch.targetUrl;
  if (patch.permanent !== undefined) data.permanent = patch.permanent;
  if (patch.permanent === true) data.expiresAt = null;
  else if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt;

  const [row] = await db.update(links).set(data).where(eq(links.code, code)).returning().all();
  return row!;
}

export async function deleteLink(db: Db, code: string): Promise<typeof links.$inferSelect> {
  const link = await getLinkByCode(db, code);
  if (!link) throw new ApiError(404, '链接不存在', 'not_found');
  if (link.status === 'retired') throw new ApiError(410, '链接已处于保留期', 'retired');

  const now = new Date().toISOString();
  const [row] = await db
    .update(links)
    .set({ status: 'retired', retiredAt: now, updatedAt: now })
    .where(eq(links.code, code))
    .returning()
    .all();
  return row!;
}

export async function resolveForRedirect(
  db: Db,
  code: string,
  expectedType: LinkType,
  nowIso: string
): Promise<ResolveResult> {
  const link = await getLinkByCode(db, code);
  if (!link || link.type !== expectedType) return { kind: 'not_found' };
  if (link.status === 'retired') return { kind: 'retired' };
  if (!link.permanent && link.expiresAt && link.expiresAt <= nowIso) {
    await db
      .update(links)
      .set({ status: 'retired', retiredAt: nowIso, updatedAt: nowIso })
      .where(eq(links.code, code));
    return { kind: 'retired' };
  }
  await db
    .update(links)
    .set({ clickCount: sql`${links.clickCount} + 1`, lastClickedAt: nowIso })
    .where(eq(links.code, code));
  return { kind: 'redirect', targetUrl: link.targetUrl, permanent: link.permanent };
}
