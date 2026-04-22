# 工作日志

## 记录规则

- 所有涉及代码、部署骨架或配置的改动，都要追加一条记录。
- 每条记录至少包含：
  - 时间
  - 修改范围
  - 执行过的验证
  - 当前结果
  - 下一步或风险

---

## 2026-04-21

### 本次操作

- 修复 `@/components/chat/chat-inspector-panel` 模块缺失导致的构建报错。
- 重建并清理以下文件：
  - `src/components/chat/chat-inspector-panel.tsx`
  - `src/components/chat/chat-copy.ts`
  - `src/components/chat/tool-result-card.tsx`
  - `src/components/chat/message-content.tsx`
  - `src/lib/utils.ts`
- 更新项目文档：
  - `README.md`
  - `PROJECT_NOTES.md`
  - `TODO.md`
  - `docs/agent-evolution-roadmap.md`
  - `docs/enterprise-agent-flow.md`
- 建立持续记录使用的工作日志文件。

### 验证

- `npm run lint`
- `npm run build`

### 当前结果

- 模块解析错误已修复。
- 构建与 lint 均已通过。
- 文档已切换为更干净、可维护的中文版本。

### 下一步或风险

- 继续清理剩余零散代码与历史痕迹。
- 补 runtime / repository 自动化测试。
- 持续把每次验证结果写入本文档。

## 2026-04-22

### 本次操作

- 新增生产部署文件：
  - `Dockerfile`
  - `.dockerignore`
  - `docker-compose.prod.yml`
  - `.env.production.example`
  - `deploy/nginx/nginx.conf`
  - `docs/deploy-docker-prod.md`
- 调整 `next.config.ts`：
  - 启用 `output: "standalone"`
  - 增加 `deploymentId`
  - 关闭 `poweredByHeader`
  - 为反向代理流式响应增加 `X-Accel-Buffering: no`
- 新增 `src/app/api/health/route.ts` 作为容器健康检查入口。
- 修正 `.gitignore`，允许提交 `.env.example` 与 `.env.production.example` 这类示例环境文件。
- 为 Docker 构建阶段补充 `DATABASE_URL` build args，并去掉 `migrate` 服务的 `profiles` 依赖，兼容老版 `docker-compose`。
- 为 `Dockerfile` 的 `DATABASE_URL` 增加默认占位值，避免老版 `docker-compose` 未传递 build args 时阻塞 `prisma generate`。
- 移除 `tools` 阶段构建时的 `prisma generate`，改为 `migrate` 容器启动后再执行，避免老版 `docker-compose` 在 build 阶段缺失真实环境变量时失败。
- 将反向代理从 Nginx 切换为 Caddy，启用 `chat.crushzone.icu` 的自动 HTTPS，并将 `www.chat.crushzone.icu` 重定向到主域名。
- 新增 GitHub Actions 自动部署：
  - `.github/workflows/deploy-prod.yml`
  - `deploy/deploy-prod.sh`

### 验证

- `npm run lint`
- `npm run build`
- `docker compose -f docker-compose.prod.yml config`
- `.gitignore` 修正后，`git status --short` 已确认 `.env.example` 与 `.env.production.example` 可被跟踪
- `npm run lint`
- `npm run lint`
- `npm run lint`

### 当前结果

- 仓库已具备方案 C 所需的最小生产容器化骨架。
- 已支持外部 PostgreSQL + Docker Compose + Nginx 反向代理。
- 已补齐首次上线和后续更新文档。
- `lint` 与 `build` 已通过，`/api/health` 已进入构建产物。
- 示例环境文件已可正常进入 Git 跟踪。
- 生产编排现在兼容 `docker-compose`，并能在构建阶段为 Prisma 提供 `DATABASE_URL`。
- 即使老版 `docker-compose` 不传递 build args，构建阶段也不会再因为缺少 `DATABASE_URL` 中断。
- `migrate` 服务不再依赖构建阶段可用的数据库环境变量，改为运行时用 `.env.production` 里的真实连接串执行 Prisma。
- 生产编排现已默认使用 Caddy 自动管理 HTTPS 证书。
- 仓库已具备基于 GitHub Actions + SSH 的自动部署能力。

### 下一步或风险

- 仍需根据你的真实服务器信息填写 `.env.production`。
- 需要先确保 `chat.crushzone.icu` 与 `www.chat.crushzone.icu` 的 DNS 解析和腾讯云安全组 `80/443` 已正确放行，Caddy 才能成功签发证书。
- 服务器执行前仍需要 `set -a; source .env.production; set +a`，让 `build.args` 能拿到 `DATABASE_URL`。
- 需要在 GitHub 仓库里配置 `SSH_*` 和部署路径相关 Secrets，自动部署工作流才会生效。
