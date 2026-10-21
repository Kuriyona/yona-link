export const PERMISSIONS = {
  LINKS_READ: 'links:read',
  LINKS_CREATE: 'links:create',
  LINKS_UPDATE: 'links:update',
  LINKS_DELETE: 'links:delete',
  LINKS_STATS: 'links:stats',
  LINKS_VIEW_ALL: 'links:view_all',
  USERS_MANAGE: 'users:manage'
} as const;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const USER_PERMISSIONS: Permission[] = [
  PERMISSIONS.LINKS_READ,
  PERMISSIONS.LINKS_CREATE,
  PERMISSIONS.LINKS_UPDATE,
  PERMISSIONS.LINKS_DELETE,
  PERMISSIONS.LINKS_STATS
];

export const ADMIN_PERMISSIONS: Permission[] = [
  ...USER_PERMISSIONS,
  PERMISSIONS.LINKS_VIEW_ALL,
  PERMISSIONS.USERS_MANAGE
];

export type UserRole = 'admin' | 'user';

export function permissionsForRole(role: UserRole): Permission[] {
  return role === 'admin' ? ADMIN_PERMISSIONS : USER_PERMISSIONS;
}

export type LinkType = 'hash' | 'alias';

export type LinkStatus = 'active' | 'retired';

export const RESERVED_PATHS = ['api', 'health', 'panel'] as const;

export function isReservedPath(code: string): boolean {
  const lower = code.toLowerCase();
  return RESERVED_PATHS.includes(lower as (typeof RESERVED_PATHS)[number]);
}
