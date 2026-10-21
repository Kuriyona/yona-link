import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { readJsonObject } from '../http';
import { requirePermission } from '../middleware/auth';
import { createUser, deleteUser, listUsers, updateUser } from '../services/user-service';
import { PERMISSIONS } from '../types';

export function createUserRoutes() {
  const routes = new Hono<AppEnv>();

  routes.use('*', requirePermission(PERMISSIONS.USERS_MANAGE));

  routes.get('/', async (c) => {
    return c.json({ ok: true as const, data: await listUsers(c.get('db')) });
  });

  routes.post('/', async (c) => {
    const body = await readJsonObject(c.req.raw);
    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      throw new ApiError(400, '必须提供 username 和 password', 'invalid_input');
    }
    const user = await createUser(c.get('db'), {
      username: body.username,
      password: body.password
    });
    return c.json(
      {
        ok: true as const,
        data: {
          id: user.id,
          username: user.username,
          role: user.role,
          enabled: user.enabled,
          createdAt: user.createdAt
        }
      },
      201
    );
  });

  routes.patch('/:id', async (c) => {
    const id = Number.parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) throw new ApiError(400, '无效的 id', 'invalid_id');
    const body = await readJsonObject(c.req.raw);
    const patch: { enabled?: boolean; password?: string } = {};
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (typeof body.password === 'string') patch.password = body.password;
    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, '没有可更新的字段', 'empty_update');
    }
    const user = await updateUser(c.get('db'), id, patch, c.get('auth')!.userId);
    return c.json({
      ok: true as const,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        enabled: user.enabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  });

  routes.delete('/:id', async (c) => {
    const id = Number.parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) throw new ApiError(400, '无效的 id', 'invalid_id');
    await deleteUser(c.get('db'), id, c.get('auth')!.userId);
    return c.json({ ok: true as const, data: { deleted: true } });
  });

  return routes;
}
