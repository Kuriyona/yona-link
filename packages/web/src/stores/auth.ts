import { defineStore } from 'pinia';

import { login as apiLogin, logout as apiLogout, verify } from '@/api';
import type { Permission, UserInfo } from '@/api/types';

interface AuthState {
  info: UserInfo | null;
  loading: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    info: null,
    loading: false
  }),
  getters: {
    authenticated: (state): boolean => state.info !== null,
    isAdmin: (state): boolean => state.info?.role === 'admin',
    permissions: (state): Permission[] => state.info?.permissions ?? []
  },
  actions: {
    hasPermission(perm: Permission): boolean {
      return this.permissions.includes(perm);
    },
    async login(input: { username: string; password: string }): Promise<void> {
      const result = await apiLogin(input);
      this.info = result.user;
    },
    async refresh(): Promise<void> {
      this.loading = true;
      try {
        this.info = await verify();
      } catch {
        this.info = null;
        throw new Error('登录会话已失效');
      } finally {
        this.loading = false;
      }
    },
    async logout(): Promise<void> {
      try {
        await apiLogout();
      } catch {
        // 忽略：即使会话已失效也清除本地状态
      }
      this.info = null;
    }
  }
});
