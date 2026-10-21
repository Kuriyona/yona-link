<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ApiSettings from '@/components/ApiSettings.vue';
import { useAuthStore } from '@/stores/auth';
import { useProfilesStore } from '@/stores/profiles';

const auth = useAuthStore();
const profiles = useProfilesStore();
const route = useRoute();
const router = useRouter();

const isDesktop = useMediaQuery('(min-width: 768px)');
const settingsOpen = ref(false);
const accountOpen = ref(false);

const navItems = computed(() => {
  const items = [{ name: 'links', label: '短链接', icon: 'format-list-checkbox', to: '/' }];
  if (auth.hasPermission('links:view_all')) {
    items.push({ name: 'all-links', label: '全部链接', icon: 'share', to: '/links/all' });
  }
  if (auth.hasPermission('users:manage')) {
    items.push({ name: 'users', label: '用户管理', icon: 'account-circle', to: '/users' });
  }
  return items;
});

const activeNav = computed(() => {
  if (route.name === 'all-links') return 'all-links';
  if (route.name === 'users') return 'users';
  return 'links';
});

const accountTitle = computed(
  () => `${profiles.active?.name ?? '当前账号'} · ${auth.info?.username ?? ''}`
);

const accountActions = computed(() => [
  { name: '账号配置', icon: 'cog-outline' },
  { name: '退出登录', icon: 'power', color: 'var(--color-danger)' }
]);

function navigate(name: string | number) {
  const item = navItems.value.find((entry) => entry.name === name);
  if (item) void router.push(item.to);
}

function logout() {
  void auth.logout().then(() => router.push({ name: 'login' }));
}

function onAccountSelect(action: { name: string }) {
  if (action.name === '账号配置') {
    settingsOpen.value = true;
    return;
  }
  if (action.name === '退出登录') {
    logout();
  }
}
</script>

<template>
  <div v-if="auth.authenticated" class="app-shell">
    <var-rail-navigation
      v-if="isDesktop"
      :active="activeNav"
      show-label
      bordered
      class="desktop-rail"
      @change="navigate">
      <var-rail-navigation-item
        v-for="item in navItems"
        :key="item.name"
        :name="item.name"
        :label="item.label"
        :icon="item.icon" />
      <template #end>
        <var-rail-navigation-item
          name="account"
          label="账号"
          icon="account-circle"
          @click="accountOpen = true" />
        <var-rail-navigation-item name="logout" label="退出" icon="power" @click="logout" />
      </template>
    </var-rail-navigation>

    <div class="app-body">
      <var-app-bar
        v-if="!isDesktop"
        fixed
        placeholder
        safe-area-top
        type="surface"
        title="Yona-Link"
        title-position="left">
        <template #right>
          <var-button text round aria-label="账号" @click="accountOpen = true">
            <var-icon name="account-circle" size="26" />
          </var-button>
        </template>
      </var-app-bar>

      <main class="app-content">
        <router-view />
      </main>
    </div>

    <var-bottom-navigation
      v-if="!isDesktop"
      :active="activeNav"
      fixed
      safe-area
      variant
      active-color="var(--color-primary)"
      @change="navigate">
      <var-bottom-navigation-item
        v-for="item in navItems"
        :key="item.name"
        :name="item.name"
        :label="item.label"
        :icon="item.icon" />
    </var-bottom-navigation>

    <var-action-sheet
      v-model:show="accountOpen"
      :title="accountTitle"
      :actions="accountActions"
      @select="onAccountSelect" />

    <ApiSettings :open="settingsOpen" @close="settingsOpen = false" />
  </div>
  <router-view v-else />
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.desktop-rail {
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  flex-shrink: 0;
  overflow-y: auto;
}

.app-body {
  flex: 1;
  min-width: 0;
}
</style>
