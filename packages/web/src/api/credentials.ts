import type { Profile } from './types';

const DEFAULT_ENDPOINT = import.meta.env.VITE_API_BASE_URL ?? '/api';
const KEY_PROFILES = 'yl_profiles';
const KEY_ACTIVE = 'yl_profile_active';
const SESSION_ID = '__session__';

let sessionProfile: Profile | null = null;

export function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function readProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY_PROFILES);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(arr)) {
      return arr.filter(
        (p): p is Profile =>
          !!p &&
          typeof p === 'object' &&
          typeof (p as Profile).baseUrl === 'string' &&
          typeof (p as Profile).token === 'string'
      );
    }
  } catch {
    // 忽略解析错误
  }
  return [];
}

function writeProfiles(list: Profile[]): void {
  localStorage.setItem(KEY_PROFILES, JSON.stringify(list));
}

export function getProfiles(): Profile[] {
  return readProfiles();
}

export function getActiveProfile(): Profile | null {
  if (sessionProfile) return sessionProfile;
  const profiles = readProfiles();
  const activeId = localStorage.getItem(KEY_ACTIVE);
  return profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
}

export function getApiBaseUrl(): string {
  return getActiveProfile()?.baseUrl ?? normalizeEndpoint(DEFAULT_ENDPOINT);
}

export function getToken(): string | null {
  return getActiveProfile()?.token ?? null;
}

export function getUsername(): string | null {
  return getActiveProfile()?.username ?? null;
}

export function setActiveProfile(id: string): void {
  sessionProfile = null;
  localStorage.setItem(KEY_ACTIVE, id);
}

export function setSessionProfile(baseUrl: string, username: string, token: string): void {
  const normalized = normalizeEndpoint(baseUrl);
  sessionProfile = {
    id: SESSION_ID,
    name: username || normalized,
    baseUrl: normalized,
    username,
    token
  };
}

export function clearSessionProfile(): void {
  sessionProfile = null;
}

export function saveProfile(input: {
  name: string;
  baseUrl: string;
  username: string;
  token: string;
}): Profile {
  const baseUrl = normalizeEndpoint(input.baseUrl);
  const name = input.name.trim() || input.username.trim() || baseUrl;
  const profiles = readProfiles();
  const existing = profiles.find((p) => p.baseUrl === baseUrl);
  if (existing) {
    existing.name = name;
    existing.username = input.username;
    existing.token = input.token;
    writeProfiles(profiles);
    return existing;
  }
  const profile: Profile = {
    id: crypto.randomUUID(),
    name,
    baseUrl,
    username: input.username,
    token: input.token
  };
  profiles.push(profile);
  writeProfiles(profiles);
  return profile;
}

export function deleteProfile(id: string): void {
  const profiles = readProfiles().filter((p) => p.id !== id);
  writeProfiles(profiles);
  if (localStorage.getItem(KEY_ACTIVE) === id) {
    localStorage.removeItem(KEY_ACTIVE);
  }
}
