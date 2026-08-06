<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { createKey, deleteKey, listKeys, updateKey } from '@/api';
import type { ApiKeyInfo, Permission } from '@/api/types';
import { ALL_PERMISSIONS, PERMISSIONS } from '@/api/types';
import { formatDateTime } from '@/utils/format';

const keys = ref<ApiKeyInfo[]>([]);
const loading = ref(false);
const error = ref('');

const creating = ref(false);
const newName = ref('');
const newPermissions = ref<Permission[]>([]);
const createError = ref('');
const createdRawKey = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    keys.value = await listKeys();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function togglePermission(perm: Permission) {
  const idx = newPermissions.value.indexOf(perm);
  if (idx >= 0) {
    newPermissions.value.splice(idx, 1);
  } else {
    newPermissions.value.push(perm);
  }
}

async function create() {
  createError.value = '';
  createdRawKey.value = '';
  if (!newName.value.trim()) {
    createError.value = '请输入名称';
    return;
  }
  creating.value = true;
  try {
    const result = await createKey({
      name: newName.value.trim(),
      permissions: newPermissions.value
    });
    createdRawKey.value = result.rawKey;
    newName.value = '';
    newPermissions.value = [];
    await load();
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '创建失败';
  } finally {
    creating.value = false;
  }
}

async function toggleEnabled(key: ApiKeyInfo) {
  try {
    await updateKey(key.id, { enabled: !key.enabled });
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败');
  }
}

async function togglePermissions(key: ApiKeyInfo, perm: Permission) {
  const next = key.permissions.includes(perm)
    ? key.permissions.filter((p) => p !== perm)
    : [...key.permissions, perm];
  try {
    await updateKey(key.id, { permissions: next });
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败');
  }
}

async function remove(key: ApiKeyInfo) {
  if (!window.confirm(`确定删除 API Key「${key.name}」吗？`)) return;
  try {
    await deleteKey(key.id);
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败');
  }
}

const permissionLabels: Record<Permission, string> = {
  [PERMISSIONS.LINKS_READ]: '查看链接',
  [PERMISSIONS.LINKS_CREATE]: '创建链接',
  [PERMISSIONS.LINKS_UPDATE]: '编辑链接',
  [PERMISSIONS.LINKS_DELETE]: '删除链接',
  [PERMISSIONS.LINKS_STATS]: '查看统计',
  [PERMISSIONS.KEYS_MANAGE]: '管理 Keys'
};

onMounted(load);
</script>

<template>
  <div class="page">
    <h2>API Keys</h2>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="create">
      <h3>创建新 Key</h3>
      <div class="field">
        <label>名称</label>
        <input v-model="newName" placeholder="例如: 运营账号" />
      </div>
      <div class="field">
        <label>权限</label>
        <div class="perms">
          <label v-for="perm in ALL_PERMISSIONS" :key="perm" class="checkbox">
            <input
              type="checkbox"
              :checked="newPermissions.includes(perm)"
              @change="togglePermission(perm)" />
            {{ permissionLabels[perm] }}（{{ perm }}）
          </label>
        </div>
      </div>
      <p v-if="createError" class="error">{{ createError }}</p>
      <button type="button" class="primary" :disabled="creating" @click="create">
        {{ creating ? '创建中...' : '创建 Key' }}
      </button>
      <div v-if="createdRawKey" class="raw-key">
        <p class="ok">请立即保存，密钥只显示一次：</p>
        <code>{{ createdRawKey }}</code>
      </div>
    </section>

    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>权限</th>
            <th>状态</th>
            <th>最近使用</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in keys" :key="key.id">
            <td>{{ key.name }}</td>
            <td>
              <div class="perms-tags">
                <button
                  v-for="perm in ALL_PERMISSIONS"
                  :key="perm"
                  type="button"
                  :class="['perm-tag', { on: key.permissions.includes(perm) }]"
                  :title="`${permissionLabels[perm]}（${perm}）`"
                  @click="togglePermissions(key, perm)">
                  {{ perm.split(':')[1] }}
                </button>
              </div>
            </td>
            <td>
              <span :class="['badge', key.enabled ? 'active' : 'disabled']">
                {{ key.enabled ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDateTime(key.lastUsedAt) }}</td>
            <td>{{ formatDateTime(key.createdAt) }}</td>
            <td class="actions">
              <button type="button" @click="toggleEnabled(key)">
                {{ key.enabled ? '禁用' : '启用' }}
              </button>
              <button type="button" class="danger" @click="remove(key)">删除</button>
            </td>
          </tr>
          <tr v-if="!loading && keys.length === 0">
            <td colspan="6" class="muted center">暂无 Key</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
}

.create {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create h3 {
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field input {
  max-width: 320px;
}

.perms {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
  font-weight: 400;
}

.raw-key {
  border: 1px dashed var(--border);
  padding: 12px;
  border-radius: var(--radius);
}

.raw-key p {
  margin: 0 0 8px;
}

.raw-key code {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  word-break: break-all;
  user-select: all;
}

.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.table th {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
}

.perms-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.perm-tag {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 999px;
  opacity: 0.45;
}

.perm-tag.on {
  opacity: 1;
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-fg);
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.badge.active {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.badge.disabled {
  background: rgba(100, 116, 139, 0.15);
  color: var(--muted);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.center {
  text-align: center;
}

.error {
  color: var(--danger);
  margin: 0;
}

.ok {
  color: #16a34a;
  margin: 0;
}
</style>
