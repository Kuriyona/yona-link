export const PERMISSIONS = {
  LINKS_READ: 'links:read',
  LINKS_CREATE: 'links:create',
  LINKS_UPDATE: 'links:update',
  LINKS_DELETE: 'links:delete',
  LINKS_STATS: 'links:stats',
  LINKS_VIEW_ALL: 'links:view_all',
  USERS_MANAGE: 'users:manage'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export interface Profile {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  token: string;
}

export interface UserInfo {
  id: number;
  username: string;
  role: 'admin' | 'user';
  permissions: Permission[];
}

export interface LoginResult {
  token: string;
  user: UserInfo;
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
  createdById: number | null;
  createdBy: string | null;
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

export interface UserRow {
  id: number;
  username: string;
  role: 'admin' | 'user';
  enabled: boolean;
  linkCount: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface SystemInfo {
  hashLength: number;
  retentionDays: number;
  publicLinkDomain: string | null;
  counts: { total: number; active: number; retired: number };
  userCount: number;
}
