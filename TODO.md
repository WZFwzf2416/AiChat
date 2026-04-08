# TODO

## 进行中
- 收紧 real / demo 边界，避免 demo 逻辑混入真实主流程
- 清理 provider、tools、repository、UI 中残留的乱码和历史演示文案
- 保持 Markdown 与工具流转使用标准实现，不继续堆新功能

## 下一步
- 清理 UI 里剩余的内部术语和英文技术暴露
- 整理运行时错误提示和 demo 模式提示
- 优化工具消息与最终回答的重复展示

## 后续计划
- 继续去掉历史“伪真实”路径
- 为现有能力补更严格的验证
- 提升长对话场景下的稳定性和可读性

## 已完成
- Qwen 真实联调
- Prisma + Postgres 持久化
- SSE 结构化流式输出
- 工具调用闭环
- 聊天区内部滚动
- 会话模型预设自动同步
- 主界面中文化
- `chat-shell.tsx` 组件化拆分
- Markdown 切换到 `react-markdown + remark-gfm`
