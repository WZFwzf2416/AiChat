# 项目备注

## 产品定位

- 从真实 AI Chat 项目起步
- 逐步演进为可观测、可调试、可扩展的 Agent Runtime
- 保持对前端开发者友好，方便学习链路、状态机和工程分层

## 当前阶段重点

- 不再盲目加功能，优先清理历史乱码、重复逻辑和不稳定实现
- 把现有能力做成稳定、真实、可维护的产品底座
- 继续强化企业级方向所需的可观测性、治理能力和验证流程

## 当前架构分层

- 页面与交互：`src/components/chat`
- 服务编排：`src/lib/chat-service.ts`
- Agent runtime：`src/lib/ai/runtime`
- 工具注册与执行：`src/lib/ai/tools.ts`
- 存储访问：`src/lib/repositories`

## 当前已稳定的能力

- 聊天工作台主界面
- 会话、消息、模型配置持久化
- 通义千问 / OpenAI Compatible 模型接入
- SSE 结构化流式事件
- 工具调用与 Agent 轨迹
- Inspector 运行态面板
- 结构化工具结果与答案引用来源

## 工程纪律

- 所有源码按 `UTF-8 + LF` 维护
- Windows 终端乱码不能直接拿来回填源码
- JSX 或文案块损坏时，优先整块重写
- 改代码后必须自验证并写入工作日志

## 自验证标准

- 默认执行：`npm run lint`
- 涉及构建、模块解析、路由、类型变更时执行：`npm run build`
- 如果某项验证没跑，需要在工作日志里明确说明

## 工作日志约定

- 统一记录到 [docs/worklog.md](/E:/代码/ai项目/chat/docs/worklog.md)
- 每次代码改动至少记录：
  - 时间
  - 修改范围
  - 已执行验证
  - 当前结果
  - 已知风险或下一步

## 最近一次状态

- 已修复 `@/components/chat/chat-inspector-panel` 模块缺失导致的构建报错
- 已重建并清理 Inspector、工具结果卡片、消息正文、共享文案等核心文件
- 已重新跑通 `npm run lint` 与 `npm run build`
