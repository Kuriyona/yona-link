import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.example.jsonc' },
        miniflare: {
          bindings: {
            ADMIN_USERNAME: 'admin',
            ADMIN_PASSWORD: 'test-admin-password',
            DEFAULT_REDIRECT_URL: 'https://default.example.com',
            HASH_LENGTH: '6',
            RETENTION_DAYS: '7',
            SESSION_TTL_DAYS: '7',
            RATE_LIMIT_MAX: '1000',
            RESPONSE_301_FOR_PERMANENT: 'false',
            TEST_MIGRATIONS: migrations
          }
        }
      })
    ],
    test: {
      setupFiles: ['./tests/setup.ts']
    }
  };
});
