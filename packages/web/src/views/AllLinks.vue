<script setup lang="ts">
import { Dialog, Snackbar } from '@varlet/ui';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { deleteLink, listAllLinks, listUsers } from '@/api';
import type { LinkItem, UserRow } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime } from '@/utils/format';

const auth = useAuthStore();
const router = useRouter();

const items = ref<LinkItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const type = ref('all');
const status = ref('all');
const q = ref('');
const userId = ref<number | 'all'>('all');
const userOptions = ref<UserRow[]>([]);
const loading = ref(false);
const error = ref('');

const typeOptions = [
  { label: '全部类型', value: 'all' },
  { label: 'hash', value: 'hash' },
  { label: 'alias', value: 'alias' }
];

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '有效', value: 'active' },
  { label: '保留期', value: 'retired' }
];

const userSelectOptions = computed(() => [
  { label: '全部创建者', value: 'all' },
  ...userOptions.value.map((user) => ({
    label: `${user.username}${user.role === 'admin' ? '（管理员）' : ''}`,
    value: user.id
  }))
]);

function showTotal(count: number): string {
  return `共 ${count} 条`;
}

async function loadUsers() {
  try {
    userOptions.value = await listUsers();
  } catch {
    userOptions.value = [];
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listAllLinks({
      page: page.value,
      pageSize: pageSize.value,
      type: type.value === 'all' ? undefined : (type.value as 'hash' | 'alias'),
      status: status.value === 'all' ? undefined : (status.value as 'active' | 'retired'),
      q: q.value || undefined,
      userId: userId.value === 'all' ? undefined : userId.value
    });
    items.value = result.items;
    total.value = result.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  void load();
}

function onPageChange(current: number) {
  page.value = current;
  void load();
}

async function remove(code: string) {
  const action = await Dialog({
    title: '删除短链',
    message: `确定删除短链 /${code} 吗？删除后将进入保留期。`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: 'var(--color-danger)'
  });
  if (action !== 'confirm') return;
  try {
    await deleteLink(code);
    Snackbar.success('已删除');
    await load();
  } catch (e) {
    Snackbar.error(e instanceof Error ? e.message : '删除失败');
  }
}

function displayCode(link: LinkItem): string {
  return link.type === 'alias' ? `@${link.code}` : link.code;
}

onMounted(() => {
  void loadUsers();
  void load();
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="page-title--grow">
        <h1 class="page-title">全部链接</h1>
        <p class="page-subtitle">所有用户创建的短链 · 共 {{ total }} 条</p>
      </div>
    </div>

    <div class="filters">
      <var-input
        v-model="q"
        placeholder="搜索 code 或目标 URL"
        clearable
        @keyup.enter="applyFilters">
        <template #prepend-icon>
          <var-icon name="magnify" />
        </template>
      </var-input>
      <var-select v-model="userId" :options="userSelectOptions" @change="applyFilters" />
      <div class="filter-row">
        <var-select v-model="type" :options="typeOptions" @change="applyFilters" />
        <var-select v-model="status" :options="statusOptions" @change="applyFilters" />
      </div>
      <var-button block @click="applyFilters">搜索</var-button>
    </div>

    <var-alert v-if="error" type="danger" variant="tonal" :message="error" />

    <div v-if="loading && items.length === 0" class="center-block">
      <var-loading type="circle" description="加载中..." />
    </div>
    <var-result
      v-else-if="!loading && items.length === 0"
      type="empty"
      title="暂无数据"
      description="换个筛选条件试试" />
    <div v-else class="link-list">
      <var-card v-for="link in items" :key="link.code" variant="outlined" class="link-card">
        <template #title="{ slotClass }">
          <div :class="slotClass">
            <div class="link-title">
              <span class="mono">{{ displayCode(link) }}</span>
              <var-chip
                :type="link.status === 'active' ? 'success' : 'warning'"
                size="small"
                :plain="true">
                {{ link.status === 'active' ? '有效' : '保留期' }}
              </var-chip>
            </div>
          </div>
        </template>
        <template #subtitle="{ slotClass }">
          <div :class="slotClass">
            <span class="text-secondary">
              {{ link.createdBy ?? '（已删除）' }} · {{ link.type }} · 点击 {{ link.clickCount }} ·
              {{ formatDate(link.createdAt) }}
            </span>
          </div>
        </template>
        <div class="link-target mono text-secondary" :title="link.targetUrl">
          {{ link.targetUrl }}
        </div>
        <div class="link-expiry text-secondary">
          过期：{{ link.permanent ? '长期有效' : formatDateTime(link.expiresAt) }}
        </div>
        <template #extra>
          <div class="card-actions">
            <var-button
              v-if="auth.hasPermission('links:stats')"
              text
              size="small"
              @click="router.push(`/links/${link.code}/stats`)">
              统计
            </var-button>
            <var-button
              v-if="auth.hasPermission('links:update')"
              text
              size="small"
              @click="router.push(`/links/${link.code}/edit`)">
              编辑
            </var-button>
            <var-button
              v-if="auth.hasPermission('links:delete')"
              text
              size="small"
              type="danger"
              @click="remove(link.code)">
              删除
            </var-button>
          </div>
        </template>
      </var-card>
    </div>

    <var-pagination
      v-if="total > pageSize"
      :current="page"
      :size="pageSize"
      :total="total"
      :max-pager-count="5"
      :show-total="showTotal"
      @change="onPageChange" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-card {
  border-radius: 12px;
}

.link-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.link-target,
.link-expiry {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.var-pagination {
  align-self: center;
}
</style>
