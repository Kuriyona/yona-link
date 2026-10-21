export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  DEFAULT_REDIRECT_URL?: string;
  PUBLIC_LINK_DOMAIN?: string;
  HASH_LENGTH?: string;
  RETENTION_DAYS?: string;
  SESSION_TTL_DAYS?: string;
  RATE_LIMIT_MAX?: string;
  RESPONSE_301_FOR_PERMANENT?: string;
}

export interface AppConfig {
  defaultRedirectUrl: string | null;
  publicLinkDomain: string | null;
  hashLength: number;
  retentionDays: number;
  adminUsername: string;
  adminPassword: string;
  sessionTtlDays: number;
  rateLimitMax: number;
  response301ForPermanent: boolean;
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(env: Bindings): AppConfig {
  const config: AppConfig = {
    defaultRedirectUrl: env.DEFAULT_REDIRECT_URL?.trim() || null,
    publicLinkDomain: env.PUBLIC_LINK_DOMAIN?.trim() || null,
    hashLength: int(env.HASH_LENGTH, 6),
    retentionDays: int(env.RETENTION_DAYS, 7),
    adminUsername: env.ADMIN_USERNAME?.trim() || 'admin',
    adminPassword: env.ADMIN_PASSWORD ?? '',
    sessionTtlDays: int(env.SESSION_TTL_DAYS, 7),
    rateLimitMax: int(env.RATE_LIMIT_MAX, 120),
    response301ForPermanent: env.RESPONSE_301_FOR_PERMANENT === 'true'
  };

  if (config.hashLength < 3 || config.hashLength > 32) {
    throw new Error('HASH_LENGTH 必须在 3-32 之间');
  }
  if (config.sessionTtlDays < 1) {
    throw new Error('SESSION_TTL_DAYS 必须 >= 1');
  }
  if (config.retentionDays < 0) {
    throw new Error('RETENTION_DAYS 必须 >= 0');
  }
  return config;
}
