# AGENTS.md

Yona-Link: self-hosted short-link service. pnpm monorepo with two packages: `packages/server` (Bun + Elysia + Drizzle/SQLite) and `packages/web` (Vue 3 + Vite + Pinia). No linter — formatting only (oxfmt).

## Commands

- `pnpm dev` — run server (bun --watch) + web (vite) in parallel. `pnpm dev:server` / `pnpm dev:web` for one.
- `pnpm test` — server tests only (bun test). Single file: `pnpm --filter @yona-link/server exec bun test tests/link.test.ts`
- `pnpm typecheck` — server `tsc --noEmit` + web `vue-tsc -b`
- `pnpm format` / `pnpm format:check` — oxfmt with `.oxfmtrc.json`. **There is no lint gate.**
- `pnpm build` — builds web only (server is run via `bun src/index.ts`).
- `pnpm build:server` — bundles server into `packages/server/dist/`: single-file `yona-link.js` + standalone `migrate.js` + a copy of `drizzle/` (build script: `packages/server/scripts/build-server.ts`). Deploy = drop those + `.env` in a dir, run `bun migrate.js` then `bun yona-link.js` (Bun auto-loads `.env` from cwd).
- DB: `pnpm db:generate` / `db:migrate` (drizzle-kit), or `pnpm db:migrate:run` (Bun CLI `src/db/migrate.ts`, `MIGRATIONS_FOLDER` env override). Migrations are **separate from server startup** — the server never auto-migrates; run one of these after `db:generate`. `@libsql/client` is a devDep used only by the drizzle-kit CLI; runtime DB is `bun:sqlite`.

## Env & config

- Bun auto-loads `packages/server/.env` (a real, gitignored `.env` exists there). `ADMIN_KEY` is required — startup throws without it. `PORT` defaults to 3000. Run server commands from `packages/server` since relative `DATABASE_PATH` resolves against cwd.
- Prod web API base: `VITE_API_BASE_URL` (default `/api`).

## Server architecture (single port, merged)

- One port serves both: redirects at root, management API under `/api/*`. `src/app.ts` merges `createApiApp` + `createLinkApp`.
- `/api` and `/health` are reserved. Codes `api`/`health` (case-insensitive) are rejected when creating links and skipped in hash generation (`RESERVED_PATHS` / `isReservedPath` in `src/types.ts`).
- Unified JSON 404 for unmatched routes lives in `src/app.ts` `.onError` on `code === 'NOT_FOUND'`. **Do not** add a `*` or `/:path*` catch-all route — it swallows short-link redirects or conflicts with existing dynamic routes. Elysia 1.4 has no `notFound` config.
- Short-link redirects use ONE route `/:code`; alias vs hash is decided by leading `@`. **Keep this design**: Elysia's live Bun router mis-routes a separate `/@:code` route (it matches `/:code` with the `@` kept in the param) even though `app.handle()` behaves correctly.
- CORS: `@elysiajs/cors` with `origin: '*'` and `credentials: false` (`*` + credentials is invalid).

## Testing

- Tests use in-memory SQLite and call `app.handle(new Request(...))` — no live server.
- Helpers in `tests/helpers.ts`: `createTestDb()`, `testConfig(overrides)`, `createLinkAppWithDb`. API tests build the merged app: `createApp(db, testConfig())`.
- API responses are `{ ok, data }` / `{ ok:false, error:{ code, message } }` — data sits at `data.data` when parsing.
- Because tests use `handle()`, live-server routing regressions (e.g. the `@`-alias quirk) are not covered — verify with a real `pnpm dev` + curl when touching routing.

## Web specifics

- Multi-account login: base URL + API key saved as "profiles" in localStorage (`src/api/credentials.ts`, keys `yl_profiles` / `yl_profile_active`). `client.ts` reads base URL + key from the active profile on **every request** (no static base URL) — changing/adding profiles there affects all API calls.
- `@/` alias → `src/`. Vite dev proxies `/api` → `http://localhost:3000` (`API_PROXY_TARGET` overrides).

## Style

- Formatting via oxfmt: single quotes, no trailing commas, `bracketSameLine: true` (see `.oxfmtrc.json`; ignores `**/drizzle`, `**/dist`). Run `pnpm format` after edits.
- User-facing strings (API errors, UI text, env comments, docs) are in Chinese — keep it consistent.
