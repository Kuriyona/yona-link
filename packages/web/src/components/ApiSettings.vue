<script setup lang="ts">
import { Dialog } from '@varlet/ui';
import { ref } from 'vue';

import type { Profile } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { useProfilesStore } from '@/stores/profiles';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const profiles = useProfilesStore();

const switching = ref(false);
const error = ref('');

function onShow(show: boolean) {
  if (!show) emit('close');
}

async function switchTo(profile: Profile) {
  if (switching.value) return;
  switching.value = true;
  error.value = '';
  profiles.switchTo(profile.id);
  try {
    await auth.refresh();
    emit('close');
  } catch {
    await auth.logout();
    emit('close');
  } finally {
    switching.value = false;
  }
}

async function remove(profile: Profile) {
  const action = await Dialog({
    title: '删除账号配置',
    message: `确定删除「${profile.name}」？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: 'var(--color-danger)'
  });
  if (action !== 'confirm') return;
  profiles.remove(profile.id);
}
</script>

<template>
  <var-popup :show="props.open" position="bottom" safe-area @update:show="onShow">
    <div class="sheet">
      <div class="sheet-head">
        <h2 class="sheet-title">账号配置</h2>
        <var-button text round aria-label="关闭" @click="emit('close')">
          <var-icon name="window-close" size="22" />
        </var-button>
      </div>
      <p class="text-secondary">
        每套配置包含 API 地址与登录账号，点击「切换」即可生效；新配置请在登录页添加
      </p>

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
              <var-button
                text
                size="small"
                type="primary"
                :disabled="switching"
                @click="switchTo(profile)">
                切换
              </var-button>
              <var-button text size="small" type="danger" @click="remove(profile)">
                删除
              </var-button>
            </div>
          </template>
        </var-cell>
        <var-cell v-if="profiles.profiles.length === 0" title="暂无保存的配置" />
      </var-paper>

      <var-alert v-if="error" type="danger" variant="tonal" :message="error" />

      <var-button block @click="emit('close')">关闭</var-button>
    </div>
  </var-popup>
</template>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
  background: var(--color-body, #ffffff);
  max-height: 85vh;
  overflow-y: auto;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sheet-title {
  font-size: 18px;
  font-weight: 600;
}

.profile-list {
  border-radius: 12px;
  overflow: hidden;
}

.cell-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>
