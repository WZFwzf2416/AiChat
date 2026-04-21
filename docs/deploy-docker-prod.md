# Docker 生产部署方案

这套方案对应当前项目的首选部署方式：

- 应用使用 Docker 容器运行
- 反向代理使用 Nginx 容器
- 数据库使用外部托管 PostgreSQL
- 首次上线和后续更新都走 `docker compose`

## 目录说明

- [Dockerfile](/E:/代码/ai项目/chat/Dockerfile)：多阶段构建，生产环境使用 Next.js `standalone` 输出
- [docker-compose.prod.yml](/E:/代码/ai项目/chat/docker-compose.prod.yml)：生产编排
- [deploy/nginx/nginx.conf](/E:/代码/ai项目/chat/deploy/nginx/nginx.conf)：Nginx 反向代理配置
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
docker compose -f docker-compose.prod.yml up -d --build
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
docker compose -f docker-compose.prod.yml up -d --build
```

4. 验证健康检查

```bash
curl http://127.0.0.1/api/health
```

如果后续接入镜像仓库，可以把 `chat-app:latest` 和 `chat-tools:latest` 改成你的仓库地址，再把上线流程切成：

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

这样更新会更快。

## 反向代理说明

当前 Nginx 配置已经做了这些处理：

- 反向代理到应用容器 `app:3000`
- 关闭代理缓冲，兼容流式响应
- 透传 `Host` 和转发 IP 头
- 预留 WebSocket/升级连接支持

如果你要直接在服务器上终止 HTTPS，可以继续扩展这份 Nginx 配置并挂载证书。

## 健康检查

项目新增了 [src/app/api/health/route.ts](/E:/代码/ai项目/chat/src/app/api/health/route.ts)：

- 应用进程正常时返回 `app: ok`
- 数据库可连通时返回 `database: ok`
- 如果缺少 `DATABASE_URL` 或数据库不可达，会返回 `503`

这既方便 Docker 健康检查，也方便上线后的人工排查。

## 建议的下一步

- 给服务器接上 HTTPS
- 接入镜像仓库和 CI/CD
- 把 `docker compose up -d --build` 升级成 `pull + up -d`
- 后续如需多实例，再补共享缓存和部署版本管理
