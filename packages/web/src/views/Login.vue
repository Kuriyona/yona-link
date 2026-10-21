<script setup lang="ts">
import { Dialog } from '@varlet/ui';
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
const username = ref(profiles.active?.username ?? '');
const password = ref('');
const remember = ref(true);
const error = ref('');
const loading = ref(false);

function loadActive() {
  name.value = profiles.active?.name ?? '';
  baseUrl.value = profiles.active?.baseUrl ?? '';
  username.value = profiles.active?.username ?? '';
}

function useProfile(profile: Profile) {
  profiles.switchTo(profile.id);
  loadActive();
  error.value = '';
}

async function removeProfile(profile: Profile) {
  const action = await Dialog({
    title: '删除账号配置',
    message: `确定删除「${profile.name}」？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: 'var(--color-danger)'
  });
  if (action !== 'confirm') return;
  const wasActive = profiles.active?.id === profile.id;
  profiles.remove(profile.id);
  if (wasActive) loadActive();
}

async function submit() {
  error.value = '';
  if (!baseUrl.value.trim()) {
    error.value = '请输入 API 地址';
    return;
  }
  if (!username.value.trim()) {
    error.value = '请输入用户名';
    return;
  }
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }
  loading.value = true;
  try {
    await auth.login({
      baseUrl: baseUrl.value,
      username: username.value.trim(),
      password: password.value,
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
  <div class="login-page">
    <var-paper class="login-card" variant="outlined">
      <h1 class="brand-name">Yona-Link</h1>
      <p class="text-secondary">用户账号登录，可保存多套「API 地址 + 账号」配置</p>

      <section v-if="profiles.profiles.length > 0" class="profiles">
        <div class="field-label">已保存的账号配置</div>
        <var-paper variant="filled" class="profile-list">
          <var-cell
            v-for="profile in profiles.profiles"
            :key="profile.id"
            :title="profile.name"
            :description="`${profile.baseUrl} · ${profile.username}`"
            border>
            <template #extra>
              <div class="cell-actions">
                <var-chip v-if="profile.id === profiles.active?.id" type="primary" size="small"
                  >当前</var-chip
                >
                <var-button text size="small" type="primary" @click="useProfile(profile)"
                  >使用</var-button
                >
                <var-button text size="small" type="danger" @click="removeProfile(profile)"
                  >删除</var-button
                >
              </div>
            </template>
          </var-cell>
        </var-paper>
      </section>

      <form class="form" @submit.prevent="submit">
        <div class="field">
          <span class="field-label">配置名称（可选）</span>
          <var-input v-model="name" placeholder="例如: 生产环境" clearable />
        </div>

        <div class="field">
          <span class="field-label">API 地址</span>
          <var-input v-model="baseUrl" placeholder="http://localhost:3000/api" clearable />
        </div>

        <div class="field">
          <span class="field-label">用户名</span>
          <var-input v-model="username" placeholder="用户名" clearable />
        </div>

        <div class="field">
          <span class="field-label">密码</span>
          <var-input v-model="password" type="password" placeholder="密码" />
        </div>

        <var-cell title="登录成功后保存为账号配置" class="remember-cell">
          <template #extra>
            <var-switch v-model="remember" />
          </template>
        </var-cell>

        <var-alert v-if="error" type="danger" variant="tonal" :message="error" />

        <var-button type="primary" size="large" block native-type="submit" :loading="loading">
          {{ loading ? '登录中...' : '登录' }}
        </var-button>
      </form>
    </var-paper>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.login-card {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px;
  border-radius: 16px;
}

.brand-name {
  font-size: 22px;
  font-weight: 600;
}

.profiles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-list {
  border-radius: 12px;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
}

.cell-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.remember-cell {
  padding-inline: 0;
}
</style>
