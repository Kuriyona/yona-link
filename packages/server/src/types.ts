export const PERMISSIONS = {
  LINKS_READ: 'links:read',
  LINKS_CREATE: 'links:create',
  LINKS_UPDATE: 'links:update',
  LINKS_DELETE: 'links:delete',
  LINKS_STATS: 'links:stats',
  KEYS_MANAGE: 'keys:manage'
} as const;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type LinkType = 'hash' | 'alias';

export type LinkStatus = 'active' | 'retired';

export const RESERVED_PATHS = ['api', 'health'] as const;

export function isReservedPath(code: string): boolean {
  const lower = code.toLowerCase();
  return RESERVED_PATHS.includes(lower as (typeof RESERVED_PATHS)[number]);
}
