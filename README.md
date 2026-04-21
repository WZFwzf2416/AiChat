# AI Chat to Agent Studio

一个面向前端开发者的学习型 AI Chat 项目。它从真实可用的聊天工作台出发，逐步演进为带工具调用、可观测性和运行策略的单 Agent Runtime。

## 当前状态

- 已具备真实聊天工作流：会话、消息、模型配置、知识库、工具调用、SSE 流式输出。
- 已具备单 Agent 循环基础：`planning -> tooling -> planning -> finalizing`。
- 已具备企业级底座元素：`turnId`、`traceId`、runtime policy、结构化工具结果、Inspector 调试面板。
- 当前阶段优先做清理、稳定性和治理能力，不再盲目堆新功能。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Prisma
- PostgreSQL
- OpenAI Compatible Provider（支持 OpenAI 与通义千问）

## 目录速览

- `src/app`：页面与 API Route
- `src/components/chat`：聊天工作台 UI
- `src/lib/chat-service.ts`：聊天编排入口
- `src/lib/ai/runtime`：Agent runtime
- `src/lib/ai/tools.ts`：工具注册与执行
- `src/lib/repositories`：存储抽象、Prisma、内存兜底
- `docs`：路线图、流程图、工作日志

## 核心能力

- 聊天会话与消息持久化
- 模型配置与会话级运行参数
- Markdown 渲染与长内容局部滚动
- 结构化 SSE 事件流
- 工具调用闭环：
  - `get_current_time`
  - `get_weather_snapshot`
  - `search_knowledge_base`
- Agent 执行轨迹与 Inspector 调试面板
- 结构化工具结果：
  - `summary`
  - `raw`
  - `display`
  - `sources`

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

```bash
cp .env.example .env.local
```

3. 如需本地数据库，启动 PostgreSQL

```bash
docker compose up -d
```

4. 生成 Prisma Client

```bash
npm run prisma:generate
```

5. 同步 schema

```bash
npm run prisma:push
```

6. 启动开发环境

```bash
npm run dev
```

## 环境说明

- 配置了真实模型 key 时，默认进入 `real` 模式。
- 没有真实模型 key 时，会进入 `demo` 模式兜底。
- 没有 `DATABASE_URL` 时，会回退到内存模式，但仅推荐用于开发环境。
- 通义千问通过 DashScope 的 OpenAI Compatible 接口接入。

## 工程规则

- 源码统一使用 `UTF-8`
- 行尾统一使用 `LF`
- 默认中文文案
- 页面组件负责 UI，编排逻辑放 service 层，模型适配放 provider/runtime 层，存储访问放 repository 层
- 长内容必须待在局部滚动容器内

## 验证与记录要求

从现在开始，所有涉及代码的改动都必须同时满足两件事：

1. 自我验证通过
   - 至少执行 `npm run lint`
   - 涉及构建链路时执行 `npm run build`
2. 将操作、结果、风险和下一步记录到工作日志
   - 统一记录在 [docs/worklog.md](/E:/代码/ai项目/chat/docs/worklog.md)

## 相关文档

- [项目协作说明](/E:/代码/ai项目/chat/AGENTS.md)
- [项目备注](/E:/代码/ai项目/chat/PROJECT_NOTES.md)
- [待办列表](/E:/代码/ai项目/chat/TODO.md)
- [Agent 演进路线图](/E:/代码/ai项目/chat/docs/agent-evolution-roadmap.md)
- [企业级流程图](/E:/代码/ai项目/chat/docs/enterprise-agent-flow.md)
- [工作日志](/E:/代码/ai项目/chat/docs/worklog.md)
