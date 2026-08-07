import { defineStore } from 'pinia';

import { login as apiLogin, logout as apiLogout, verify } from '@/api';
import {
  clearSessionProfile,
  getToken,
  saveProfile,
  setActiveProfile,
  setSessionProfile
} from '@/api/credentials';
import type { Permission, UserInfo } from '@/api/types';

interface AuthState {
  token: string | null;
  info: UserInfo | null;
  loading: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: getToken(),
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
    async login(input: {
      baseUrl: string;
      username: string;
      password: string;
      name: string;
      remember: boolean;
    }): Promise<void> {
      setSessionProfile(input.baseUrl, '', '');
      const result = await apiLogin({ username: input.username, password: input.password });
      if (input.remember) {
        const profile = saveProfile({
          name: input.name,
          baseUrl: input.baseUrl,
          username: result.user.username,
          token: result.token
        });
        setActiveProfile(profile.id);
      } else {
        setSessionProfile(input.baseUrl, result.user.username, result.token);
      }
      this.token = getToken();
      this.info = result.user;
    },
    async refresh(): Promise<void> {
      if (!this.token) {
        this.info = null;
        return;
      }
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
      clearSessionProfile();
      this.token = null;
      this.info = null;
    }
  }
});
