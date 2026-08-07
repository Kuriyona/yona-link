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
  adminKey: string;
  databasePath: string;
  apiKeyPrefix: string;
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
    adminKey: env.ADMIN_KEY ?? '',
    databasePath: env.DATABASE_PATH ?? resolve(process.cwd(), 'data/yona-link.db'),
    apiKeyPrefix: env.API_KEY_PREFIX ?? 'yl_',
    rateLimitMax: int(env.RATE_LIMIT_MAX, 120),
    response301ForPermanent: env.RESPONSE_301_FOR_PERMANENT === 'true'
  };

  if (!config.adminKey) {
    throw new Error('必须设置 ADMIN_KEY 环境变量');
  }
  if (config.hashLength < 3 || config.hashLength > 32) {
    throw new Error('HASH_LENGTH 必须在 3-32 之间');
  }
  return config;
}
