export const CHAT_COPY = {
  bootingEyebrow: "正在启动",
  bootingTitle: "正在准备 AI Chat 工作台",
  bootingDescription:
    "正在同步会话、模型配置和运行状态，请稍等片刻。",
  createSessionError: "创建新会话失败，请稍后重试。",
  syncBootstrapError: "同步工作台数据失败，请稍后重试。",
  syncSessionError: "同步当前会话失败，请稍后重试。",
  initError: "初始化聊天工作台失败，请刷新后重试。",
  saveSessionError: "保存会话设置失败，请稍后重试。",
  saveModelConfigError: "保存模型预设失败，请稍后重试。",
  saveTemperatureError: "保存温度设置失败，请稍后重试。",
  saveMaxTokensError: "保存输出长度失败，请稍后重试。",
  saveSystemPromptError: "保存系统提示词失败，请稍后重试。",
  sendMessageError: "发送消息失败，请稍后重试。",
  sessionRecoveryError:
    "当前会话已失效，系统已尝试重新同步，请刷新页面后再发送一次。",
  appEyebrow: "AI 实战工作台DEMO",
  appTitle: "从 Chat 到 Agent 的练习场",
  newSession: "新建",
  runtimeTitle: "运行状态",
  runtimePrisma:
    "当前使用 Postgres + Prisma 持久化，会话、工具结果和轨迹都会保存。",
  runtimeMemory:
    "当前运行在内存模式，刷新页面或重启开发服务后，会话可能丢失。",
  runtimeMock: "当前未配置真实模型 API Key，应用会进入演示模式。",
  searchPlaceholder: "搜索会话、模型或 provider",
  noSessionMatch: "没有找到符合条件的会话，请试试调整搜索关键词。",
  currentSession: "当前会话",
  noActiveSession: "请选择一个会话",
  workspaceDescription:
    "这里是聊天主工作区。你可以直接提问、测试工具调用，并观察右侧的运行数据和 Agent 轨迹。",
  modelPreset: "模型预设",
  temperature: "温度",
  maxTokens: "最大输出长度",
  messagesTitle: "对话消息",
  hiddenMessagesPrefix: "已折叠较早的",
  hiddenMessagesSuffix: "条消息",
  showEarlierMessages: "显示更早消息",
  emptyMessagesTitle: "从这里开始第一轮对话",
  emptyMessagesDescription:
    "先提一个具体问题，或者直接试试天气、时间、知识库这类工具型请求。",
  toolResultDescription: "这是本轮工具执行结果，已进入后续回答上下文。",
  toolErrorDescription:
    "这一轮工具执行失败，助手会基于错误信息继续组织回答。",
  viewToolRawResult: "查看原始结果",
  backToBottom: "回到底部",
  systemPrompt: "系统提示词",
  diagnosticsTitle: "本轮观测",
  diagnosticsProvider: "模型通道",
  diagnosticsModel: "模型",
  diagnosticsDuration: "耗时",
  diagnosticsFinishReason: "结束原因",
  diagnosticsTotalTokens: "总 Token 数",
  diagnosticsPromptTokens: "输入 Token",
  diagnosticsCompletionTokens: "输出 Token",
  diagnosticsContext: "上下文窗口",
  diagnosticsTraceId: "Trace ID",
  diagnosticsToolAttempts: "工具尝试次数",
  diagnosticsToolLatency: "工具最长耗时",
  diagnosticsPolicy: "运行策略",
  diagnosticsUnavailable: "暂无",
  diagnosticsEmpty:
    "当前还没有完整的一轮模型回复。等助手返回后，这里会显示模型、耗时、Token 和上下文信息。",
  diagnosticsCitations: "答案引用",
  inspectorKnowledgeTitle: "真实知识库",
  inspectorKnowledgeDescription:
    "这里录入的内容会进入当前应用的知识库，并被知识库工具实时检索。",
  knowledgeTitlePlaceholder: "条目标题",
  knowledgeContentPlaceholder: "条目内容",
  knowledgeTagsPlaceholder: "标签，使用逗号分隔",
  knowledgeValidationError: "请至少填写 2 个字的标题和 10 个字的内容。",
  knowledgeCreateError: "新增知识条目失败。",
  knowledgeEmpty: "还没有录入知识条目。你可以先新增一条，再让助手搜索知识库。",
  knowledgeCreate: "新增知识条目",
  knowledgeSaving: "正在保存...",
  tagsLabel: "标签",
  agentTrail: "Agent 轨迹",
  agentTrailEmpty:
    "当前会话还没有工具轨迹。触发时间、天气或知识库工具后，这里会显示执行步骤。",
  agentPlanning: "规划",
  agentTool: "工具",
  agentFinalize: "收口",
  turnTimeline: "最近轮次",
  turnTimelineEmpty:
    "发送一条消息后，这里会展示每一轮的可见消息、调试消息和工具步骤。",
  turnVisibleCount: "可见消息",
  turnDebugCount: "调试消息",
  turnToolCount: "工具次数",
  turnStepCount: "步骤数",
  turnStatusStreaming: "进行中",
  turnStatusCompleted: "已完成",
  turnStatusFailed: "失败",
  debugMessagesTitle: "内部调试消息",
  debugMessagesEmpty: "这一轮没有隐藏的中间消息。",
  latestTurnLabel: "最近一轮",
  runtimePolicyTitle: "运行策略",
  runtimePolicySteps: "最大规划轮数",
  runtimePolicyFallback: "启发式兜底",
  runtimePolicyFallbackOn: "开启",
  runtimePolicyFallbackOff: "关闭",
  runtimePolicyToolLimit: "每轮工具上限",
  runtimePolicyTimeout: "工具超时",
  runtimePolicyRetry: "工具重试",
  composerPlaceholder:
    "输入你的需求、架构问题，或者直接试试：帮我查一下现在上海天气",
  composerHint:
    "按 Enter 发送，Shift+Enter 换行。支持普通问答、工具调用和长对话阅读。",
  sendMessage: "发送消息",
  stageThinking: "正在思考中...",
  stageTooling: "正在调用工具...",
  stageFinalizing: "正在整理答案...",
  stepSeparator: "·",
  sessionMetaSeparator: "·",
  sessionProviderLabelOpenAI: "OpenAI",
  sessionProviderLabelQwen: "通义千问",
  sessionProviderLabelMock: "演示模式",
  experienceModeReal: "当前处于真实联调模式。",
  experienceModeDemo: "当前处于演示模式。",
  traceUnavailable: "未记录",
  toolStructuredSummary: "结构化结果",
  toolSourcesTitle: "来源",
  toolRawTitle: "原始载荷",
  toolNoSources: "暂无来源信息",
  toolResultMetrics: "关键指标",
  toolResultItems: "结果列表",
  toolDisplayFallback: "该工具没有提供结构化展示。",
  citedSourcesTitle: "答案引用来源",
  citedSourcesEmpty: "这一轮最终答案还没有引用来源。",
  citationLabelPrefix: "引用",
  debugVisibilityVisible: "可见",
  debugVisibilityDebug: "调试",
  debugVisibilityInternal: "内部",
  copyCode: "复制代码",
  copiedCode: "已复制",
  expandContent: "展开全文",
  collapseContent: "收起内容",
} as const;

export function getRuntimeBackendLabel(
  preferredBackend: "openai" | "qwen" | null | undefined,
) {
  if (preferredBackend === "qwen") {
    return "通义千问";
  }

  if (preferredBackend === "openai") {
    return "OpenAI";
  }

  return "兼容模型接口";
}

export function getProviderDisplayLabel(
  provider: string | null | undefined,
  modelId?: string | null,
) {
  if (provider === "MOCK") {
    return CHAT_COPY.sessionProviderLabelMock;
  }

  if (modelId?.toLowerCase().startsWith("qwen")) {
    return CHAT_COPY.sessionProviderLabelQwen;
  }

  return CHAT_COPY.sessionProviderLabelOpenAI;
}
