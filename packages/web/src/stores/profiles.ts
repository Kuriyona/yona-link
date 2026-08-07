import { defineStore } from 'pinia';

import {
  deleteProfile,
  getActiveProfile,
  getProfiles,
  saveProfile,
  setActiveProfile
} from '@/api/credentials';
import type { Profile } from '@/api/types';

interface ProfilesState {
  profiles: Profile[];
  active: Profile | null;
}

export const useProfilesStore = defineStore('profiles', {
  state: (): ProfilesState => ({
    profiles: getProfiles(),
    active: getActiveProfile()
  }),
  actions: {
    refresh(): void {
      this.profiles = getProfiles();
      this.active = getActiveProfile();
    },
    switchTo(id: string): void {
      setActiveProfile(id);
      this.refresh();
    },
    save(input: { name: string; baseUrl: string; username: string; token: string }): Profile {
      const profile = saveProfile(input);
      this.refresh();
      return profile;
    },
    remove(id: string): void {
      deleteProfile(id);
      this.refresh();
    }
  }
});
