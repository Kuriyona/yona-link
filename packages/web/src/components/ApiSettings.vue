<script setup lang="ts">
import { ref } from 'vue';

import type { Profile } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { useProfilesStore } from '@/stores/profiles';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const profiles = useProfilesStore();

const newName = ref('');
const newBaseUrl = ref('');
const newKey = ref('');
const error = ref('');
const switching = ref(false);

function maskKey(value: string): string {
  if (!value) return '（空）';
  return value.length <= 6 ? '••••' : `••••${value.slice(-4)}`;
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
    auth.logout();
    emit('close');
  } finally {
    switching.value = false;
  }
}

function remove(profile: Profile) {
  if (!window.confirm(`删除账号配置「${profile.name}」？`)) return;
  profiles.remove(profile.id);
}

function add() {
  error.value = '';
  if (!newBaseUrl.value.trim() || !newKey.value.trim()) {
    error.value = '请输入 API 地址和 API Key';
    return;
  }
  profiles.save({
    name: newName.value,
    baseUrl: newBaseUrl.value,
    apiKey: newKey.value
  });
  newName.value = '';
  newBaseUrl.value = '';
  newKey.value = '';
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="backdrop" @click.self="emit('close')">
      <div class="panel">
        <h3>账号配置</h3>
        <p class="muted">每套配置包含 API 地址与 API Key，点击「切换」即可生效</p>

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
              <button
                type="button"
                class="primary"
                :disabled="switching"
                @click="switchTo(profile)">
                切换
              </button>
              <button type="button" class="danger" @click="remove(profile)">删除</button>
            </div>
          </li>
          <li v-if="profiles.profiles.length === 0" class="muted empty">暂无保存的配置</li>
        </ul>

        <div class="add">
          <div class="add-row">
            <input v-model="newName" placeholder="名称（可选）" />
            <input v-model="newBaseUrl" placeholder="API 地址，如 http://localhost:3000/api" />
          </div>
          <div class="add-row">
            <input v-model="newKey" type="password" placeholder="API Key" />
            <button type="button" class="primary" @click="add">保存配置</button>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
        </div>

        <div class="foot">
          <button type="button" @click="emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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

.panel {
  width: 100%;
  max-width: 460px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel h3 {
  margin: 0;
}

.muted {
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
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

.empty {
  text-align: center;
  padding: 8px 0;
}

.add {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.add-row {
  display: flex;
  gap: 8px;
}

.add-row input {
  flex: 1;
  min-width: 0;
}

.foot {
  display: flex;
  justify-content: flex-end;
}

.error {
  color: var(--danger);
  margin: 0;
}
</style>
