<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getLink, getLinkStats } from '@/api';
import type { LinkItem, LinkStats as LinkStatsType } from '@/api/types';
import { formatDateTime } from '@/utils/format';

const route = useRoute();
const router = useRouter();

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
    <div class="page-header">
      <var-button text round aria-label="返回" @click="router.push({ name: 'links' })">
        <var-icon name="chevron-left" size="24" />
      </var-button>
      <h1 class="page-title page-title--grow">短链统计</h1>
      <var-button
        v-if="link && link.status === 'active'"
        text
        size="small"
        type="primary"
        @click="router.push(`/links/${link.code}/edit`)">
        编辑
      </var-button>
    </div>

    <var-alert v-if="error" type="danger" variant="tonal" :message="error" />

    <template v-if="link">
      <var-paper variant="outlined" class="section">
        <div class="section-label">短链</div>
        <div class="short-code mono">
          {{ link.type === 'alias' ? `@${link.code}` : link.code }}
        </div>
        <div v-if="stats?.shortUrl" class="short-url">
          <span class="mono">{{ stats.shortUrl }}</span>
          <var-button text size="small" type="primary" @click="copyShortUrl">
            <var-icon name="content-copy" size="16" />
            {{ copied ? '已复制' : '复制' }}
          </var-button>
        </div>
      </var-paper>

      <var-paper variant="outlined" class="section">
        <div class="section-label">目标 URL</div>
        <a
          class="target-url"
          :href="link.targetUrl"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.targetUrl">
          {{ link.targetUrl }}
        </a>
      </var-paper>

      <div class="stat-grid">
        <var-paper variant="filled" class="stat-card">
          <div class="stat-label">总点击</div>
          <div class="stat-value">{{ stats?.clickCount ?? 0 }}</div>
        </var-paper>
        <var-paper variant="filled" class="stat-card">
          <div class="stat-label">最近点击</div>
          <div class="stat-value stat-value--small">
            {{ stats?.lastClickedAt ? formatDateTime(stats.lastClickedAt) : '-' }}
          </div>
        </var-paper>
      </div>

      <var-paper variant="outlined" class="detail-panel">
        <var-cell title="状态" :description="link.status === 'active' ? '有效' : '保留期'" border />
        <var-cell title="类型" :description="link.type" border />
        <var-cell
          title="过期时间"
          :description="link.permanent ? '长期有效' : formatDateTime(link.expiresAt)"
          border />
        <var-cell title="创建时间" :description="formatDateTime(link.createdAt)" />
      </var-paper>
    </template>
  </div>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: 12px;
  min-width: 0;
}

.section-label {
  font-size: 13px;
  color: var(--color-on-surface-variant, #6b7280);
}

.short-code {
  font-size: 20px;
  font-weight: 600;
  word-break: break-all;
}

.short-url {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.short-url > span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.target-url {
  word-break: break-all;
  font-size: 13px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 12px;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--color-on-surface-variant, #6b7280);
}

.stat-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-value--small {
  font-size: 14px;
  font-weight: 500;
}

.detail-panel {
  border-radius: 12px;
  overflow: hidden;
}
</style>
