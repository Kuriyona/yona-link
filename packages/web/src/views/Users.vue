<script setup lang="ts">
import { Dialog, Snackbar } from '@varlet/ui';
import { computed, onMounted, ref } from 'vue';

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

const actionOpen = ref(false);
const selectedUser = ref<UserRow | null>(null);

const passwordOpen = ref(false);
const passwordValue = ref('');
const resetting = ref(false);

const userActions = computed(() => {
  if (!selectedUser.value) return [];
  return [
    { name: selectedUser.value.enabled ? '禁用账号' : '启用账号', icon: 'power' },
    { name: '重置密码', icon: 'lock-outline' },
    { name: '删除用户', icon: 'delete', color: 'var(--color-danger)' }
  ];
});

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
    Snackbar.success('用户已创建');
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
    Snackbar.success(user.enabled ? '账号已禁用' : '账号已启用');
    await load();
  } catch (e) {
    Snackbar.error(e instanceof Error ? e.message : '操作失败');
  }
}

function openActions(user: UserRow) {
  selectedUser.value = user;
  actionOpen.value = true;
}

function openResetPassword() {
  passwordValue.value = '';
  passwordOpen.value = true;
}

function onUserAction(action: { name: string }) {
  const user = selectedUser.value;
  if (!user) return;
  if (action.name === '重置密码') {
    openResetPassword();
    return;
  }
  if (action.name === '删除用户') {
    void remove(user);
    return;
  }
  void toggleEnabled(user);
}

async function submitReset() {
  const user = selectedUser.value;
  if (!user) return;
  if (!passwordValue.value) {
    Snackbar.warning('请输入新密码');
    return;
  }
  resetting.value = true;
  try {
    await updateUser(user.id, { password: passwordValue.value });
    passwordOpen.value = false;
    Snackbar.success('密码已重置');
    await load();
  } catch (e) {
    Snackbar.error(e instanceof Error ? e.message : '重置失败');
  } finally {
    resetting.value = false;
  }
}

async function remove(user: UserRow) {
  const action = await Dialog({
    title: '删除用户',
    message: `确定删除用户「${user.username}」吗？其创建的短链将保留但不再归属该用户。`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: 'var(--color-danger)'
  });
  if (action !== 'confirm') return;
  try {
    await deleteUser(user.id);
    Snackbar.success('用户已删除');
    await load();
  } catch (e) {
    Snackbar.error(e instanceof Error ? e.message : '删除失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="page-title--grow">
        <h1 class="page-title">用户管理</h1>
        <p class="page-subtitle">共 {{ users.length }} 位用户</p>
      </div>
    </div>

    <var-alert v-if="error" type="danger" variant="tonal" :message="error" />

    <var-paper variant="outlined" class="create-card">
      <h2 class="section-title">创建新用户</h2>
      <div class="field">
        <span class="field-label">用户名（2-32 位字母/数字/下划线/短横线）</span>
        <var-input v-model="newUsername" placeholder="例如: alice" clearable />
      </div>
      <div class="field">
        <span class="field-label">初始密码（至少 8 位）</span>
        <var-input v-model="newPassword" type="password" placeholder="初始密码" />
      </div>
      <var-alert v-if="createError" type="danger" variant="tonal" :message="createError" />
      <var-button type="primary" block :loading="creating" @click="create">
        {{ creating ? '创建中...' : '创建用户' }}
      </var-button>
    </var-paper>

    <div v-if="loading && users.length === 0" class="center-block">
      <var-loading type="circle" description="加载中..." />
    </div>
    <var-result
      v-else-if="!loading && users.length === 0"
      type="empty"
      title="暂无用户"
      description="创建第一个普通用户" />
    <var-paper v-else variant="outlined" class="user-panel">
      <var-cell v-for="user in users" :key="user.id" :title="user.username" border>
        <template #description>
          <div class="user-tags">
            <var-chip :type="user.role === 'admin' ? 'primary' : 'default'" size="small" plain>
              {{ user.role === 'admin' ? '管理员' : '普通用户' }}
            </var-chip>
            <var-chip :type="user.enabled ? 'success' : 'default'" size="small" plain>
              {{ user.enabled ? '启用' : '禁用' }}
            </var-chip>
            <span class="user-count">链接 {{ user.linkCount }}</span>
          </div>
          <div class="user-meta">
            最近登录：{{ formatDateTime(user.lastLoginAt) }} · 创建：{{
              formatDateTime(user.createdAt)
            }}
          </div>
        </template>
        <template #extra>
          <var-button
            v-if="user.role !== 'admin'"
            text
            round
            aria-label="用户操作"
            @click.stop="openActions(user)">
            <var-icon name="dots-vertical" size="22" />
          </var-button>
          <span v-else class="text-secondary">—</span>
        </template>
      </var-cell>
    </var-paper>

    <var-action-sheet
      v-model:show="actionOpen"
      :title="selectedUser?.username"
      :actions="userActions"
      @select="onUserAction" />

    <var-dialog
      v-model:show="passwordOpen"
      title="重置密码"
      :confirm-button="false"
      :cancel-button="false"
      :close-on-click-overlay="false">
      <div class="password-dialog">
        <p class="text-secondary">为用户「{{ selectedUser?.username }}」设置新密码（至少 8 位）</p>
        <var-input v-model="passwordValue" type="password" placeholder="新密码" />
        <div class="dialog-actions">
          <var-button text @click="passwordOpen = false">取消</var-button>
          <var-button type="primary" :loading="resetting" @click="submitReset">确定</var-button>
        </div>
      </div>
    </var-dialog>
  </div>
</template>

<style scoped>
.create-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.user-panel {
  border-radius: 12px;
  overflow: hidden;
}

.user-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.user-count {
  font-size: 12px;
  color: var(--color-on-surface-variant, #6b7280);
}

.user-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-on-surface-variant, #6b7280);
}

.password-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
