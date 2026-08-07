# Yona-Link

自托管的短链接服务，包含核心服务器与 Web 管理页面，前后端可独立部署。

## 功能特性

- 单端口架构：短链跳转与管理 API 共用同一端口，API 固定使用 `/api` 保留路径
  - `[domain]` → 默认跳转目标
  - `[domain]/@[name]` → 自定义名称跳转
  - `[domain]/[hash]` → 随机 hash 跳转（默认长度 6）
- 短链支持**长期**与**临时**（可设置过期时间）
- 删除或失效后进入**保留期**（默认 7 天，期内不可访问、code 不可复用，超期自动清理）
- **用户账号鉴权**：管理员账号由环境变量配置，可创建/管理其他用户（创建、启停、删除、重置密码）
- 每条短链记录**创建者**：普通用户只能查看/管理自己创建的短链，管理员可查看全部用户短链
- Web 管理页面：支持保存多套「API 地址 + 账号」配置并一键切换（浏览器 localStorage）

## 快速开始

### 环境要求

- Bun ≥ 1.2
- PNPM ≥ 9

### 安装与初始化

```bash
pnpm install

# 生成并应用数据库迁移（默认数据库位于 packages/server/data/）
pnpm --filter @yona-link/server db:generate
pnpm --filter @yona-link/server db:migrate
```

> 服务器启动**不会**自动执行迁移，修改 schema 后需手动执行上述命令；生产部署见「服务器单文件打包与部署」。

### 配置

```bash
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env
```

关键配置（`packages/server/.env`）：

| 变量                         | 默认值                | 说明                                                 |
| ---------------------------- | --------------------- | ---------------------------------------------------- |
| `ADMIN_USERNAME`             | `admin`               | 管理员账号（启动时自动创建/同步）                    |
| `ADMIN_PASSWORD`             | —（必填）             | 管理员密码                                           |
| `PORT`                       | `3000`                | 服务端口（跳转与 API 共用）                          |
| `DEFAULT_REDIRECT_URL`       | —                     | 根路径默认跳转目标                                   |
| `PUBLIC_LINK_DOMAIN`         | —                     | 对外展示完整短链的域名（如 `https://s.example.com`） |
| `HASH_LENGTH`                | `6`                   | 随机 hash 长度（3-32）                               |
| `RETENTION_DAYS`             | `7`                   | 删除/失效后保留天数                                  |
| `DATABASE_PATH`              | `./data/yona-link.db` | SQLite 数据库文件路径                                |
| `MIGRATIONS_FOLDER`          | `./drizzle`           | 迁移脚本读取的迁移文件目录                           |
| `SESSION_TTL_DAYS`           | `7`                   | 登录会话有效期（天）                                 |
| `RATE_LIMIT_MAX`             | `120`                 | API 每分钟每 IP 请求上限                             |
| `RESPONSE_301_FOR_PERMANENT` | `false`               | 长期链接跳转是否使用 301（默认 302）                 |

Web 端（`packages/web/.env`）：`VITE_API_BASE_URL`（默认 `/api`，仅作为未保存任何账号配置时的兜底地址）。

### 启动

```bash
# 开发模式（并行启动前后端，前端 /api 代理到 3000）
pnpm dev

# 单独启动
pnpm dev:server
pnpm dev:web

# 生产：构建 Web 产物
pnpm build

# 生产：启动核心服务器（不会自动迁移，监听单端口）
pnpm start
```

## 服务器单文件打包与部署

服务器可打包为**单文件 JS**，配合 `.env` 在任意目录直接运行——无需安装依赖、无需源码，只需 Bun。

### 打包

```bash
pnpm build:server
```

产物位于 `packages/server/dist/`：

```
dist/
├── yona-link.js      # 服务器单文件（API + 短链跳转，不含迁移逻辑）
├── migrate.js        # 独立迁移脚本
└── drizzle/          # 迁移 SQL 目录（migrate.js 运行所需）
```

### 部署

将产物与 `.env` 放入同一目录（`drizzle/` 须与 `migrate.js` 同目录，或通过 `MIGRATIONS_FOLDER` 指定）：

```
/opt/yona-link/
├── yona-link.js
├── migrate.js
├── drizzle/
└── .env
```

`.env` 至少需要配置 `ADMIN_PASSWORD`（必填），完整示例见 `packages/server/.env.example`。Bun 会自动加载当前目录的 `.env`。

首次部署或升级版本后，先执行迁移（可重复执行，无新迁移时是 no-op）：

```bash
bun migrate.js
```

启动服务（服务器不会自动迁移，也不依赖任何安装步骤）：

```bash
bun yona-link.js
```

> 默认 `DATABASE_PATH` 为当前目录下的 `data/yona-link.db`；`MIGRATIONS_FOLDER` 默认取当前目录下的 `drizzle/`，均可通过环境变量覆盖。相对路径均基于启动时的当前目录解析。

### 升级

用新版 `yona-link.js` / `migrate.js` / `drizzle/` 替换旧文件 → 重新执行 `bun migrate.js` → 重启服务。

## Web 管理面板

访问 `http://localhost:5173`（开发）或部署后的静态站点：

- **登录**：输入「配置名称（可选）+ API 地址 + 用户名 + 密码」，勾选「登录成功后保存为账号配置」即可保存多套账号；列表可一键切换、删除
- **短链接**：分页/筛选列表（仅自己的短链）、新建、编辑、删除（二次确认，提示保留期）、点击统计
- **全部链接**（仅管理员）：查看所有用户创建的短链，可按「创建者」筛选
- **用户管理**（仅管理员）：创建用户（设置初始密码）、启停、重置密码、删除
- 侧边栏显示当前用户名与角色，点击可打开账号配置弹窗

### 部署静态站点

```bash
# 指定后端 API 地址后构建（否则默认 /api，需反向代理同源）
VITE_API_BASE_URL=https://api.example.com/api pnpm --filter @yona-link/web build
```

构建产物位于 `packages/web/dist/`，可使用任意静态托管服务部署。

## API 文档

鉴权：登录后请求头携带 `Authorization: Bearer <token>`。
统一响应：`{ "ok": true, "data": ... }` / `{ "ok": false, "error": { "code", "message" } }`。

### 登录与创建第一个短链

```bash
# 1. 登录获取会话 Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你的管理员密码"}' | jq -r .data.token)

# 2. 创建短链（随机 hash）
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"hash","targetUrl":"https://example.com","permanent":true}'

# 3. 创建自定义名称短链
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"alias","code":"my-link","targetUrl":"https://example.com","permanent":false,"expiresAt":"2026-12-31T23:59:59Z"}'
```

> 注意：`/api` 为保留路径，短链 code 不可使用 `api`/`health`（大小写不敏感）。
> 配置了 `PUBLIC_LINK_DOMAIN` 后，创建接口会返回完整的 `shortUrl`。

### 接口列表

| 方法/路径                    | 权限             | 说明                                     |
| ---------------------------- | ---------------- | ---------------------------------------- |
| `POST /api/auth/login`       | —                | 用户名 + 密码登录，返回 Token            |
| `POST /api/auth/logout`      | 任意有效 Token   | 注销当前会话                             |
| `GET /api/auth/verify`       | 任意有效 Token   | 校验 Token 并返回用户信息                |
| `GET /api/system/info`       | 任意有效 Token   | 系统配置与链接/用户计数                  |
| `POST /api/links`            | `links:create`   | 创建短链（归属当前用户）                 |
| `GET /api/links`             | `links:read`     | 分页/筛选列表（仅自己的短链）            |
| `GET /api/links/all`         | `links:view_all` | 全部短链（仅管理员，支持 `userId` 筛选） |
| `GET /api/links/:code`       | `links:read`     | 详情（只能访问自己的）                   |
| `PATCH /api/links/:code`     | `links:update`   | 更新（只能操作自己的）                   |
| `DELETE /api/links/:code`    | `links:delete`   | 删除（进入保留期）                       |
| `GET /api/links/:code/stats` | `links:stats`    | 点击统计                                 |
| `GET /api/users`             | `users:manage`   | 用户列表（含链接数）                     |
| `POST /api/users`            | `users:manage`   | 创建用户（用户名 + 密码）                |
| `PATCH /api/users/:id`       | `users:manage`   | 启停 / 重置密码                          |
| `DELETE /api/users/:id`      | `users:manage`   | 删除用户                                 |

权限：普通用户拥有 `links:read`/`links:create`/`links:update`/`links:delete`/`links:stats`；管理员额外拥有 `links:view_all` 与 `users:manage`。

## 安全说明

- 用户密码使用 **argon2id** 哈希（Bun 内置），不以明文存储
- 登录会话为随机不透明 Token，仅存 SHA-256 摘要，可被注销/撤销
- 普通用户只能访问自己创建的短链，越权访问返回 404（不泄露存在性）
- URL 仅允许 http/https 协议；code 字符集 `[a-zA-Z0-9_-]`
- API 有每分钟每 IP 限流（`RATE_LIMIT_MAX`），含登录接口
