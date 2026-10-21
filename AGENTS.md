# AGENTS.md

Kuriyona Links: self-hosted short-link service on Cloudflare Workers. pnpm monorepo with two packages: `packages/worker` (Hono + Drizzle/D1, serves API, redirects, and the panel) and `packages/web` (Vue 3 + Vite + Pinia). No linter — formatting only (oxfmt).

## Commands

- `pnpm dev` — worker (`wrangler dev`, port 8787) + web (`vite`, panel at `http://localhost:5173/panel/`) in parallel. `pnpm dev:worker` / `pnpm dev:web` for one.
- `pnpm test` — worker tests (Vitest inside workerd, `@cloudflare/vitest-plugin`).
- `pnpm typecheck` — worker `wrangler types && tsc --noEmit` + web `vue-tsc -b`.
- `pnpm format` / `pnpm format:check` — oxfmt with `.oxfmtrc.json`. **There is no lint gate.**
- `pnpm build` — builds the panel only; Vite outputs into `packages/worker/public/panel/` with base `/panel/`. The worker needs no build (wrangler bundles on deploy).
- `pnpm run deploy` — builds the panel, then `wrangler deploy` from `packages/worker`. Use `run` because `deploy` is also a pnpm built-in command.
- DB: `pnpm db:generate` (drizzle-kit, writes `packages/worker/migrations/`), `pnpm db:migrate:local`, `pnpm db:migrate:remote` (`wrangler d1 migrations apply kuriyona-links`). `wrangler.jsonc` sets `migrations_dir: migrations`; drizzle meta files live under `migrations/meta/` and are ignored by Wrangler.
- Local setup: copy `packages/worker/wrangler.example.jsonc` to `wrangler.jsonc` (gitignored, holds the real D1 ID), copy `.dev.vars.example` to `.dev.vars` (gitignored), `pnpm db:migrate:local`, then `pnpm dev`.
- Only `wrangler.example.jsonc` is tracked. Tests and `typecheck` deliberately use the example config (`vitest.config.ts`, `wrangler types --config`); `dev`/`deploy`/`db:migrate:*` use the local `wrangler.jsonc`.

## Worker architecture

- One Worker handles everything: `/api/*` management API, `/panel` static admin panel, `/health`, `/` default redirect, `/:code` short-link redirects. `src/app.ts` composes them.
- `/api` and `/health` and `/panel` are reserved. Codes `api`/`health`/`panel` (case-insensitive) are rejected when creating links and skipped in hash generation (`RESERVED_PATHS` / `isReservedPath` in `src/types.ts`).
- Redirects: ONE route `/:code`; alias vs hash is decided by a leading `@` (`/@name`). A missing path or wrong type returns 404 (JSON `{ message: 'Not Found' }`); retired/expired links return 410. `POST /api/...` unmatched paths return the unified JSON 404 via an explicit `api.all('*')` fallback — Hono sub-app `notFound` does not propagate through `.route()`.
- **Auth = user accounts + sessions** (no API keys). `POST /api/auth/login` returns an opaque token **and** sets it as an `HttpOnly; SameSite=Lax` cookie (`kl_session`); only the token's SHA-256 is stored in `sessions` (`src/services/session-service.ts`). The panel uses the cookie; API clients can keep using `Authorization: Bearer`. Passwords use PBKDF2-SHA256 (100k iterations, random salt) via Web Crypto — `Bun.password` is unavailable in Workers (`src/services/crypto.ts`).
- Admin user is seeded lazily, once per isolate (`ensureAdminBootstrapped` in `src/services/user-service.ts`). `ADMIN_PASSWORD` is required; seeding only creates the admin when missing and repairs `role`/`enabled`, it does **not** reset an existing password. Changing the secret therefore requires a manual password reset.
- **Roles**: `admin` (all perms incl. `links:view_all`, `users:manage`) vs `user` (only `links:read/create/update/delete/stats`) — `permissionsForRole` in `src/types.ts`. Every link stores `created_by`; non-admin list/get/update/delete/stats are scoped to the owner (cross-user access returns 404).
- `GET /api/links` = own links; `GET /api/links/all` (admin only) = all links + `?userId=` filter. User management: `src/routes/users.ts`.
- Rate limiting is an in-memory Map per isolate (`src/middleware/rate-limit.ts`) — approximate by design; no Durable Object/KV state.
- All mutating API requests run through `csrfGuard` (`src/middleware/auth.ts`), which rejects a present but mismatched `Origin`/`Referer` (covers cookie CSRF and login CSRF). Requests without either header (CLI) pass. There is no CORS middleware: the panel is same-origin under `/panel`, and Bearer API clients are not browser-ambient.
- `wrangler.jsonc` ships a placeholder `database_id` (`REPLACE_WITH_YOUR_D1_DATABASE_ID`); each deployment must create its own D1 and replace it. `database_name` is only used by CLI commands.
- `cleanupRetired` runs at most once per hour per isolate on redirect, not as a cron.

## D1 / Drizzle

- Runtime DB is the `DB` D1 binding; `createDb(env.DB)` wraps `drizzle-orm/d1` (`src/db/client.ts`). No `bun:sqlite`, no Node APIs.
- Drizzle D1 query builders must be awaited or terminal `.all()`; single-row helpers use `.all()` + destructure. `RETURNING` is used for inserts/updates (D1 supports it).
- Schema in `src/db/schema.ts`; migrations are generated SQL under `migrations/`. Never edit applied migration files — generate a new one.
- Tests run against a real local D1 in workerd with migrations applied from `tests/setup.ts` (`applyD1Migrations`). In Vitest 4 storage is isolated **per file, not per test** — `resetDb()` in `tests/helpers.ts` clears tables in `beforeEach`.

## Panel (packages/web)

- Vite `base` is `/panel/`; router uses `createWebHistory(import.meta.env.BASE_URL)`. Build output goes to `packages/worker/public/panel/` (gitignored).
- Workers Assets serves matching files first (`assets.not_found_handling: "none"`); unmatched `/panel/*` requests reach the worker, which returns `/panel/index.html` for SPA routes. `/panel` redirects to `/panel/`.
- Login is username + password only. The session lives in an HttpOnly cookie, so there is no token or instance URL in localStorage; `client.ts` calls same-origin `/api` with `credentials: 'same-origin'`.
- Permission gating: `auth.hasPermission('...')` everywhere. Routes `links:view_all` (`/links/all`) and `users:manage` (`/users`) are admin-only.
- `@/` alias → `src/`. Vite dev proxies `/api` → `http://localhost:8787` (`API_PROXY_TARGET` overrides; `WORKER_PORT` changes the default port).
- Dev proxy must keep the browser's `Origin`/`Host` (no `changeOrigin`), otherwise the CSRF guard sees a mismatched origin.

## Testing

- Tests use `app.request(path, init, env)` against the real Hono app in workerd — no live server. Env bindings come from `vitest.config.ts` (`miniflare.bindings`), including `ADMIN_PASSWORD` and `TEST_MIGRATIONS`.
- Helpers in `tests/helpers.ts`: `seedAdmin()` (resets DB then seeds admin), `resetDb()`, `loginAs()`, `authed()`. API responses are `{ ok, data }` / `{ ok: false, error: { code, message } }`.
- `wrangler.jsonc` changes require `pnpm cf-typegen` before typecheck (the `typecheck` script does it automatically).

## Style

- Formatting via oxfmt: single quotes, no trailing commas, `bracketSameLine: true` (see `.oxfmtrc.json`; ignores `**/migrations`, `**/dist`). Run `pnpm format` after edits.
- User-facing strings (API errors, UI text, env comments, docs) are in Chinese — keep it consistent.
- `README.md` is **user-facing only** (usage + simple API docs) — do not put implementation details there. Implementation notes and dev conventions live in this file.
