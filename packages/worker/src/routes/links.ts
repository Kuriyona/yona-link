import { Hono } from 'hono';

import type { AppConfig } from '../config';
import type { Db } from '../db/client';
import type { Link } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { readJsonObject } from '../http';
import type { AuthContext } from '../middleware/auth';
import { requirePermission } from '../middleware/auth';
import {
  createLink,
  deleteLink,
  getLinkByCode,
  listAllLinks,
  listLinks,
  type ListLinksParams,
  updateLink
} from '../services/link-service';
import { type LinkType, PERMISSIONS } from '../types';

const CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
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

function parseCreateBody(body: Record<string, unknown>): {
  type: LinkType;
  code?: string;
  targetUrl: string;
  permanent: boolean;
  expiresAt: string | null;
} {
  if (body.type !== 'hash' && body.type !== 'alias') {
    throw new ApiError(400, 'type 必须为 hash 或 alias', 'invalid_type');
  }
  if (typeof body.targetUrl !== 'string' || !isValidHttpUrl(body.targetUrl)) {
    throw new ApiError(400, 'targetUrl 必须是合法的 http/https URL', 'invalid_url');
  }
  let expiresAt: string | null = null;
  if (typeof body.expiresAt === 'string' && body.expiresAt) {
    const time = Date.parse(body.expiresAt);
    if (Number.isNaN(time)) throw new ApiError(400, 'expiresAt 不是合法的日期', 'invalid_date');
    expiresAt = new Date(time).toISOString();
  }
  let code: string | undefined;
  if (body.type === 'alias') {
    if (typeof body.code !== 'string' || !CODE_PATTERN.test(body.code)) {
      throw new ApiError(400, 'code 必须匹配 [a-zA-Z0-9_-] 且长度不超过 64', 'invalid_code');
    }
    code = body.code;
  }
  return {
    type: body.type,
    code,
    targetUrl: body.targetUrl,
    permanent: body.permanent === true,
    expiresAt
  };
}

function parseListQuery(query: Record<string, string | undefined>): ListLinksParams {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? '20', 10) || 20));
  const type = query.type === 'alias' || query.type === 'hash' ? query.type : undefined;
  const status = query.status === 'active' || query.status === 'retired' ? query.status : undefined;
  const q = query.q?.trim() || undefined;
  return { page, pageSize, type, status, q };
}

async function findAccessibleLink(db: Db, code: string, auth: AuthContext): Promise<Link> {
  const link = await getLinkByCode(db, code);
  if (!link || !canAccess(auth, link)) throw new ApiError(404, '链接不存在', 'not_found');
  return link;
}

export function createLinkRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get('/', requirePermission(PERMISSIONS.LINKS_READ), async (c) => {
    const config = c.get('config');
    const params = parseListQuery(c.req.query());
    const result = await listLinks(c.get('db'), params, c.get('auth')!.userId);
    return c.json({
      ok: true as const,
      data: {
        items: result.items.map((link) => serializeLink(link, config)),
        total: result.total,
        page: params.page,
        pageSize: params.pageSize
      }
    });
  });

  routes.get('/all', requirePermission(PERMISSIONS.LINKS_VIEW_ALL), async (c) => {
    const config = c.get('config');
    const params = parseListQuery(c.req.query());
    const createdById = Number.parseInt(c.req.query('userId') ?? '', 10) || undefined;
    const result = await listAllLinks(c.get('db'), params, createdById);
    return c.json({
      ok: true as const,
      data: {
        items: result.items.map(({ link, creatorUsername }) =>
          serializeLink({ ...link, creatorUsername }, config)
        ),
        total: result.total,
        page: params.page,
        pageSize: params.pageSize
      }
    });
  });

  routes.get('/:code/stats', requirePermission(PERMISSIONS.LINKS_STATS), async (c) => {
    const link = await findAccessibleLink(c.get('db'), c.req.param('code'), c.get('auth')!);
    return c.json({
      ok: true as const,
      data: {
        code: link.code,
        shortUrl: serializeLink(link, c.get('config')).shortUrl,
        clickCount: link.clickCount,
        lastClickedAt: link.lastClickedAt
      }
    });
  });

  routes.get('/:code', requirePermission(PERMISSIONS.LINKS_READ), async (c) => {
    const link = await findAccessibleLink(c.get('db'), c.req.param('code'), c.get('auth')!);
    return c.json({ ok: true as const, data: serializeLink(link, c.get('config')) });
  });

  routes.post('/', requirePermission(PERMISSIONS.LINKS_CREATE), async (c) => {
    const input = parseCreateBody(await readJsonObject(c.req.raw));
    const link = await createLink(
      c.get('db'),
      {
        type: input.type,
        code: input.code,
        targetUrl: input.targetUrl,
        permanent: input.permanent,
        expiresAt: input.expiresAt,
        createdBy: c.get('auth')!.userId
      },
      { hashLength: c.get('config').hashLength }
    );
    return c.json({ ok: true as const, data: serializeLink(link, c.get('config')) }, 201);
  });

  routes.patch('/:code', requirePermission(PERMISSIONS.LINKS_UPDATE), async (c) => {
    const db = c.get('db');
    const code = c.req.param('code');
    await findAccessibleLink(db, code, c.get('auth')!);
    const body = await readJsonObject(c.req.raw);
    const patch: { targetUrl?: string; permanent?: boolean; expiresAt?: string | null } = {};
    if (typeof body.targetUrl === 'string') {
      if (!isValidHttpUrl(body.targetUrl)) {
        throw new ApiError(400, 'targetUrl 必须是合法的 http/https URL', 'invalid_url');
      }
      patch.targetUrl = body.targetUrl;
    }
    if (typeof body.permanent === 'boolean') patch.permanent = body.permanent;
    if (body.permanent !== true && typeof body.expiresAt === 'string' && body.expiresAt) {
      const time = Date.parse(body.expiresAt);
      if (Number.isNaN(time)) throw new ApiError(400, 'expiresAt 不是合法的日期', 'invalid_date');
      patch.expiresAt = new Date(time).toISOString();
    }
    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, '没有可更新的字段', 'empty_update');
    }
    const link = await updateLink(db, code, patch);
    return c.json({ ok: true as const, data: serializeLink(link, c.get('config')) });
  });

  routes.delete('/:code', requirePermission(PERMISSIONS.LINKS_DELETE), async (c) => {
    const db = c.get('db');
    const code = c.req.param('code');
    await findAccessibleLink(db, code, c.get('auth')!);
    const link = await deleteLink(db, code);
    return c.json({ ok: true as const, data: serializeLink(link, c.get('config')) });
  });

  return routes;
}
