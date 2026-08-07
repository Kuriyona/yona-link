import { resolve } from 'node:path';

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
}

export interface AppConfig {
  port: number;
  defaultRedirectUrl: string | null;
  publicLinkDomain: string | null;
  hashLength: number;
  retentionDays: number;
  adminUsername: string;
  adminPassword: string;
  databasePath: string;
  sessionTtlDays: number;
  rateLimitMax: number;
  response301ForPermanent: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = Bun.env): AppConfig {
  const config: AppConfig = {
    port: int(env.PORT, 3000),
    defaultRedirectUrl: env.DEFAULT_REDIRECT_URL ?? null,
    publicLinkDomain: env.PUBLIC_LINK_DOMAIN ?? null,
    hashLength: int(env.HASH_LENGTH, 6),
    retentionDays: int(env.RETENTION_DAYS, 7),
    adminUsername: env.ADMIN_USERNAME?.trim() || 'admin',
    adminPassword: env.ADMIN_PASSWORD ?? '',
    databasePath: env.DATABASE_PATH ?? resolve(process.cwd(), 'data/yona-link.db'),
    sessionTtlDays: int(env.SESSION_TTL_DAYS, 7),
    rateLimitMax: int(env.RATE_LIMIT_MAX, 120),
    response301ForPermanent: env.RESPONSE_301_FOR_PERMANENT === 'true'
  };

  if (!config.adminPassword) {
    throw new Error('必须设置 ADMIN_PASSWORD 环境变量');
  }
  if (config.hashLength < 3 || config.hashLength > 32) {
    throw new Error('HASH_LENGTH 必须在 3-32 之间');
  }
  if (config.sessionTtlDays < 1) {
    throw new Error('SESSION_TTL_DAYS 必须 >= 1');
  }
  return config;
}
