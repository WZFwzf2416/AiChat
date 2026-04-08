# 项目协作记忆

## 项目目标
- 先完成一个真实可用的 AI Chat 项目。
- 在现有架构上逐步演进成可扩展的 Agent 系统。
- 保持前端友好、易学、可持续迭代。

## 当前技术栈
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma + Postgres
- Qwen / OpenAI Compatible API

## 已完成
- 聊天工作台主界面搭建完成
- 会话、消息、模型配置已接入持久化
- 支持 Qwen 真实联调
- 支持 SSE 结构化流式返回
- 支持工具调用：时间、天气、知识库检索
- 支持 Agent 轨迹展示
- 页面主要文案已中文化
- 聊天区改为内部滚动
- `chat-shell.tsx` 已拆为 sidebar / header / message-thread / inspector / composer
- Markdown 已切换到 `react-markdown + remark-gfm`

## 当前重点
- 明确 real 和 demo 的运行边界
- 持续清理主链路里的 demo / mock 痕迹
- 把 Markdown 渲染、工具流转和运行提示做得更标准
- 不再新增功能，优先把现有能力做成真实、稳定、可维护的产品

## 关键设计约定
- 前端不直接调用模型 SDK，统一走应用内 API
- 业务流程放在 service 层，模型适配放在 provider 层
- 数据读写统一走 repository 层
- 页面默认中文文案
- 优先真实能力，demo 仅作兜底

## 关键环境说明
- 默认优先使用 Qwen 作为真实模型后端
- 没有真实模型 key 时允许回退到 demo provider
- 已配置真实模型 key 时，默认不再暴露 mock provider
- Docker + Postgres 用于本地持久化开发

## 最近已收口
- provider、tools、service 改为更干净的标准实现
- SSE 事件流支持结构化 `tool` 事件
- 运行状态明确区分 `real` / `demo`
- 文案常量、侧栏、消息线程、观测面板正在持续去乱码和去内部术语

## 下一步建议
- 继续清理现有 UI 中残留的内部实现词
- 继续收敛 demo 模式提示与错误提示
- 继续优化现有长消息和工具消息的可读性，但不新增功能
