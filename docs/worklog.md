# 工作日志

## 记录规则

- 所有涉及代码或部署骨架的改动，都要追加一条记录
- 每条记录至少包含：
  - 时间
  - 修改范围
  - 执行过的验证
  - 当前结果
  - 下一步或风险
- 如果改动涉及组件拆分、模块边界或扩展性设计，也要记录结构性决策

---

## 2026-04-21

### 本次操作

- 修复 `@/components/chat/chat-inspector-panel` 模块缺失导致的构建报错
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
- 建立持续记录使用的工作日志文件

### 验证

- `npm run lint`
- `npm run build`
- `docker compose -f docker-compose.prod.yml config`
- `docker build --target runner -t chat-app:test .` 未执行完成：本机 Docker daemon 未启动
- `.gitignore` 修正后，`git status --short` 已确认 `.env.example` 与 `.env.production.example` 可被跟踪
- 再次执行：`npm run lint`
- 文档更新后再次执行：
  - `npm run lint`
  - `npm run build`

### 当前结果

- 模块解析错误已修复
- 构建与 lint 均已通过
- 文档已切换为干净、可维护的中文版本
- 仓库内已建立“改动后自验 + 落工作日志”的协作约定

### 下一步或风险

- 继续清理剩余零散代码与历史痕迹
- 补 runtime / repository 自动化测试
- 持续把每次验证结果写入本文档

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
- 新增 `src/app/api/health/route.ts` 作为容器健康检查入口
- 修正 `.gitignore`，允许提交 `.env.example` 与 `.env.production.example` 这类示例环境文件

### 验证

- `npm run lint`
- `npm run build`

### 当前结果

- 仓库已具备方案 C 所需的最小生产容器化骨架
- 已支持外部 PostgreSQL + Docker Compose + Nginx 反向代理
- 已补齐首次上线和后续更新文档
- `lint` 与 `build` 已通过，`/api/health` 已进入构建产物
- `docker compose` 生产编排已完成结构解析校验
- 本地未能完成真实镜像构建校验，原因是当前环境没有可用的 Docker daemon
- 示例环境文件已可正常进入 Git 跟踪

### 下一步或风险

- 仍需根据真实服务器信息填写 `.env.production`
- 当前 Nginx 配置默认监听 `80`，HTTPS 需要结合证书或云端负载均衡继续补
- 如果后续接入镜像仓库，建议把更新流程切换为 `pull + up -d`

## 2026-04-22（规则补充）

### 本次操作

- 将“改代码时必须考虑组件拆分、可扩展性和避免单文件膨胀”的规则写入项目文档
- 更新了：
  - `AGENTS.md`
  - `README.md`
  - `PROJECT_NOTES.md`
  - `docs/worklog.md`

### 结构性决策

- 后续改动默认按“小组件、小模块、清晰职责边界”的方向执行
- 结构性拆分不再作为可选优化，而是作为默认实现规则
- 如果一个文件在当前修改里开始承担多种职责，应直接拆分，不再把重构债留到以后

### 验证

- `npm run lint`
- `npm run build`

### 当前结果

- 仓库级规则已明确要求在实现时同步考虑拆分与扩展性
- 后续改动会把结构设计和验证结果一起记录在本文件

### 下一步或风险

- 后续每次代码改动都要检查是否需要顺手做模块拆分
- 当时间紧时，也不能跳过结构性判断，只能在日志里明确说明取舍原因
