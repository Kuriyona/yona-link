import { Elysia } from 'elysia';

import type { AppConfig } from '../../config';
import type { Db } from '../../db/client';
import { ApiError } from '../../errors';
import {
  createLink,
  deleteLink,
  getLinkByCode,
  listAllLinks,
  listLinks,
  type ListLinksParams,
  updateLink
} from '../../services/link-service';
import { type LinkType, PERMISSIONS } from '../../types';
import type { AuthContext } from '../auth';
import { createAuthPlugin, permissionGuard } from '../auth';

const CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function serializeLink(
  link: {
    code: string;
    type: string;
    targetUrl: string;
    permanent: boolean;
    expiresAt: string | null;
    status: string;
    retiredAt: string | null;
    clickCount: number;
    lastClickedAt: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: number | null;
    creatorUsername?: string | null;
  },
  config: AppConfig
) {
  const prefix = config.publicLinkDomain ? config.publicLinkDomain.replace(/\/$/, '') : null;
  return {
    code: link.code,
    type: link.type,
    shortUrl: prefix ? `${prefix}/${link.type === 'alias' ? '@' : ''}${link.code}` : null,
    targetUrl: link.targetUrl,
    permanent: link.permanent,
    expiresAt: link.expiresAt,
    status: link.status,
    retiredAt: link.retiredAt,
    clickCount: link.clickCount,
    lastClickedAt: link.lastClickedAt,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    createdById: link.createdBy,
    createdBy: link.creatorUsername ?? null
  };
}

function canAccess(auth: AuthContext, link: { createdBy: number | null }): boolean {
  return auth.role === 'admin' || link.createdBy === auth.userId;
}

function parseCreateBody(body: unknown): {
  type: LinkType;
  code?: string;
  targetUrl: string;
  permanent: boolean;
  expiresAt: string | null;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.type !== 'hash' && b.type !== 'alias') {
    throw new ApiError(400, 'type 必须为 hash 或 alias', 'invalid_type');
  }
  if (typeof b.targetUrl !== 'string' || !isValidHttpUrl(b.targetUrl)) {
    throw new ApiError(400, 'targetUrl 必须是合法的 http/https URL', 'invalid_url');
  }
  let expiresAt: string | null = null;
  if (typeof b.expiresAt === 'string' && b.expiresAt) {
    const time = Date.parse(b.expiresAt);
    if (Number.isNaN(time)) throw new ApiError(400, 'expiresAt 不是合法的日期', 'invalid_date');
    expiresAt = new Date(time).toISOString();
  }
  let code: string | undefined;
  if (b.type === 'alias') {
    if (typeof b.code !== 'string' || !CODE_PATTERN.test(b.code)) {
      throw new ApiError(400, 'code 必须匹配 [a-zA-Z0-9_-] 且长度不超过 64', 'invalid_code');
    }
    code = b.code;
  }
  return {
    type: b.type,
    code,
    targetUrl: b.targetUrl,
    permanent: b.permanent === true,
    expiresAt
  };
}

function parseListQuery(query: Record<string, unknown>): ListLinksParams {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.pageSize ?? '20'), 10) || 20)
  );
  const type =
    query.type === 'alias' || query.type === 'hash' ? (query.type as LinkType) : undefined;
  const status =
    query.status === 'active' || query.status === 'retired'
      ? (query.status as 'active' | 'retired')
      : undefined;
  const q = typeof query.q === 'string' && query.q.trim() ? query.q.trim() : undefined;
  return { page, pageSize, type, status, q };
}

export function createLinksRouter(db: Db, config: AppConfig) {
  return new Elysia({ prefix: '/links' })
    .use(createAuthPlugin(db))
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.LINKS_READ) }, (app) =>
      app
        .get('/', async ({ query, auth }) => {
          const params = parseListQuery(query as Record<string, unknown>);
          const result = await listLinks(db, params, auth!.userId);
          return {
            ok: true,
            data: {
              items: result.items.map((link) => serializeLink(link, config)),
              total: result.total,
              page: params.page,
              pageSize: params.pageSize
            }
          };
        })
        .get('/all', async ({ query, auth }) => {
          if (auth!.role !== 'admin') {
            throw new ApiError(403, '缺少权限: links:view_all', 'forbidden');
          }
          const params = parseListQuery(query as Record<string, unknown>);
          const createdById = Number.parseInt(String(query.userId ?? ''), 10) || undefined;
          const result = await listAllLinks(db, params, createdById);
          return {
            ok: true,
            data: {
              items: result.items.map(({ link, creatorUsername }) =>
                serializeLink({ ...link, creatorUsername }, config)
              ),
              total: result.total,
              page: params.page,
              pageSize: params.pageSize
            }
          };
        })
        .get('/:code', async ({ params, auth }) => {
          const link = await getLinkByCode(db, params.code);
          if (!link || !canAccess(auth!, link)) throw new ApiError(404, '链接不存在', 'not_found');
          return { ok: true, data: serializeLink(link, config) };
        })
    )
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.LINKS_STATS) }, (app) =>
      app.get('/:code/stats', async ({ params, auth }) => {
        const link = await getLinkByCode(db, params.code);
        if (!link || !canAccess(auth!, link)) throw new ApiError(404, '链接不存在', 'not_found');
        return {
          ok: true,
          data: {
            code: link.code,
            shortUrl: serializeLink(link, config).shortUrl,
            clickCount: link.clickCount,
            lastClickedAt: link.lastClickedAt
          }
        };
      })
    )
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.LINKS_CREATE) }, (app) =>
      app.post('/', async ({ body, auth, set }) => {
        const input = parseCreateBody(body);
        const link = await createLink(
          db,
          {
            type: input.type,
            code: input.code,
            targetUrl: input.targetUrl,
            permanent: input.permanent,
            expiresAt: input.expiresAt,
            createdBy: auth!.userId
          },
          { hashLength: config.hashLength }
        );
        set.status = 201;
        return { ok: true, data: serializeLink(link, config) };
      })
    )
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.LINKS_UPDATE) }, (app) =>
      app.patch('/:code', async ({ params, body, auth }) => {
        const existing = await getLinkByCode(db, params.code);
        if (!existing || !canAccess(auth!, existing)) {
          throw new ApiError(404, '链接不存在', 'not_found');
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const patch: { targetUrl?: string; permanent?: boolean; expiresAt?: string | null } = {};
        if (typeof b.targetUrl === 'string') {
          if (!isValidHttpUrl(b.targetUrl)) {
            throw new ApiError(400, 'targetUrl 必须是合法的 http/https URL', 'invalid_url');
          }
          patch.targetUrl = b.targetUrl;
        }
        if (typeof b.permanent === 'boolean') patch.permanent = b.permanent;
        if (b.permanent !== true && typeof b.expiresAt === 'string' && b.expiresAt) {
          const time = Date.parse(b.expiresAt);
          if (Number.isNaN(time))
            throw new ApiError(400, 'expiresAt 不是合法的日期', 'invalid_date');
          patch.expiresAt = new Date(time).toISOString();
        }
        if (Object.keys(patch).length === 0) {
          throw new ApiError(400, '没有可更新的字段', 'empty_update');
        }
        const link = await updateLink(db, params.code, patch);
        return { ok: true, data: serializeLink(link, config) };
      })
    )
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.LINKS_DELETE) }, (app) =>
      app.delete('/:code', async ({ params, auth }) => {
        const existing = await getLinkByCode(db, params.code);
        if (!existing || !canAccess(auth!, existing)) {
          throw new ApiError(404, '链接不存在', 'not_found');
        }
        const link = await deleteLink(db, params.code);
        return { ok: true, data: serializeLink(link, config) };
      })
    );
}
