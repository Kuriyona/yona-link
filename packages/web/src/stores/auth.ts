import { defineStore } from 'pinia';

import { verify } from '@/api';
import {
  clearSessionProfile,
  getApiKey,
  saveProfile,
  setActiveProfile,
  setSessionProfile
} from '@/api/credentials';
import type { AuthInfo, Permission } from '@/api/types';

interface AuthState {
  key: string | null;
  info: AuthInfo | null;
  loading: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    key: getApiKey(),
    info: null,
    loading: false
  }),
  getters: {
    authenticated: (state): boolean => state.info !== null,
    isAdmin: (state): boolean => state.info?.kind === 'admin',
    permissions: (state): Permission[] => state.info?.permissions ?? []
  },
  actions: {
    hasPermission(perm: Permission): boolean {
      return this.permissions.includes(perm);
    },
    async login(input: {
      baseUrl: string;
      key: string;
      name: string;
      remember: boolean;
    }): Promise<void> {
      if (input.remember) {
        const profile = saveProfile({
          name: input.name,
          baseUrl: input.baseUrl,
          apiKey: input.key
        });
        setActiveProfile(profile.id);
      } else {
        setSessionProfile(input.baseUrl, input.key);
      }
      this.key = getApiKey();
      await this.refresh();
    },
    async refresh(): Promise<void> {
      if (!this.key) {
        this.info = null;
        return;
      }
      this.loading = true;
      try {
        this.info = await verify();
      } catch {
        this.info = null;
        throw new Error('API Key 无效或已失效');
      } finally {
        this.loading = false;
      }
    },
    logout(): void {
      clearSessionProfile();
      this.key = null;
      this.info = null;
    }
  }
});
