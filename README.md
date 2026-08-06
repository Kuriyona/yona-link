# Yona-Link

自托管的短链接服务，包含核心服务器与 Web 管理页面，前后端完全独立部署。

## 功能特性

- 单端口架构：短链跳转与管理 API 共用同一端口，API 固定使用 `/api` 保留路径
  - `[domain]` → 默认跳转目标
  - `[domain]/@[name]` → 自定义名称跳转
  - `[domain]/[hash]` → 随机 hash 跳转（默认长度 6）
  - `[domain]/api/*` → 管理 API（保留路径，不可被短链占用）
- 短链支持**长期**与**临时**（可设置过期时间）
- 删除或失效后进入**保留期**（默认 7 天，期内不可访问、code 不可复用，超期自动清理）
- REST API 作为唯一管理方式，基于 API Key 鉴权
  - 核心管理员 Key（环境变量 `ADMIN_KEY`）拥有全部权限
  - 普通 Key 可自由创建/编辑，支持**细粒度权限**
- Web 管理页面：Vue 3 静态 SFC，最小化自写 CSS，无 UI 框架依赖
  - **多账号配置**：可保存多套「API 地址 + API Key」账号并一键切换（浏览器 localStorage）

## 技术栈

- 包管理器：PNPM（单仓库 workspace）
- 运行时：Bun
- 后端：Elysia + Drizzle ORM（SQLite）
- 前端：Vue 3 + Vite + vue-router + Pinia
- 代码格式化：oxfmt（`.oxfmtrc.json`），无 linter

## 目录结构

```
yona-link/
├── .oxfmtrc.json              # oxfmt 格式化配置
├── package.json               # workspace 根脚本编排
├── pnpm-workspace.yaml        # packages/*
├── packages/
│   ├── server/                # 核心服务器（Bun + Elysia + SQLite）
│   │   ├── src/
│   │   │   ├── index.ts       # 入口：加载配置/DB 并自动迁移，监听单端口
│   │   │   ├── app.ts         # 合并 API + 短链跳转，统一 JSON 404
│   │   │   ├── config.ts      # 环境变量配置
│   │   │   ├── db/            # Drizzle schema、bun:sqlite 客户端、迁移
│   │   │   ├── services/      # 链接/Key 业务逻辑、hash 生成
│   │   │   ├── api/           # /api 前缀的管理 API（auth、links、keys、cors）
│   │   │   └── link/          # 短链跳转路由
│   │   ├── drizzle/           # 生成的 SQL 迁移文件
│   │   └── tests/             # bun test（内存 SQLite）
│   └── web/                   # Web 管理页面（Vue 3 静态 SFC）
│       └── src/
│           ├── api/           # HTTP 客户端与多账号凭据管理
│           ├── stores/        # Pinia（auth / profiles）
│           ├── views/         # 登录、短链接列表、编辑、统计、Key 管理
│           └── components/    # 通用弹窗（API 设置等）
```

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

> 服务器启动时会自动应用未执行的迁移，`db:push` 可用于开发期直接同步 schema（不生成迁移文件）。

### 配置

复制并编辑环境变量文件：

```bash
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env
```

关键配置（`packages/server/.env`）：

| 变量                         | 默认值                | 说明                                                 |
| ---------------------------- | --------------------- | ---------------------------------------------------- |
| `ADMIN_KEY`                  | —（必填）             | 核心管理员 Key                                       |
| `PORT`                       | `3000`                | 服务端口（跳转与 API 共用）                          |
| `DEFAULT_REDIRECT_URL`       | —                     | 根路径默认跳转目标                                   |
| `PUBLIC_LINK_DOMAIN`         | —                     | 对外展示完整短链的域名（如 `https://s.example.com`） |
| `HASH_LENGTH`                | `6`                   | 随机 hash 长度（3-32）                               |
| `RETENTION_DAYS`             | `7`                   | 删除/失效后保留天数                                  |
| `DATABASE_PATH`              | `./data/yona-link.db` | SQLite 数据库文件路径                                |
| `API_KEY_PREFIX`             | `yl_`                 | 生成普通 API Key 的可见前缀                          |
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

# 生产：启动核心服务器（自动迁移 + 监听单端口）
pnpm start
```

## Web 管理面板

访问 `http://localhost:5173`（开发）或部署后的静态站点：

- **登录**：输入「配置名称（可选）+ API 地址 + API Key」，勾选「登录成功后保存为账号配置」即可保存多套账号；列表可一键切换、删除
- **短链接**：分页/筛选列表、新建、编辑、删除（二次确认，提示保留期）、点击统计
- **API Keys**（仅 `keys:manage` 权限）：创建（权限多选，明文仅显示一次）、编辑权限、启停、删除
- 侧边栏显示当前账号名，点击可打开账号配置弹窗

## 使用 API 创建第一个短链

```bash
# 创建短链（随机 hash）
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"hash","targetUrl":"https://example.com","permanent":true}'

# 创建自定义名称短链
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"alias","code":"my-link","targetUrl":"https://example.com","permanent":false,"expiresAt":"2026-12-31T23:59:59Z"}'
```

> 注意：`/api` 为保留路径，短链 code 不可使用 `api`/`health`（大小写不敏感）。
> 配置了 `PUBLIC_LINK_DOMAIN` 后，创建接口会返回完整的 `shortUrl`。

## API 概览

鉴权：请求头 `Authorization: Bearer <key>` 或 `X-API-Key: <key>`。
统一响应：`{ "ok": true, "data": ... }` / `{ "ok": false, "error": { "code", "message" } }`。

| 方法/路径                    | 权限           | 说明                       |
| ---------------------------- | -------------- | -------------------------- |
| `GET /api/auth/verify`       | 任意有效 Key   | 校验 Key 并返回权限        |
| `GET /api/system/info`       | 任意有效 Key   | 系统配置与链接计数         |
| `POST /api/links`            | `links:create` | 创建短链                   |
| `GET /api/links`             | `links:read`   | 分页/筛选列表              |
| `GET /api/links/:code`       | `links:read`   | 详情                       |
| `PATCH /api/links/:code`     | `links:update` | 更新                       |
| `DELETE /api/links/:code`    | `links:delete` | 删除（进入保留期）         |
| `GET /api/links/:code/stats` | `links:stats`  | 点击统计                   |
| `GET /api/keys`              | `keys:manage`  | Key 列表                   |
| `POST /api/keys`             | `keys:manage`  | 创建 Key（明文仅返回一次） |
| `PATCH /api/keys/:id`        | `keys:manage`  | 编辑 Key                   |
| `DELETE /api/keys/:id`       | `keys:manage`  | 删除 Key                   |

权限：`links:read`、`links:create`、`links:update`、`links:delete`、`links:stats`、`keys:manage`。

## Web 管理页面部署

```bash
# 指定后端 API 地址后构建（否则默认 /api，需反向代理同源）
VITE_API_BASE_URL=https://api.example.com/api pnpm --filter @yona-link/web build
```

构建产物位于 `packages/web/dist/`，可使用任意静态托管服务部署。

## 测试与质量

```bash
pnpm test          # 后端单元/集成测试（bun test）
pnpm typecheck     # 全仓类型检查
pnpm format        # 使用 oxfmt 格式化代码（配置 .oxfmtrc.json）
pnpm format:check  # 检查代码是否已格式化
```

## 安全说明

- 普通 API Key 仅存储 SHA-256 摘要，创建后明文只展示一次
- `ADMIN_KEY` 使用恒定时间比较
- URL 仅允许 http/https 协议；code 字符集 `[a-zA-Z0-9_-]`
- API 有每分钟每 IP 限流（`RATE_LIMIT_MAX`）
