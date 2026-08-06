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
const expiresAt = ref('');

const saving = ref(false);
const error = ref('');
const message = ref('');

const created = ref<LinkItem | null>(null);
const copied = ref(false);

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
  router.push({ name: 'links' });
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
  message.value = '';
  if (!targetUrl.value.trim()) {
    error.value = '请输入目标 URL';
    return;
  }
  if (type.value === 'alias' && !alias.value.trim()) {
    error.value = '请输入自定义短链名';
    return;
  }
  const expiresValue = permanent.value
    ? null
    : expiresAt.value
      ? new Date(expiresAt.value).toISOString()
      : null;
  saving.value = true;
  try {
    if (isEdit.value && code) {
      await updateLink(code, {
        targetUrl: targetUrl.value.trim(),
        permanent: permanent.value,
        expiresAt: permanent.value ? null : (expiresValue ?? null)
      });
      message.value = '保存成功';
      router.push({ name: 'links' });
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

watch(isEdit, (v) => {
  if (v) void load();
});

onMounted(() => {
  if (isEdit.value) void load();
});
</script>

<template>
  <div class="page">
    <h2>{{ isEdit ? '编辑短链' : '新建短链' }}</h2>

    <form class="form" @submit.prevent="save">
      <div class="field">
        <label>类型</label>
        <select v-model="type" :disabled="isEdit">
          <option value="hash">随机 hash</option>
          <option value="alias">自定义名称（@name）</option>
        </select>
      </div>

      <div v-if="type === 'alias'" class="field">
        <label>自定义短链名</label>
        <div class="with-prefix">
          <span class="prefix">@</span>
          <input v-model="alias" :disabled="isEdit" placeholder="my-link" />
        </div>
        <p class="hint">仅允许字母、数字、下划线、连字符，长度不超过 64</p>
      </div>

      <div class="field">
        <label>目标 URL</label>
        <input v-model="targetUrl" type="url" placeholder="https://example.com/page" required />
      </div>

      <div class="field row">
        <label class="checkbox">
          <input v-model="permanent" type="checkbox" />
          长期有效（永久链接）
        </label>
      </div>

      <div v-if="!permanent" class="field">
        <label>过期时间（留空则长期有效）</label>
        <input v-model="expiresAt" type="datetime-local" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="ok">{{ message }}</p>

      <div class="buttons">
        <button type="submit" class="primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <button type="button" @click="router.push({ name: 'links' })">取消</button>
      </div>
    </form>

    <Teleport to="body">
      <div v-if="created" class="backdrop" @click.self="closeModal">
        <div class="modal">
          <h3>短链创建成功</h3>
          <div class="short-url">
            <code>{{ displayShortUrl }}</code>
            <button type="button" class="primary" @click="copyShortUrl">
              {{ copied ? '已复制' : '复制' }}
            </button>
          </div>
          <p v-if="!created.shortUrl" class="hint">
            服务器未配置 PUBLIC_LINK_DOMAIN，以上为相对路径，配置后可生成完整短链。
          </p>
          <div class="buttons">
            <button type="button" class="primary" @click="closeModal">完成</button>
            <button type="button" @click="closeModal">继续管理</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  max-width: 560px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.with-prefix {
  display: flex;
  align-items: stretch;
}

.prefix {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-right: none;
  border-radius: var(--radius) 0 0 var(--radius);
  color: var(--muted);
}

.with-prefix input {
  flex: 1;
  border-radius: 0 var(--radius) var(--radius) 0;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
}

.hint {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
}

.error {
  color: var(--danger);
  margin: 0;
}

.ok {
  color: #16a34a;
  margin: 0;
}

.buttons {
  display: flex;
  gap: 8px;
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
}

.modal {
  width: 100%;
  max-width: 420px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal h3 {
  margin: 0;
}

.short-url {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  padding: 10px;
}

.short-url code {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  user-select: all;
}
</style>
