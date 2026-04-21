# Agent 演进路线图

## 目标

把当前 AI Chat 项目逐步演进为一个可观察、可调试、可扩展的 Agent Runtime，并保持对前端开发者友好。

## 阶段一：打稳单轮 Agent 基础

- 清理乱码与不稳定文案，统一为 `UTF-8` 中文文本
- 建立 `turnId` 与消息可见性语义
- 让工具失败进入标准消息链路与 Agent 轨迹
- 在 Inspector 中展示最近轮次、步骤和隐藏调试消息

## 阶段二：升级为单 Agent 循环

- 从单次 `plan -> tool -> answer` 升级到有限步循环
- 拆出 `runtime / planner / executor / streaming`
- 增加最大规划轮数、停止条件和恢复策略
- 让 planning / tooling / finalizing 都形成结构化 step

## 阶段三：工具系统平台化

- 为工具增加分类、来源、风险级别、可重试性和超时策略
- 统一工具输出协议：
  - `summary`
  - `raw`
  - `display`
  - `sources`
- 支持卡片化展示与审计视图

## 阶段四：知识库升级为长期记忆

- 区分会话记忆与长期知识
- 为知识条目增加来源会话、来源消息、确认状态、命中次数
- 支持从对话中提炼知识条目
- 为未来的向量检索或混合检索做好建模准备

## 阶段五：前端升级为 Agent 工作台

- 增强阶段反馈和执行轨迹展示
- 让 Inspector 成为真正的运维 / 调试面板
- 推进工具结果卡片化、引用可视化、上下文裁剪可视化
- 保持学习友好，不把内部实现塞满用户主视图

## 阶段六：多 Agent 协作

- 在单 Agent 稳定后再引入多 Agent
- 可以按职责拆分：
  - Research
  - Writer
  - Memory
- 也可以按流程拆分：
  - Planner
  - Executor
  - Reviewer
  - Finalizer

## 近期执行顺序

1. 继续做代码与文档清理
2. 补 runtime / repository 自动化测试
3. 增加工具治理策略
4. 推进 `turn/run` 模型
5. 再考虑知识库长期记忆化与多 Agent
