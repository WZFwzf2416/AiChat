# AI Chat to Agent Studio

一个面向前端开发者的学习型 AI Chat 项目。它从真实可用的聊天产品骨架开始，包含会话持久化、模型预设、SSE 流式体验和工具调用，再逐步往 Agent 系统演进。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Prisma
- PostgreSQL
- OpenAI Compatible Provider 抽象，支持 OpenAI 和通义千问

## 当前实现

- 聊天会话与持久化友好的仓储层设计
- `ChatSession`、`Message`、`ModelConfig`、`AgentStep`、`KnowledgeEntry` 的 Prisma Schema
- 缺失 `DATABASE_URL` 时自动回退到内存模式，避免数据库阻塞学习流程
- OpenAI Compatible 模型层，支持：
  - OpenAI 官方接口
  - 通义千问 DashScope Compatible 接口
  - Demo 模式兜底
- 工具调用链路和 Agent 轨迹：
  - `get_current_time`
  - `get_weather_snapshot`
  - `search_knowledge_base`
- 服务端到前端的 SSE 结构化事件流
- 会话级模型预设、温度、最大输出长度、系统提示词设置
- Markdown 标准渲染：`react-markdown + remark-gfm`
- 上下文裁剪观测与本轮 metadata 面板

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

```bash
cp .env.example .env.local
```

3. 如果要启用真实持久化，先启动 PostgreSQL

```bash
docker compose up -d
```

4. 生成 Prisma Client

```bash
npm run prisma:generate
```

5. 推送 schema 到数据库

```bash
npm run prisma:push
```

6. 启动开发环境

```bash
npm run dev
```

## 通义千问接入

本项目支持通过 DashScope 的 OpenAI Compatible 接口接入千问，默认优先模型是 `qwen-plus`。

在 [\.env.local](E:\代码\ai项目\chat\.env.local) 里填写：

```env
QWEN_API_KEY="你的 DashScope API Key"
QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_QWEN_MODEL="qwen-plus"
```

如果你只想先用千问做真实联调，可以把 `OPENAI_API_KEY` 留空。

## 运行模式边界

- 配置了真实模型 key 时：默认进入 `real` 模式
- 没有真实模型 key 时：进入 `demo` 模式
- `demo` 模式下仍保留聊天链路、工具执行和持久化，但最终文本不来自真实大模型
- 如果已经配置真实 key，又想保留 demo provider，可在环境变量中显式设置：

```env
ALLOW_DEMO_PROVIDER="true"
```

## 环境说明

- 没有 `DATABASE_URL` 时，应用会使用内存模式
- 配置 `QWEN_API_KEY` 后，千问模型会通过 Compatible 接口走真实调用
- 配置 `OPENAI_API_KEY` 后，也可以切回 OpenAI 模型做对比
- 当前工具中：
  - 时间：真实时间
  - 天气：Open-Meteo 实时接口
  - 知识库：项目内真实知识库表 / 内存表

## 编码约定

- 项目源码统一使用 `UTF-8`
- 行尾统一使用 `LF`
- 不要保存成 `ANSI`、`GBK` 或 `UTF-8 with BOM`
- 如果你使用 VS Code，工作区设置已经固定为 `utf8`

## Windows 处理

如果 Windows 终端里仍然显示乱码，先把终端切到 UTF-8，再进行命令行编辑：

```powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
```

建议：
- 优先用 Windows Terminal 或 VS Code 集成终端
- 如果有条件，优先用 PowerShell 7
- 终端一旦显示乱码，不要把那段乱码输出直接复制回源码
- 以编辑器里打开的文件内容作为最终真值，不以终端回显为准

## 当前重点

- 继续清理历史乱码和演示残留
- 保持 real / demo 边界清晰
- 持续把现有能力打磨成更像产品的体验
- 不再继续堆新功能，优先标准化现有能力
