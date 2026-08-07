<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { deleteLink, listAllLinks, listUsers } from '@/api';
import type { LinkItem, UserRow } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime } from '@/utils/format';

const auth = useAuthStore();

const items = ref<LinkItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const type = ref('');
const status = ref('');
const q = ref('');
const userId = ref<number | ''>('');
const userOptions = ref<UserRow[]>([]);
const loading = ref(false);
const error = ref('');

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
      type: type.value ? (type.value as 'hash' | 'alias') : undefined,
      status: status.value ? (status.value as 'active' | 'retired') : undefined,
      q: q.value || undefined,
      userId: userId.value === '' ? undefined : userId.value
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

function nextPage() {
  if (page.value * pageSize.value < total.value) {
    page.value += 1;
    void load();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value -= 1;
    void load();
  }
}

async function remove(code: string) {
  if (!window.confirm(`确定删除短链 /${code} 吗？删除后将进入保留期。`)) return;
  try {
    await deleteLink(code);
    await load();
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败');
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
    <div class="page-head">
      <h2>全部链接</h2>
      <span class="muted">所有用户创建的短链（仅管理员可见）</span>
    </div>

    <div class="filters">
      <input v-model="q" placeholder="搜索 code 或目标 URL" @keyup.enter="applyFilters" />
      <select v-model="userId" @change="applyFilters">
        <option value="">全部创建者</option>
        <option v-for="user in userOptions" :key="user.id" :value="user.id">
          {{ user.username }}{{ user.role === 'admin' ? '（管理员）' : '' }}
        </option>
      </select>
      <select v-model="type" @change="applyFilters">
        <option value="">全部类型</option>
        <option value="hash">hash</option>
        <option value="alias">alias</option>
      </select>
      <select v-model="status" @change="applyFilters">
        <option value="">全部状态</option>
        <option value="active">有效</option>
        <option value="retired">保留期</option>
      </select>
      <button @click="applyFilters">搜索</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>短链</th>
            <th>类型</th>
            <th>创建者</th>
            <th>目标</th>
            <th>状态</th>
            <th>过期时间</th>
            <th>点击</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="link in items" :key="link.code">
            <td class="mono">{{ displayCode(link) }}</td>
            <td>{{ link.type }}</td>
            <td>{{ link.createdBy ?? '（已删除）' }}</td>
            <td class="truncate" :title="link.targetUrl">{{ link.targetUrl }}</td>
            <td>
              <span :class="['badge', link.status]">{{
                link.status === 'active' ? '有效' : '保留期'
              }}</span>
            </td>
            <td>{{ link.permanent ? '长期' : formatDateTime(link.expiresAt) }}</td>
            <td>{{ link.clickCount }}</td>
            <td>{{ formatDate(link.createdAt) }}</td>
            <td class="actions">
              <router-link
                v-if="auth.hasPermission('links:stats')"
                :to="`/links/${link.code}/stats`"
                >统计</router-link
              >
              <router-link
                v-if="auth.hasPermission('links:update')"
                :to="`/links/${link.code}/edit`"
                >编辑</router-link
              >
              <button
                v-if="auth.hasPermission('links:delete')"
                type="button"
                class="danger"
                @click="remove(link.code)">
                删除
              </button>
            </td>
          </tr>
          <tr v-if="!loading && items.length === 0">
            <td colspan="9" class="muted center">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button :disabled="page <= 1" @click="prevPage">上一页</button>
      <span class="muted"
        >第 {{ page }} 页 / 共 {{ Math.max(1, Math.ceil(total / pageSize)) }} 页（{{
          total
        }}
        条）</span
      >
      <button :disabled="page * pageSize >= total" @click="nextPage">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.page-head h2 {
  margin: 0;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filters input {
  flex: 1;
  min-width: 200px;
}

.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.table th {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
}

.mono {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
}

.truncate {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.center {
  text-align: center;
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

.badge.retired {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error {
  color: var(--danger);
  margin: 0;
}
</style>
