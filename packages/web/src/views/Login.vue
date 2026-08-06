<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import type { Profile } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { useProfilesStore } from '@/stores/profiles';

const auth = useAuthStore();
const profiles = useProfilesStore();
const router = useRouter();

const name = ref('');
const baseUrl = ref(profiles.active?.baseUrl ?? '');
const key = ref(profiles.active?.apiKey ?? '');
const remember = ref(true);
const error = ref('');
const loading = ref(false);

function maskKey(value: string): string {
  if (!value) return '（空）';
  return value.length <= 6 ? '••••' : `••••${value.slice(-4)}`;
}

function loadActive() {
  name.value = profiles.active?.name ?? '';
  baseUrl.value = profiles.active?.baseUrl ?? '';
  key.value = profiles.active?.apiKey ?? '';
}

function useProfile(profile: Profile) {
  profiles.switchTo(profile.id);
  loadActive();
  error.value = '';
}

function removeProfile(profile: Profile) {
  if (!window.confirm(`删除账号配置「${profile.name}」？`)) return;
  profiles.remove(profile.id);
  if (profiles.active?.id !== profile.id) return;
  loadActive();
}

async function submit() {
  error.value = '';
  if (!baseUrl.value.trim()) {
    error.value = '请输入 API 地址';
    return;
  }
  if (!key.value.trim()) {
    error.value = '请输入 API Key';
    return;
  }
  loading.value = true;
  try {
    await auth.login({
      baseUrl: baseUrl.value,
      key: key.value.trim(),
      name: name.value,
      remember: remember.value
    });
    router.push({ name: 'links' });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  profiles.refresh();
});
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1>Yona-Link</h1>
      <p class="muted">可保存多套 API 地址 + Key 账号配置</p>

      <div v-if="profiles.profiles.length > 0" class="profiles">
        <label>已保存的账号配置</label>
        <ul class="list">
          <li v-for="profile in profiles.profiles" :key="profile.id" class="item">
            <div class="item-info" :class="{ active: profile.id === profiles.active?.id }">
              <div class="item-name">
                {{ profile.name }}
                <em v-if="profile.id === profiles.active?.id">当前</em>
              </div>
              <div class="muted mono">{{ profile.baseUrl }} · {{ maskKey(profile.apiKey) }}</div>
            </div>
            <div class="item-actions">
              <button type="button" class="primary" @click="useProfile(profile)">使用</button>
              <button type="button" class="danger" @click="removeProfile(profile)">删除</button>
            </div>
          </li>
        </ul>
      </div>

      <form @submit.prevent="submit">
        <div class="field">
          <label>配置名称（可选）</label>
          <input v-model="name" placeholder="例如: 生产环境" list="profile-names" />
          <datalist id="profile-names">
            <option v-for="profile in profiles.profiles" :key="profile.id" :value="profile.name" />
          </datalist>
        </div>

        <div class="field">
          <label>API 地址</label>
          <input v-model="baseUrl" placeholder="http://localhost:3000/api" list="profile-urls" />
          <datalist id="profile-urls">
            <option
              v-for="profile in profiles.profiles"
              :key="profile.id"
              :value="profile.baseUrl" />
          </datalist>
        </div>

        <div class="field">
          <label>API Key</label>
          <input v-model="key" type="password" autocomplete="off" placeholder="API Key" />
        </div>

        <label class="checkbox">
          <input v-model="remember" type="checkbox" />
          登录成功后保存为账号配置
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? '验证中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-card h1 {
  margin: 0;
  font-size: 22px;
}

.profiles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 10px;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-info.active .item-name {
  color: var(--primary);
}

.item-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name em {
  font-style: normal;
  font-size: 11px;
  background: var(--primary);
  color: var(--primary-fg);
  border-radius: 999px;
  padding: 0 6px;
}

.item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.mono {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field input {
  width: 100%;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
}

.error {
  color: var(--danger);
  margin: 0;
}
</style>
