<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { createUser, deleteUser, listUsers, updateUser } from '@/api';
import type { UserRow } from '@/api/types';
import { formatDateTime } from '@/utils/format';

const users = ref<UserRow[]>([]);
const loading = ref(false);
const error = ref('');

const creating = ref(false);
const newUsername = ref('');
const newPassword = ref('');
const createError = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    users.value = await listUsers();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function create() {
  createError.value = '';
  if (!newUsername.value.trim()) {
    createError.value = '请输入用户名';
    return;
  }
  if (!newPassword.value) {
    createError.value = '请输入密码';
    return;
  }
  creating.value = true;
  try {
    await createUser({ username: newUsername.value.trim(), password: newPassword.value });
    newUsername.value = '';
    newPassword.value = '';
    await load();
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '创建失败';
  } finally {
    creating.value = false;
  }
}

async function toggleEnabled(user: UserRow) {
  try {
    await updateUser(user.id, { enabled: !user.enabled });
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败');
  }
}

async function resetPassword(user: UserRow) {
  const next = window.prompt(`为用户「${user.username}」设置新密码（至少 8 位）：`);
  if (next === null || !next) return;
  try {
    await updateUser(user.id, { password: next });
    alert('密码已重置');
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '重置失败');
  }
}

async function remove(user: UserRow) {
  if (!window.confirm(`确定删除用户「${user.username}」吗？其创建的短链将保留但不再归属该用户。`)) {
    return;
  }
  try {
    await deleteUser(user.id);
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <h2>用户管理</h2>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="create">
      <h3>创建新用户</h3>
      <div class="field">
        <label>用户名（2-32 位字母/数字/下划线/短横线）</label>
        <input v-model="newUsername" placeholder="例如: alice" />
      </div>
      <div class="field">
        <label>初始密码（至少 8 位）</label>
        <input v-model="newPassword" type="password" autocomplete="off" placeholder="初始密码" />
      </div>
      <p v-if="createError" class="error">{{ createError }}</p>
      <button type="button" class="primary" :disabled="creating" @click="create">
        {{ creating ? '创建中...' : '创建用户' }}
      </button>
    </section>

    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>角色</th>
            <th>状态</th>
            <th>链接数</th>
            <th>最近登录</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              {{ user.username }}
              <em v-if="user.role === 'admin'" class="admin-tag">管理员</em>
            </td>
            <td>{{ user.role === 'admin' ? '管理员' : '普通用户' }}</td>
            <td>
              <span :class="['badge', user.enabled ? 'active' : 'disabled']">
                {{ user.enabled ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ user.linkCount }}</td>
            <td>{{ formatDateTime(user.lastLoginAt) }}</td>
            <td>{{ formatDateTime(user.createdAt) }}</td>
            <td class="actions">
              <template v-if="user.role !== 'admin'">
                <button type="button" @click="toggleEnabled(user)">
                  {{ user.enabled ? '禁用' : '启用' }}
                </button>
                <button type="button" @click="resetPassword(user)">重置密码</button>
                <button type="button" class="danger" @click="remove(user)">删除</button>
              </template>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!loading && users.length === 0">
            <td colspan="7" class="muted center">暂无用户</td>
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
  max-width: 480px;
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

.admin-tag {
  font-style: normal;
  font-size: 11px;
  background: var(--primary);
  color: var(--primary-fg);
  border-radius: 999px;
  padding: 0 6px;
}

.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.table th {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
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
</style>
