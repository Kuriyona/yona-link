# Kuriyona Links

自托管的短链接服务，运行在 Cloudflare Workers 上：短链跳转、管理 API 与 Web 管理面板由同一个 Worker 提供，数据存储在 Cloudflare D1。

- `[domain]` → 默认跳转目标；`[domain]/@[name]` → 自定义名称；`[domain]/[hash]` → 随机 hash
- `/panel` 管理面板、`/api` 管理 API、`/health` 健康检查（这三个为保留路径）
- 短链支持长期与临时（可设过期时间）；删除/失效后进入保留期（默认 7 天，期内不可访问、code 不可复用）
- 用户账号鉴权（管理员由环境变量初始化），普通用户只能管理自己的短链

## 环境要求

- Node.js ≥ 20 与 PNPM ≥ 9（仅用于构建和部署）
- Cloudflare 账号，且已 `wrangler login`

## 本地开发

```bash
pnpm install

# 1. 生成配置（wrangler.jsonc 已 gitignore，只提交示例）
cp packages/worker/wrangler.example.jsonc packages/worker/wrangler.jsonc

# 2. 准备环境变量（ADMIN_PASSWORD 必填）
cp packages/worker/.dev.vars.example packages/worker/.dev.vars

# 3. 初始化本地 D1
pnpm db:migrate:local

# 4. 启动 Worker(8787) 与面板开发服务器(5173)
pnpm dev
```

- API：`http://localhost:8787`
- 面板开发地址：`http://localhost:5173/panel/`（Vite 把 `/api` 代理到 8787）
- 也可 `pnpm build` 后直接访问 `http://localhost:8787/panel/`

常用命令：`pnpm test`（Worker 单测）、`pnpm typecheck`、`pnpm format`。

## 部署

### 1. 创建 D1 并填写配置

`database_id` 每个账号不同，不能复用。仓库只提交 `wrangler.example.jsonc`，实际配置 `wrangler.jsonc` 已被 gitignore：

```bash
cd packages/worker
cp wrangler.example.jsonc wrangler.jsonc
wrangler d1 create kuriyona-links
```

把输出的 `database_id` 填入 `packages/worker/wrangler.jsonc`。

### 2. 应用迁移

部署 Worker **不会**自动执行迁移，需要单独执行（命令里的 `kuriyona-links` 必须与 `wrangler.jsonc` 的 `database_name` 一致）：

```bash
# 在仓库根目录，操作线上 D1
pnpm db:migrate:remote
```

Wrangler 会列出待应用的迁移，输入 `y` 确认。本地开发用 `pnpm db:migrate:local`，两者互不影响。

### 3. 配置管理员密码

```bash
cd packages/worker
wrangler secret put ADMIN_PASSWORD
```

管理员在首次请求时自动创建；之后修改 `ADMIN_PASSWORD` 不会重置已有密码，需要时在 D1 中手动更新或删除该用户。其余配置见下方配置项，均有默认值。

### 4. 构建面板并部署

```bash
pnpm run deploy   # 先构建面板到 packages/worker/public/panel/，再 wrangler deploy
```

> `deploy` 是 pnpm 内置命令名，必须写 `pnpm run deploy`。
>
> `wrangler.jsonc` 不在仓库中，GitHub 自动部署环境里没有它，需要由 CI 生成配置，或改用本地部署。

部署后：面板 `https://<域名>/panel`，API `https://<域名>/api`，短链 `https://<域名>/<code>` 或 `/@<name>`。推荐在 Cloudflare 控制台绑定自定义域名。

### 修改 schema / 升级

```bash
# 改完 packages/worker/src/db/schema.ts 后生成迁移并提交
pnpm db:generate

# 升级时：先迁移、再部署（新增表/列，旧版 Worker 仍可用；反过来会报错）
pnpm install
pnpm db:migrate:remote
pnpm run deploy
```

**不要修改已经应用过的迁移文件**，否则本地与线上的迁移状态会不一致。查看状态：

```bash
cd packages/worker
wrangler d1 migrations list kuriyona-links --remote
```

## 配置项

服务端变量（`packages/worker/.dev.vars` 或 Worker 环境变量/Secret）：

| 变量                         | 默认值    | 说明                                                   |
| ---------------------------- | --------- | ------------------------------------------------------ |
| `ADMIN_USERNAME`             | `admin`   | 管理员账号（首次自动创建/修复角色）                    |
| `ADMIN_PASSWORD`             | —（必填） | 管理员初始密码；仅在管理员不存在时使用                 |
| `DEFAULT_REDIRECT_URL`       | —         | 根路径默认跳转目标                                     |
| `PUBLIC_LINK_DOMAIN`         | —         | 对外展示完整短链的域名（如 `https://s.example.com`）   |
| `HASH_LENGTH`                | `6`       | 随机 hash 长度（3-32）                                 |
| `RETENTION_DAYS`             | `7`       | 删除/失效后保留天数                                    |
| `SESSION_TTL_DAYS`           | `7`       | 登录会话与 Cookie 有效期（天）                         |
| `RATE_LIMIT_MAX`             | `120`     | API 每分钟每 IP 请求上限（按 Worker isolate 近似统计） |
| `RESPONSE_301_FOR_PERMANENT` | `false`   | 长期链接跳转是否使用 301（默认 302）                   |

## Web 管理面板

访问 `/panel`，登录后：

- **短链接**：分页/筛选列表（仅自己的短链）、新建、编辑、删除（二次确认，提示保留期）、点击统计
- **全部链接**（管理员）：所有用户的短链，可按创建者筛选
- **用户管理**（管理员）：创建、启停、重置密码、删除

## API 文档

鉴权：Cookie 会话（浏览器）或 `Authorization: Bearer <token>`（脚本/CLI）。
统一响应：`{ "ok": true, "data": ... }` / `{ "ok": false, "error": { "code", "message" } }`。

```bash
BASE=https://<你的域名>

# 登录获取 Token
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你的管理员密码"}' | jq -r .data.token)

# 创建随机 hash 短链
curl -X POST $BASE/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"hash","targetUrl":"https://example.com","permanent":true}'

# 创建自定义名称短链
curl -X POST $BASE/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"alias","code":"my-link","targetUrl":"https://example.com","permanent":false,"expiresAt":"2026-12-31T23:59:59Z"}'
```

> 短链 code 不可用 `api`、`health`、`panel`（大小写不敏感）。
> 配置 `PUBLIC_LINK_DOMAIN` 后创建接口会返回完整 `shortUrl`。
> 写操作校验 `Origin`/`Referer`，脚本请用 Bearer Token。

| 方法/路径                    | 权限             | 说明                                        |
| ---------------------------- | ---------------- | ------------------------------------------- |
| `POST /api/auth/login`       | —                | 用户名 + 密码登录，返回 Token 并写入 Cookie |
| `POST /api/auth/logout`      | 任意有效会话     | 注销当前会话并清除 Cookie                   |
| `GET /api/auth/verify`       | 任意有效会话     | 校验会话并返回用户信息                      |
| `GET /api/system/info`       | 任意有效会话     | 系统配置与链接/用户计数                     |
| `POST /api/links`            | `links:create`   | 创建短链（归属当前用户）                    |
| `GET /api/links`             | `links:read`     | 分页/筛选列表（仅自己的短链）               |
| `GET /api/links/all`         | `links:view_all` | 全部短链（仅管理员，支持 `userId` 筛选）    |
| `GET /api/links/:code`       | `links:read`     | 详情（只能访问自己的）                      |
| `PATCH /api/links/:code`     | `links:update`   | 更新（只能操作自己的）                      |
| `DELETE /api/links/:code`    | `links:delete`   | 删除（进入保留期）                          |
| `GET /api/links/:code/stats` | `links:stats`    | 点击统计                                    |
| `GET /api/users`             | `users:manage`   | 用户列表（含链接数）                        |
| `POST /api/users`            | `users:manage`   | 创建用户（用户名 + 密码）                   |
| `PATCH /api/users/:id`       | `users:manage`   | 启停 / 重置密码                             |
| `DELETE /api/users/:id`      | `users:manage`   | 删除用户                                    |

普通用户权限：`links:read`/`links:create`/`links:update`/`links:delete`/`links:stats`；管理员额外拥有 `links:view_all` 与 `users:manage`。
