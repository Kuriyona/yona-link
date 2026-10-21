<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createLink, getLink, updateLink } from '@/api';
import type { LinkItem } from '@/api/types';
import { toLocalInputValue } from '@/utils/format';

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => Boolean(route.params.code));
const code = route.params.code as string | undefined;

const type = ref<'hash' | 'alias'>('hash');
const alias = ref('');
const targetUrl = ref('');
const permanent = ref(true);
const expiresAt = ref<string | number | Date | undefined>('');

const saving = ref(false);
const error = ref('');

const created = ref<LinkItem | null>(null);
const copied = ref(false);

const typeOptions = [
  { label: '随机 hash', value: 'hash' },
  { label: '自定义名称（@name）', value: 'alias' }
];

const displayShortUrl = computed(() => {
  if (!created.value) return '';
  return (
    created.value.shortUrl ?? `/${created.value.type === 'alias' ? '@' : ''}${created.value.code}`
  );
});

function copyShortUrl() {
  if (!displayShortUrl.value) return;
  void navigator.clipboard
    .writeText(displayShortUrl.value)
    .then(() => {
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 1500);
    })
    .catch(() => {
      // 忽略剪贴板错误
    });
}

function closeModal() {
  created.value = null;
  void router.push({ name: 'links' });
}

function onCreatedShow(show: boolean) {
  if (!show) closeModal();
}

function toIso(value: string | number | Date | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

async function load() {
  if (!code) return;
  try {
    const link = await getLink(code);
    type.value = link.type;
    alias.value = link.code;
    targetUrl.value = link.targetUrl;
    permanent.value = link.permanent;
    expiresAt.value = toLocalInputValue(link.expiresAt);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}

async function save() {
  error.value = '';
  if (!targetUrl.value.trim()) {
    error.value = '请输入目标 URL';
    return;
  }
  if (type.value === 'alias' && !alias.value.trim()) {
    error.value = '请输入自定义短链名';
    return;
  }
  const expiresValue = permanent.value ? null : toIso(expiresAt.value);
  saving.value = true;
  try {
    if (isEdit.value && code) {
      await updateLink(code, {
        targetUrl: targetUrl.value.trim(),
        permanent: permanent.value,
        expiresAt: expiresValue
      });
      void router.push({ name: 'links' });
    } else {
      const link = await createLink({
        type: type.value,
        code: type.value === 'alias' ? alias.value.trim() : undefined,
        targetUrl: targetUrl.value.trim(),
        permanent: permanent.value,
        expiresAt: expiresValue
      });
      created.value = link;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

watch(isEdit, (value) => {
  if (value) void load();
});

onMounted(() => {
  if (isEdit.value) void load();
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <var-button text round aria-label="返回" @click="router.push({ name: 'links' })">
        <var-icon name="chevron-left" size="24" />
      </var-button>
      <h1 class="page-title page-title--grow">{{ isEdit ? '编辑短链' : '新建短链' }}</h1>
    </div>

    <form class="form" @submit.prevent="save">
      <div class="field">
        <span class="field-label">类型</span>
        <var-select v-model="type" :options="typeOptions" :disabled="isEdit" />
      </div>

      <div v-if="type === 'alias'" class="field">
        <span class="field-label">自定义短链名</span>
        <var-input v-model="alias" :disabled="isEdit" placeholder="my-link" clearable>
          <template #prepend-icon>
            <span class="prefix mono">@</span>
          </template>
        </var-input>
        <p class="field-hint">仅允许字母、数字、下划线、连字符，长度不超过 64</p>
      </div>

      <div class="field">
        <span class="field-label">目标 URL</span>
        <var-input v-model="targetUrl" placeholder="https://example.com/page" clearable />
      </div>

      <var-cell title="长期有效（永久链接）">
        <template #extra>
          <var-switch v-model="permanent" />
        </template>
      </var-cell>

      <div v-if="!permanent" class="field">
        <span class="field-label">过期时间（留空则长期有效）</span>
        <var-date-input
          v-model="expiresAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm"
          format="YYYY-MM-DD HH:mm"
          placeholder="选择过期时间"
          clearable />
      </div>

      <var-alert v-if="error" type="danger" variant="tonal" :message="error" />

      <div class="form-actions">
        <var-button type="primary" size="large" native-type="submit" :loading="saving">
          {{ saving ? '保存中...' : '保存' }}
        </var-button>
        <var-button size="large" @click="router.push({ name: 'links' })">取消</var-button>
      </div>
    </form>

    <var-dialog
      :show="created !== null"
      title="短链创建成功"
      confirm-button-text="完成"
      cancel-button-text="继续管理"
      :close-on-click-overlay="false"
      @update:show="onCreatedShow"
      @confirm="closeModal"
      @cancel="closeModal">
      <div class="created">
        <div class="created-row">
          <code class="created-url mono">{{ displayShortUrl }}</code>
          <var-button type="primary" size="small" @click="copyShortUrl">
            {{ copied ? '已复制' : '复制' }}
          </var-button>
        </div>
        <p v-if="created && !created.shortUrl" class="field-hint">
          服务器未配置 PUBLIC_LINK_DOMAIN，以上为相对路径，配置后可生成完整短链。
        </p>
      </div>
    </var-dialog>
  </div>
</template>

<style scoped>
.prefix {
  font-size: 14px;
}

.created {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.created-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px dashed var(--color-outline, #d9dee3);
  border-radius: 8px;
}

.created-url {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  user-select: all;
}
</style>
