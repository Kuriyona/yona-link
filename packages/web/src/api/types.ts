export const PERMISSIONS = {
  LINKS_READ: 'links:read',
  LINKS_CREATE: 'links:create',
  LINKS_UPDATE: 'links:update',
  LINKS_DELETE: 'links:delete',
  LINKS_STATS: 'links:stats',
  KEYS_MANAGE: 'keys:manage'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export interface Profile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface LinkItem {
  code: string;
  type: 'hash' | 'alias';
  shortUrl: string | null;
  targetUrl: string;
  permanent: boolean;
  expiresAt: string | null;
  status: 'active' | 'retired';
  retiredAt: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListLinksResult {
  items: LinkItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LinkStats {
  code: string;
  shortUrl: string | null;
  clickCount: number;
  lastClickedAt: string | null;
}

export interface ApiKeyInfo {
  id: number;
  name: string;
  permissions: Permission[];
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedKey {
  key: { id: number; permissions: Permission[]; enabled: boolean };
  rawKey: string;
}

export interface AuthInfo {
  kind: 'admin' | 'key';
  name: string;
  permissions: Permission[];
}

export interface SystemInfo {
  hashLength: number;
  retentionDays: number;
  publicLinkDomain: string | null;
  counts: { total: number; active: number; retired: number };
}
