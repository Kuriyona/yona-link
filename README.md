# Kuriyona Links

自托管的短链接服务，运行在 Cloudflare Workers 上：短链跳转、管理 API 与 Web 管理面板由同一个 Worker 提供，数据存储在 Cloudflare D1。

## 功能特性

- 单 Worker 架构
  - `[domain]` → 默认跳转目标
  - `[domain]/@[name]` → 自定义名称跳转
  - `[domain]/[hash]` → 随机 hash 跳转（默认长度 6）
  - `[domain]/api/*` → 管理 API（保留路径）
  - `[domain]/panel` → Web 管理面板（保留路径）
  - `[domain]/health` → 健康检查
- 短链支持**长期**与**临时**（可设置过期时间）
- 删除或失效后进入**保留期**（默认 7 天，期内不可访问、code 不可复用，超期在跳转时自动清理）
- **用户账号鉴权**：管理员账号由环境变量/Secret 配置，可创建/管理其他用户（创建、启停、删除、重置密码）；面板使用 HttpOnly Cookie 会话
- 每条短链记录**创建者**：普通用户只能查看/管理自己创建的短链，管理员可查看全部用户短链
- 无 Node 依赖：Hono + Drizzle ORM + D1，面板作为 Workers 静态资源部署

## 环境要求

- Node.js ≥ 20 与 PNPM ≥ 9（仅用于构建和部署）
- Cloudflare 账号，且已 `wrangler login`

## 本地开发

```bash
pnpm install

# 1. 生成本地配置文件（wrangler.jsonc 已被 gitignore，只提交示例）
cp packages/worker/wrangler.example.jsonc packages/worker/wrangler.jsonc

# 2. 准备本地环境变量（ADMIN_PASSWORD 必填）
cp packages/worker/.dev.vars.example packages/worker/.dev.vars

# 3. 初始化本地 D1（不校验远程 database_id）
pnpm db:migrate:local

# 4. 同时启动 Worker(8787) 与前端开发服务器
pnpm dev
```

- Worker/API：`http://localhost:8787`
- 面板开发地址：`http://localhost:5173/panel/`（Vite 将 `/api` 代理到 8787）
- 也可以先 `pnpm build`，再直接访问 `http://localhost:8787/panel/`

单测与类型检查：

```bash
pnpm test
pnpm typecheck
```

## 部署到 Cloudflare

### 1. 创建自己的 D1 数据库

`database_id` 是每个 Cloudflare 账号独有的，**不能复用别人的 ID**。仓库只提交 `wrangler.example.jsonc`，实际配置文件 `wrangler.jsonc` 已被 gitignore，每个部署者都需要创建并填写自己的配置：

```bash
cd packages/worker
cp wrangler.example.jsonc wrangler.jsonc
wrangler d1 create kuriyona-links
```

把输出中的 `database_id` 填入 `packages/worker/wrangler.jsonc`：

```jsonc
"database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID" // ← 替换成自己的 UUID
```

### 2. 应用迁移

#### 迁移是什么

建表 SQL 都在 `packages/worker/migrations/*.sql`，由 drizzle-kit 根据 `src/db/schema.ts` 生成，已提交到仓库。Wrangler 会按文件名顺序执行这些 SQL，并把执行记录写进数据库里的 `d1_migrations` 表，所以重复执行只会跑“尚未应用”的文件，不会重复建表。

**部署 Worker 不会自动执行迁移**。必须单独跑一次迁移命令。

#### 首次部署

在仓库根目录执行（脚本会自动切到 `packages/worker`）：

```bash
pnpm db:migrate:remote
```

等价于在 `packages/worker` 下：

```bash
wrangler d1 migrations apply kuriyona-links --remote
```

执行后 Wrangler 会列出待应用的迁移并让你确认，输入 `y` 即可。`--remote` 表示操作线上 D1；**不加 `--remote` 默认是本地模拟数据库**。

> 命令里的 `kuriyona-links` 必须和 `wrangler.jsonc` 里的 `database_name` 一致；`wrangler.jsonc` 必须是你填好真实 `database_id` 的那份。

#### 本地开发与线上是两套库

| 命令                     | 操作对象                          | 用途                     |
| ------------------------ | --------------------------------- | ------------------------ |
| `pnpm db:migrate:local`  | `.wrangler/state` 下的本地模拟 D1 | 本地 `pnpm dev` 前初始化 |
| `pnpm db:migrate:remote` | Cloudflare 上的真实 D1            | 部署前升级线上库         |

两者互不影响：本地迁移成功不代表线上已建表，反之亦然。

#### 修改 schema 后（升级时）

1. 修改 `packages/worker/src/db/schema.ts`。
2. 生成新迁移（只生成 SQL，不碰数据库）：

   ```bash
   pnpm db:generate
   ```

   会在 `migrations/` 下新增一个 `000X_xxx.sql`，把生成的文件一起提交。

3. 本地验证：

   ```bash
   pnpm db:migrate:local
   pnpm dev
   ```

4. 部署前应用到线上：

   ```bash
   pnpm db:migrate:remote
   pnpm run deploy
   ```

   建议先迁移、再部署：本项目的表结构变更都是增量式（新表/新列），旧版 Worker 仍能工作；反过来先部署新版代码、却还没建表，接口会直接报错。

**不要修改已经应用过的迁移文件**。要改表结构就生成一个新迁移，否则本地和线上记录的迁移状态会不一致。

#### 检查迁移状态

查看还有哪些迁移尚未应用：

```bash
# 在 packages/worker 下
wrangler d1 migrations list kuriyona-links --remote
```

查看已经应用过的记录：

```bash
wrangler d1 execute kuriyona-links --remote --command "select name from d1_migrations"
```

需要备份线上数据时：

```bash
wrangler d1 export kuriyona-links --remote --output backup.sql
```

### 3. 配置管理员密码

`ADMIN_PASSWORD` 为必填 Secret（不要写进 `wrangler.jsonc`）：

```bash
cd packages/worker
wrangler secret put ADMIN_PASSWORD
```

管理员账号在首次请求时自动创建。之后修改 `ADMIN_PASSWORD` **不会**重置已有管理员密码——需要重置时，可在 D1 中手动更新或删除该用户后重新触发创建。

其余配置可通过 Worker 的环境变量设置（`wrangler.jsonc` 的 `vars` 或 Secret），均有默认值。

### 4. 构建面板并部署

```bash
pnpm run deploy   # 先构建面板到 packages/worker/public/panel/，再 wrangler deploy
```

> `deploy` 是 pnpm 的内置命令名，因此这里必须用 `pnpm run deploy`。
>
> `wrangler.jsonc` 是本地/私有配置，不会被提交。通过 GitHub 集成自动部署时构建环境里没有这个文件，因此需要在 CI 中生成配置，或改用本地 `pnpm run deploy`。

部署后：

- 管理面板：`https://<你的域名>/panel`
- API：`https://<你的域名>/api`
- 短链：`https://<你的域名>/<code>` 或 `/@<name>`

推荐在 Cloudflare 控制台为 Worker 绑定自定义域名，短链展示更简洁。

### 从 GitHub 自动部署

在 Cloudflare Dashboard 选择 Workers → Connect to Git，构建配置建议：

```
Root directory:  /
Build command:   pnpm install --frozen-lockfile && pnpm build
Deploy command:  pnpm --filter @kuriyona/links-worker exec wrangler deploy
```

Git 集成不会替使用者创建 D1、不会执行迁移、不会读取 `.dev.vars`，也不会拿到被 gitignore 的 `wrangler.jsonc`；首次部署前仍需完成上面的创建 D1、生成配置、替换 `database_id`、迁移和 Secret 配置。若坚持 GitHub 自动部署，需要把配置文件纳入仓库或由构建命令生成 `wrangler.jsonc`。预览部署默认共用同一个 D1，请勿在连接生产库时开启不可信的 PR 预览。

### 升级

```bash
pnpm install
pnpm db:migrate:remote   # 如有新迁移
pnpm run deploy
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

访问 `/panel`：

- **登录**：输入用户名和密码；会话保存在 HttpOnly Cookie 中，刷新页面无需重新登录
- **短链接**：分页/筛选列表（仅自己的短链）、新建、编辑、删除（二次确认，提示保留期）、点击统计
- **全部链接**（仅管理员）：查看所有用户创建的短链，可按「创建者」筛选
- **用户管理**（仅管理员）：创建用户（设置初始密码）、启停、重置密码、删除
- 侧边栏显示当前用户名与角色，可退出登录

面板与 API 同源，不再需要填写 API 地址或保存多套账号配置。

## API 文档

鉴权：登录后可使用 Cookie 会话（浏览器）或 `Authorization: Bearer <token>`（脚本/CLI）。
统一响应：`{ "ok": true, "data": ... }` / `{ "ok": false, "error": { "code", "message" } }`。

### 登录与创建第一个短链

```bash
BASE=https://<你的域名>

# 1. 登录获取会话 Token
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你的管理员密码"}' | jq -r .data.token)

# 2. 创建短链（随机 hash）
curl -X POST $BASE/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"hash","targetUrl":"https://example.com","permanent":true}'

# 3. 创建自定义名称短链
curl -X POST $BASE/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"alias","code":"my-link","targetUrl":"https://example.com","permanent":false,"expiresAt":"2026-12-31T23:59:59Z"}'
```

> 保留路径：短链 code 不可使用 `api`、`health`、`panel`（大小写不敏感）。
> 配置了 `PUBLIC_LINK_DOMAIN` 后，创建接口会返回完整的 `shortUrl`。
> 写操作会校验 `Origin`/`Referer`；脚本请使用 Bearer Token（不带浏览器 Origin 的请求不受影响）。

### 接口列表

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

权限：普通用户拥有 `links:read`/`links:create`/`links:update`/`links:delete`/`links:stats`；管理员额外拥有 `links:view_all` 与 `users:manage`。
