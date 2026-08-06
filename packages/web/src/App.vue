<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import ApiSettings from '@/components/ApiSettings.vue';
import { useAuthStore } from '@/stores/auth';
import { useProfilesStore } from '@/stores/profiles';

const auth = useAuthStore();
const profiles = useProfilesStore();
const router = useRouter();

const settingsOpen = ref(false);

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div v-if="auth.authenticated" class="layout">
    <aside class="sidebar">
      <div class="brand">Yona-Link</div>
      <nav class="nav">
        <router-link to="/">短链接</router-link>
        <router-link v-if="auth.hasPermission('keys:manage')" to="/keys">API Keys</router-link>
      </nav>
      <div class="sidebar-foot">
        <button
          type="button"
          class="link-btn"
          :title="`当前账号: ${profiles.active?.name ?? ''}`"
          @click="settingsOpen = true">
          {{ profiles.active ? `${profiles.active.name}` : 'API 配置' }}
        </button>
        <span class="muted">{{ auth.info?.name }}</span>
        <button type="button" class="link-btn" @click="logout">退出</button>
      </div>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
  <router-view v-else />

  <ApiSettings :open="settingsOpen" @close="settingsOpen = false" />
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
}

.brand {
  font-size: 18px;
  font-weight: 600;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav a {
  color: var(--fg);
  text-decoration: none;
  padding: 8px 10px;
  border-radius: var(--radius);
}

.nav a:hover {
  background: var(--border);
}

.nav a.router-link-active {
  background: var(--primary);
  color: var(--primary-fg);
}

.sidebar-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.link-btn {
  border: none;
  background: none;
  color: var(--primary);
  padding: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1;
  padding: 24px;
  min-width: 0;
}

@media (max-width: 768px) {
  .layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 10px 12px;
    gap: 8px 12px;
  }

  .brand {
    font-size: 16px;
  }

  .nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
  }

  .nav a {
    padding: 4px 8px;
  }

  .sidebar-foot {
    margin-top: 0;
    margin-left: auto;
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .content {
    padding: 12px;
  }
}
</style>
