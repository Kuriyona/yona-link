import { Elysia } from 'elysia';

import type { AppConfig } from '../../config';
import type { Db } from '../../db/client';
import { ApiError } from '../../errors';
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  normalizePermissions,
  updateApiKey
} from '../../services/key-service';
import { PERMISSIONS, type Permission } from '../../types';
import { createAuthPlugin, permissionGuard } from '../auth';

export function createKeysRouter(db: Db, config: AppConfig) {
  return new Elysia({ prefix: '/keys' })
    .use(createAuthPlugin(db, config))
    .guard({ beforeHandle: permissionGuard(PERMISSIONS.KEYS_MANAGE) }, (app) =>
      app
        .get('/', async () => {
          return { ok: true, data: await listApiKeys(db) };
        })
        .post('/', async ({ body, set }) => {
          const b = (body ?? {}) as Record<string, unknown>;
          if (typeof b.name !== 'string' || !b.name.trim()) {
            throw new ApiError(400, 'name 不能为空', 'invalid_name');
          }
          const permissions = normalizePermissions(b.permissions);
          const result = await createApiKey(
            db,
            { name: b.name.trim(), permissions },
            config.apiKeyPrefix
          );
          set.status = 201;
          return { ok: true, data: { key: result.key, rawKey: result.rawKey } };
        })
        .patch('/:id', async ({ params, body, auth }) => {
          const id = Number.parseInt(params.id, 10);
          if (Number.isNaN(id)) throw new ApiError(400, '无效的 id', 'invalid_id');
          const b = (body ?? {}) as Record<string, unknown>;
          const patch: { name?: string; permissions?: Permission[]; enabled?: boolean } = {};
          if (b.name !== undefined) {
            if (typeof b.name !== 'string' || !b.name.trim()) {
              throw new ApiError(400, 'name 不能为空', 'invalid_name');
            }
            patch.name = b.name.trim();
          }
          if (b.permissions !== undefined) patch.permissions = normalizePermissions(b.permissions);
          if (b.enabled !== undefined) patch.enabled = b.enabled === true;
          if (Object.keys(patch).length === 0) {
            throw new ApiError(400, '没有可更新的字段', 'empty_update');
          }
          if (patch.enabled === false && auth?.keyId === id) {
            throw new ApiError(400, '不能禁用自己的 Key', 'self_operation');
          }
          const key = await updateApiKey(db, id, patch);
          return { ok: true, data: key };
        })
        .delete('/:id', async ({ params, auth }) => {
          const id = Number.parseInt(params.id, 10);
          if (Number.isNaN(id)) throw new ApiError(400, '无效的 id', 'invalid_id');
          if (auth?.keyId === id) throw new ApiError(400, '不能删除自己的 Key', 'self_operation');
          await deleteApiKey(db, id);
          return { ok: true, data: { deleted: true } };
        })
    );
}
