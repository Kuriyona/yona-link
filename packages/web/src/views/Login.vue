<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
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
    await auth.login({ username: username.value.trim(), password: password.value });
    router.push({ name: 'links' });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <var-paper class="login-card" variant="outlined">
      <h1 class="brand-name">Kuriyona Links</h1>
      <p class="text-secondary">使用你的账号登录管理面板</p>

      <form class="form" @submit.prevent="submit">
        <div class="field">
          <span class="field-label">用户名</span>
          <var-input v-model="username" placeholder="用户名" clearable />
        </div>

        <div class="field">
          <span class="field-label">密码</span>
          <var-input v-model="password" type="password" placeholder="密码" />
        </div>

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
</style>
