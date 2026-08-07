import { Elysia } from 'elysia';

import type { Db } from '../../db/client';
import { ApiError } from '../../errors';
import { createUser, deleteUser, listUsers, updateUser } from '../../services/user-service';
import { PERMISSIONS } from '../../types';
import { createAuthPlugin, permissionGuard } from '../auth';

export function createUsersRouter(db: Db) {
  return new Elysia({ prefix: '/users' })
    .use(createAuthPlugin(db))
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.USERS_MANAGE) }, (app) =>
      app
        .get('/', async () => ({ ok: true, data: await listUsers(db) }))
        .post('/', async ({ body, set }) => {
          const b = (body ?? {}) as Record<string, unknown>;
          if (typeof b.username !== 'string' || typeof b.password !== 'string') {
            throw new ApiError(400, '必须提供 username 和 password', 'invalid_input');
          }
          const user = await createUser(db, { username: b.username, password: b.password });
          set.status = 201;
          return {
            ok: true,
            data: {
              id: user.id,
              username: user.username,
              role: user.role,
              enabled: user.enabled,
              createdAt: user.createdAt
            }
          };
        })
        .patch('/:id', async ({ params, body, auth }) => {
          const id = Number.parseInt(params.id, 10);
          if (Number.isNaN(id)) throw new ApiError(400, '无效的 id', 'invalid_id');
          const b = (body ?? {}) as Record<string, unknown>;
          const patch: { enabled?: boolean; password?: string } = {};
          if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
          if (typeof b.password === 'string') patch.password = b.password;
          if (Object.keys(patch).length === 0) {
            throw new ApiError(400, '没有可更新的字段', 'empty_update');
          }
          const user = await updateUser(db, id, patch, auth!.userId);
          return {
            ok: true,
            data: {
              id: user.id,
              username: user.username,
              role: user.role,
              enabled: user.enabled,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              lastLoginAt: user.lastLoginAt
            }
          };
        })
        .delete('/:id', async ({ params, auth }) => {
          const id = Number.parseInt(params.id, 10);
          if (Number.isNaN(id)) throw new ApiError(400, '无效的 id', 'invalid_id');
          await deleteUser(db, id, auth!.userId);
          return { ok: true, data: { deleted: true } };
        })
    );
}
