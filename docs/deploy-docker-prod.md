# Docker 生产部署方案

这套方案对应当前项目的首选部署方式：

- 应用使用 Docker 容器运行
- 反向代理使用 Caddy 容器
- 数据库使用外部托管 PostgreSQL
- 首次上线和后续更新都走 `docker compose`

## 目录说明

- [Dockerfile](/E:/代码/ai项目/chat/Dockerfile)：多阶段构建，生产环境使用 Next.js `standalone` 输出
- [docker-compose.prod.yml](/E:/代码/ai项目/chat/docker-compose.prod.yml)：生产编排
- [deploy/caddy/Caddyfile](/E:/代码/ai项目/chat/deploy/caddy/Caddyfile)：Caddy 自动 HTTPS 配置
- [.env.production.example](/E:/代码/ai项目/chat/.env.production.example)：生产环境变量模板

## 服务器准备

推荐服务器环境：

- Ubuntu 22.04 LTS
- Docker Engine
- Docker Compose Plugin
- 已准备好的域名和 DNS
- 一个可连接的外部 PostgreSQL 实例

建议先开放端口：

- `22`：SSH
- `80`：HTTP
- `443`：HTTPS

同时确认 DNS 已经解析到服务器：

- `chat.crushzone.icu -> A -> 114.132.124.103`
- `www.chat.crushzone.icu -> CNAME -> chat.crushzone.icu`

## 首次上线

1. 拉代码到服务器

```bash
git clone <your-repo-url> /srv/chat
cd /srv/chat
```

2. 准备生产环境变量

```bash
cp .env.production.example .env.production
```

至少要填这些变量：

- `DATABASE_URL`
- `OPENAI_API_KEY` 或 `QWEN_API_KEY`
- `DEPLOYMENT_VERSION`

3. 先同步 Prisma schema 到生产数据库

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

4. 启动生产服务

```bash
docker compose -f docker-compose.prod.yml up -d --build app proxy
```

5. 检查运行状态

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f proxy
```

## 后续更新上线

每次发版建议都更新 `DEPLOYMENT_VERSION`，这样可以配合 Next.js 的 `deploymentId` 降低前端资源版本错位问题。

推荐更新流程：

1. 拉取最新代码

```bash
git pull
```

2. 如有 Prisma schema 变更，先同步数据库

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

3. 重建并重启服务

```bash
docker compose -f docker-compose.prod.yml up -d --build app proxy
```

4. 验证健康检查

```bash
curl http://127.0.0.1/api/health
```

如果后续接入镜像仓库，可以把 `chat-app:latest` 和 `chat-tools:latest` 改成你的仓库地址，再把上线流程切成：

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d app proxy
```

这样更新会更快。

## 反向代理说明

当前 Caddy 配置已经做了这些处理：

- 自动为 `chat.crushzone.icu` 申请和续期 HTTPS 证书
- 将 `www.chat.crushzone.icu` 永久重定向到 `chat.crushzone.icu`
- 反向代理到应用容器 `app:3000`
- 启用 gzip / zstd 压缩

如果你后续要切换域名，只需要更新 [deploy/caddy/Caddyfile](/E:/代码/ai项目/chat/deploy/caddy/Caddyfile) 里的站点域名，再重新执行：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 健康检查

项目新增了 [src/app/api/health/route.ts](/E:/代码/ai项目/chat/src/app/api/health/route.ts)：

- 应用进程正常时返回 `app: ok`
- 数据库可连通时返回 `database: ok`
- 如果缺少 `DATABASE_URL` 或数据库不可达，会返回 `503`

这既方便 Docker 健康检查，也方便上线后的人工排查。

## 建议的下一步

- 接入镜像仓库和 CI/CD
- 把 `docker compose up -d --build` 升级成 `pull + up -d`
- 后续如需多实例，再补共享缓存和部署版本管理

## GitHub Actions 自动部署

仓库已经提供：

- [deploy/deploy-prod.sh](/E:/代码/ai项目/chat/deploy/deploy-prod.sh)：服务器上的部署脚本
- [.github/workflows/deploy-prod.yml](/E:/代码/ai项目/chat/.github/workflows/deploy-prod.yml)：推送到 `master` 后自动通过 SSH 执行部署

### 服务器准备

先在服务器上确保脚本可执行：

```bash
cd /srv/aichat
chmod +x deploy/deploy-prod.sh
```

### GitHub Secrets

在仓库的 `Settings -> Secrets and variables -> Actions` 中添加：

- `SSH_HOST`：服务器 IP，例如 `114.132.124.103`
- `SSH_PORT`：可选，默认 `22`
- `SSH_USER`：服务器登录用户，例如 `ubuntu`
- `SSH_PRIVATE_KEY`：用于登录服务器的私钥内容
- `DEPLOY_PATH`：可选，默认 `/srv/aichat`
- `DEPLOY_BRANCH`：可选，默认 `master`

### 工作流行为

每次推送到 `master` 后，工作流会在服务器执行：

1. `git fetch`
2. `git pull --ff-only`
3. 载入 `.env.production`
4. `docker-compose -f docker-compose.prod.yml run --rm migrate`
5. `docker-compose -f docker-compose.prod.yml up -d --build`

如果服务器工作区有未提交改动，脚本会直接失败，避免自动部署覆盖临时文件。

### 查看自动部署结果

- GitHub Actions 页面查看工作流日志
- 服务器上查看：

```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs --tail=200 app
docker-compose -f docker-compose.prod.yml logs --tail=200 proxy
curl http://127.0.0.1/api/health
```

## HTTPS 验证

当 `chat.crushzone.icu` 与 `www.chat.crushzone.icu` 的 DNS 已经生效，且腾讯云安全组放行 `80/443` 后，可以这样验证：

1. 本地检查解析：

```bash
nslookup chat.crushzone.icu
nslookup www.chat.crushzone.icu
```

2. 服务器查看 Caddy 日志：

```bash
docker-compose -f docker-compose.prod.yml logs --tail=200 proxy
```

3. 本地检查 HTTPS：

```bash
curl -I http://chat.crushzone.icu
curl -I https://chat.crushzone.icu
curl -I https://www.chat.crushzone.icu
```

理想结果：

- `http://chat.crushzone.icu` 返回 `301/308` 并跳到 `https://chat.crushzone.icu`
- `https://chat.crushzone.icu` 返回 `200`
- `https://www.chat.crushzone.icu` 重定向到 `https://chat.crushzone.icu`
