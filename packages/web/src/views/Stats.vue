<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { getLink, getLinkStats } from '@/api';
import type { LinkItem, LinkStats as LinkStatsType } from '@/api/types';
import { formatDateTime } from '@/utils/format';

const route = useRoute();

const code = route.params.code as string;
const link = ref<LinkItem | null>(null);
const stats = ref<LinkStatsType | null>(null);
const error = ref('');
const copied = ref(false);

async function load() {
  error.value = '';
  try {
    const [linkData, statsData] = await Promise.all([getLink(code), getLinkStats(code)]);
    link.value = linkData;
    stats.value = statsData;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}

async function copyShortUrl() {
  if (!stats.value?.shortUrl) return;
  try {
    await navigator.clipboard.writeText(stats.value.shortUrl);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // 忽略剪贴板错误
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="head">
      <h2>短链统计</h2>
      <router-link to="/">返回列表</router-link>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="link" class="cards">
      <div class="card">
        <div class="label">短链</div>
        <div class="mono">{{ link.type === 'alias' ? `@${link.code}` : link.code }}</div>
        <div v-if="stats?.shortUrl" class="short-url">
          <span class="mono">{{ stats.shortUrl }}</span>
          <button type="button" @click="copyShortUrl">{{ copied ? '已复制' : '复制' }}</button>
        </div>
      </div>

      <div class="card">
        <div class="label">目标 URL</div>
        <div class="truncate" :title="link.targetUrl">
          <a :href="link.targetUrl" target="_blank" rel="noopener noreferrer">{{
            link.targetUrl
          }}</a>
        </div>
      </div>

      <div class="card">
        <div class="label">总点击</div>
        <div class="value">{{ stats?.clickCount ?? 0 }}</div>
      </div>

      <div class="card">
        <div class="label">最近点击</div>
        <div>{{ stats?.lastClickedAt ? formatDateTime(stats.lastClickedAt) : '-' }}</div>
      </div>

      <div class="card">
        <div class="label">状态</div>
        <div>{{ link.status === 'active' ? '有效' : '保留期' }}</div>
      </div>

      <div class="card">
        <div class="label">类型</div>
        <div>{{ link.type }}</div>
      </div>

      <div class="card">
        <div class="label">过期时间</div>
        <div>{{ link.permanent ? '长期' : formatDateTime(link.expiresAt) }}</div>
      </div>

      <div class="card">
        <div class="label">创建时间</div>
        <div>{{ formatDateTime(link.createdAt) }}</div>
      </div>
    </div>

    <div v-if="link" class="actions">
      <router-link v-if="link.status === 'active'" :to="`/links/${link.code}/edit`"
        >编辑链接</router-link
      >
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head h2 {
  margin: 0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.label {
  color: var(--muted);
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  word-break: break-all;
}

.value {
  font-size: 24px;
  font-weight: 600;
}

.short-url {
  display: flex;
  align-items: center;
  gap: 8px;
}

.short-url span {
  flex: 1;
  min-width: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error {
  color: var(--danger);
  margin: 0;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
