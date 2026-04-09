import OpenAI from "openai";

import { getOpenAITools, runToolByName } from "@/lib/ai/tools";
import {
  allowDemoProvider,
  appEnv,
  hasCompatibleApiKey,
  hasOpenAIKey,
  hasQwenKey,
  isDevelopment,
} from "@/lib/env";
import { chunkText, createId, safeJsonParse } from "@/lib/utils";
import type {
  AgentStep,
  AppModelProvider,
  ChatMessage,
  ToolCallRecord,
} from "@/types/chat";

type GenerateTurnInput = {
  modelProvider: AppModelProvider;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  messages: ChatMessage[];
  context: {
    totalMessages: number;
    includedMessages: number;
    trimmedCount: number;
    toolMessages: number;
  };
};

type PersistedTurnMessage = {
  role: "assistant" | "tool";
  content: string;
  toolCallId?: string | null;
  toolName?: string | null;
  toolCalls?: ToolCallRecord[] | null;
  toolResults?: Array<{
    toolCallId: string;
    toolName: string;
    result: string;
  }> | null;
  metadata?: Record<string, unknown> | null;
};

type CompletedTurn = {
  assistantText: string;
  persistedMessages: PersistedTurnMessage[];
  agentSteps: AgentStep[];
  metadata: Record<string, unknown>;
};

export type ProviderStreamEvent =
  | { type: "stage"; stage: "thinking" | "tooling" | "finalizing" }
  | {
      type: "tool";
      phase: "start" | "result";
      toolName: string;
      label: string;
      summary?: string;
    };

type StreamedTurnResult = {
  stream: ReadableStream<Uint8Array>;
  completion: Promise<CompletedTurn>;
  initialStage: "thinking" | "tooling";
  preludeEvents?: ProviderStreamEvent[];
};

type DirectToolIntent = {
  toolName:
    | "search_knowledge_base"
    | "get_current_time"
    | "get_weather_snapshot";
  args: Record<string, unknown>;
  preamble: string;
  label: string;
};

type CompatibleTarget =
  | {
      label: "QWEN" | "OPENAI";
      apiKey: string;
      baseURL?: string;
    }
  | { error: string };

type PreparedToolContext = {
  initialStage: "thinking" | "tooling";
  messages: Array<Record<string, unknown>>;
  persistedMessages: PersistedTurnMessage[];
  agentSteps: AgentStep[];
  preludeEvents: ProviderStreamEvent[];
};

function buildOpenAIMessages(systemPrompt: string, messages: ChatMessage[]) {
  const baseMessages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: [
        systemPrompt,
        "",
        "上下文组织规则：",
        "1. 优先回答用户最新问题。",
        "2. 如果使用过工具，请明确哪些结论来自工具，哪些来自模型整理。",
        "3. 如果上下文被裁剪，请基于当前上下文继续，不要虚构更早的对话。",
      ].join("\n"),
    },
  ];

  for (const message of messages) {
    if (message.role === "tool") {
      baseMessages.push({
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
      });
      continue;
    }

    baseMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  return baseMessages;
}

function extractAssistantText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function buildBaseMetadata(input: GenerateTurnInput, durationMs: number) {
  return {
    model: input.modelId,
    provider: input.modelProvider,
    durationMs,
    context: input.context,
  };
}

function isQwenModel(modelId: string) {
  return modelId.toLowerCase().startsWith("qwen");
}

function resolveCompatibleClient(modelId: string): CompatibleTarget {
  if (isQwenModel(modelId)) {
    if (!hasQwenKey) {
      return {
        error: "当前会话选择的是通义千问模型，但没有配置 `QWEN_API_KEY`。",
      };
    }

    return {
      label: "QWEN",
      apiKey: appEnv.QWEN_API_KEY!,
      baseURL: appEnv.QWEN_BASE_URL,
    };
  }

  if (!hasOpenAIKey) {
    return {
      error: "当前会话选择的是 OpenAI 模型，但没有配置 `OPENAI_API_KEY`。",
    };
  }

  return {
    label: "OPENAI",
    apiKey: appEnv.OPENAI_API_KEY!,
    baseURL: appEnv.OPENAI_BASE_URL || undefined,
  };
}

function normalizeIntentText(value: string) {
  return value
    .replace(/[，。！？；：、“”‘’'（）()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeToolRequest(content: string) {
  const normalized = normalizeIntentText(content);
  const lower = content.toLowerCase();

  return (
    normalized.includes("知识库") ||
    normalized.includes("文档") ||
    normalized.includes("资料") ||
    normalized.includes("时间") ||
    normalized.includes("几点") ||
    normalized.includes("天气") ||
    normalized.includes("气温") ||
    normalized.includes("下雨") ||
    lower.includes("knowledge") ||
    lower.includes("time") ||
    lower.includes("weather")
  );
}

function extractWeatherCity(content: string) {
  const directMatches = [
    "北京",
    "上海",
    "深圳",
    "广州",
    "杭州",
    "成都",
    "武汉",
    "南京",
    "苏州",
  ];
  const directCity = directMatches.find((city) => content.includes(city));
  if (directCity) {
    return directCity;
  }

  const suffixMatch = content.match(/([\u4e00-\u9fa5]{2,6})(?:市|的天气|天气)/);
  return suffixMatch?.[1] ?? "上海";
}

function extractTimezone(content: string) {
  const normalized = content.toLowerCase();

  if (content.includes("北京") || content.includes("上海") || content.includes("中国")) {
    return "Asia/Shanghai";
  }

  if (content.includes("东京") || content.includes("日本")) {
    return "Asia/Tokyo";
  }

  if (content.includes("纽约") || normalized.includes("new york")) {
    return "America/New_York";
  }

  if (content.includes("伦敦") || normalized.includes("london")) {
    return "Europe/London";
  }

  return "Asia/Shanghai";
}

function extractKnowledgeQuery(content: string, fallback: string) {
  const normalized = normalizeIntentText(content);
  const match = normalized.match(
    /(?:查一下|搜索|检索|看看|查找|搜索知识库|查知识库)\s*(.+?)(?:的内容|内容|资料|文档|信息|建议)?$/,
  );
  const candidate = match?.[1]?.trim();

  if (candidate && candidate.length >= 2) {
    return candidate;
  }

  if (normalized.toLowerCase().includes("ai chat")) {
    return "AI Chat 架构清单";
  }

  return fallback;
}

function inferDirectToolIntent(messages: ChatMessage[]): DirectToolIntent | null {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const originalContent = latestUserMessage?.content ?? "";
  const normalized = normalizeIntentText(originalContent);
  const lower = originalContent.toLowerCase();

  if (
    normalized.includes("知识库") ||
    normalized.includes("文档") ||
    normalized.includes("资料") ||
    lower.includes("knowledge")
  ) {
    const query = extractKnowledgeQuery(
      originalContent,
      latestUserMessage?.content ?? "AI Chat",
    );

    return {
      toolName: "search_knowledge_base",
      args: { query },
      preamble: "正在检索知识库内容...",
      label: `搜索知识库：${query}`,
    };
  }

  if (
    normalized.includes("时间") ||
    normalized.includes("几点") ||
    lower.includes("time")
  ) {
    const timezone = extractTimezone(originalContent);
    return {
      toolName: "get_current_time",
      args: { timezone },
      preamble: "正在查询当前时间...",
      label: `查询时间：${timezone}`,
    };
  }

  if (
    normalized.includes("天气") ||
    normalized.includes("气温") ||
    normalized.includes("下雨") ||
    lower.includes("weather")
  ) {
    const city = extractWeatherCity(originalContent);
    return {
      toolName: "get_weather_snapshot",
      args: { city, unit: "celsius" },
      preamble: "正在获取实时天气...",
      label: `查询天气：${city}`,
    };
  }

  return null;
}

function createBufferedTextStream(text: string) {
  const encoder = new TextEncoder();
  const chunks = chunkText(text, 8);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [index, chunk] of chunks.entries()) {
        controller.enqueue(encoder.encode(chunk));
        if (index < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      controller.close();
    },
  });
}

async function executeToolIntent(params: {
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
  persistedMessages?: PersistedTurnMessage[];
  agentSteps?: AgentStep[];
  preludeEvents?: ProviderStreamEvent[];
  intent: DirectToolIntent;
  metadataExtras?: Record<string, unknown>;
}) {
  const {
    input,
    startedAt,
    messages,
    intent,
    persistedMessages = [],
    agentSteps = [],
    preludeEvents = [],
    metadataExtras,
  } = params;
  const toolCallId = createId("tool");
  const execution = await runToolByName(intent.toolName, intent.args, toolCallId);

  persistedMessages.push({
    role: "assistant",
    content: intent.preamble,
    toolCalls: [
      {
        id: toolCallId,
        name: intent.toolName,
        arguments: intent.args,
      },
    ],
    metadata: {
      hidden: true,
      ...metadataExtras,
      ...buildBaseMetadata(input, Date.now() - startedAt),
    },
  });
  persistedMessages.push(execution.toolMessage);
  agentSteps.push(execution.agentStep);

  preludeEvents.push({
    type: "tool",
    phase: "start",
    toolName: intent.toolName,
    label: intent.label,
  });
  preludeEvents.push({
    type: "tool",
    phase: "result",
    toolName: intent.toolName,
    label: execution.agentStep.label,
    summary: execution.toolMessage.content,
  });

  messages.push({
    role: "assistant",
    tool_calls: [
      {
        id: toolCallId,
        type: "function",
        function: {
          name: intent.toolName,
          arguments: JSON.stringify(intent.args),
        },
      },
    ],
  });
  messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: execution.toolMessage.content,
  });

  return { messages, persistedMessages, agentSteps, preludeEvents };
}

function parseToolArguments(raw: string) {
  const parsed = safeJsonParse<Record<string, unknown> | null>(raw, null);
  return parsed ?? {};
}

async function prepareToolContext(params: {
  client: OpenAI;
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
}): Promise<PreparedToolContext> {
  const { client, input, startedAt } = params;
  const messages = [...params.messages];
  const persistedMessages: PersistedTurnMessage[] = [];
  const agentSteps: AgentStep[] = [];
  const preludeEvents: ProviderStreamEvent[] = [];
  const latestUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserContent = latestUserMessage?.content ?? "";
  const shouldFallbackToHeuristic = looksLikeToolRequest(latestUserContent);

  const planning = await client.chat.completions.create({
    model: input.modelId,
    temperature: input.temperature,
    max_completion_tokens: Math.min(600, input.maxOutputTokens),
    messages: messages as never,
    tools: getOpenAITools() as never,
    tool_choice: "auto",
  });

  const assistantMessage = planning.choices[0]?.message;
  const rawToolCalls =
    assistantMessage?.tool_calls?.filter((toolCall) => toolCall.type === "function") ?? [];

  if (rawToolCalls.length > 0) {
    const serializedCalls: ToolCallRecord[] = rawToolCalls.map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: parseToolArguments(toolCall.function.arguments),
    }));

    persistedMessages.push({
      role: "assistant",
      content:
        extractAssistantText(assistantMessage?.content).trim() ||
        "模型决定先调用工具完成这一轮请求。",
      toolCalls: serializedCalls,
      metadata: {
        hidden: true,
        modelToolCall: true,
        planningUsage: planning.usage ?? null,
        ...buildBaseMetadata(input, Date.now() - startedAt),
      },
    });

    messages.push({
      role: "assistant",
      tool_calls: rawToolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      })),
    });

    for (const toolCall of serializedCalls) {
      const execution = await runToolByName(
        toolCall.name,
        toolCall.arguments,
        toolCall.id,
      );
      persistedMessages.push(execution.toolMessage);
      agentSteps.push(execution.agentStep);
      preludeEvents.push({
        type: "tool",
        phase: "start",
        toolName: toolCall.name,
        label: `模型调用工具：${toolCall.name}`,
      });
      preludeEvents.push({
        type: "tool",
        phase: "result",
        toolName: toolCall.name,
        label: execution.agentStep.label,
        summary: execution.toolMessage.content,
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: execution.toolMessage.content,
      });
    }

    return {
      initialStage: "tooling",
      messages,
      persistedMessages,
      agentSteps,
      preludeEvents,
    };
  }

  if (!shouldFallbackToHeuristic) {
    return {
      initialStage: "thinking",
      messages,
      persistedMessages,
      agentSteps,
      preludeEvents,
    };
  }

  const fallbackIntent = inferDirectToolIntent(input.messages);
  if (!fallbackIntent) {
    return {
      initialStage: "thinking",
      messages,
      persistedMessages,
      agentSteps,
      preludeEvents,
    };
  }

  await executeToolIntent({
    input,
    startedAt,
    messages,
    persistedMessages,
    agentSteps,
    preludeEvents,
    intent: fallbackIntent,
    metadataExtras: {
      directToolIntent: true,
      fallbackReason: "model-did-not-emit-tool-call",
      planningUsage: planning.usage ?? null,
    },
  });

  return {
    initialStage: "tooling",
    messages,
    persistedMessages,
    agentSteps,
    preludeEvents,
  };
}

async function streamAssistantCompletion(params: {
  client: OpenAI;
  targetLabel: string;
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
  persistedMessages: PersistedTurnMessage[];
  agentSteps: AgentStep[];
}) {
  const {
    client,
    targetLabel,
    input,
    startedAt,
    messages,
    persistedMessages,
    agentSteps,
  } = params;

  const completionStream = await client.chat.completions.create({
    model: input.modelId,
    temperature: input.temperature,
    max_completion_tokens: input.maxOutputTokens,
    messages: messages as never,
    stream: true,
    stream_options: { include_usage: true },
  });

  const encoder = new TextEncoder();
  let resolveCompletion!: (value: CompletedTurn) => void;
  let rejectCompletion!: (reason?: unknown) => void;

  const completion = new Promise<CompletedTurn>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      let finishReason: string | null = null;
      let usage: Record<string, unknown> | null = null;

      try {
        for await (const chunk of completionStream) {
          const choice = chunk.choices[0];
          const delta = choice?.delta;
          const textDelta = extractAssistantText(delta?.content);

          if (textDelta) {
            assistantText += textDelta;
            controller.enqueue(encoder.encode(textDelta));
          }

          if (choice?.finish_reason) {
            finishReason = choice.finish_reason;
          }

          if (chunk.usage) {
            usage = chunk.usage as unknown as Record<string, unknown>;
          }
        }

        const safeAssistantText =
          assistantText.trim() || "本轮执行完成，但没有可展示的文本结果。";
        const metadata = {
          ...buildBaseMetadata(input, Date.now() - startedAt),
          provider: targetLabel,
          finishReason,
          usage,
        };

        resolveCompletion({
          assistantText: safeAssistantText,
          persistedMessages: [
            ...persistedMessages,
            {
              role: "assistant",
              content: safeAssistantText,
              metadata,
            },
          ],
          agentSteps,
          metadata,
        });
        controller.close();
      } catch (error) {
        rejectCompletion(error);
        controller.error(error);
      }
    },
    cancel(reason) {
      rejectCompletion(reason);
    },
  });

  return { stream, completion };
}

async function generateWithCompatibleProvider(
  input: GenerateTurnInput,
): Promise<StreamedTurnResult> {
  const target = resolveCompatibleClient(input.modelId);

  if ("error" in target) {
    throw new Error(target.error);
  }

  const startedAt = Date.now();
  const client = new OpenAI({
    apiKey: target.apiKey,
    baseURL: target.baseURL,
  });

  const prepared = await prepareToolContext({
    client,
    input,
    startedAt,
    messages: buildOpenAIMessages(input.systemPrompt, input.messages),
  });

  const streamed = await streamAssistantCompletion({
    client,
    targetLabel: target.label,
    input,
    startedAt,
    messages: prepared.messages,
    persistedMessages: prepared.persistedMessages,
    agentSteps: prepared.agentSteps,
  });

  return {
    ...streamed,
    initialStage: prepared.initialStage,
    preludeEvents: prepared.preludeEvents,
  };
}

async function generateWithMockProvider(
  input: GenerateTurnInput,
  reason?: string,
): Promise<StreamedTurnResult> {
  const baseMetadata = buildBaseMetadata(input, 0);
  const directToolIntent = inferDirectToolIntent(input.messages);

  if (directToolIntent) {
    const executionContext = await executeToolIntent({
      input,
      startedAt: Date.now(),
      messages: [],
      intent: directToolIntent,
      metadataExtras: { directToolIntent: true, providerMode: "mock" },
    });
    const assistantText = [
      `当前处于演示模式，但工具仍然执行了真实请求：${directToolIntent.toolName}。`,
      "下面是基于真实工具结果整理出的说明：",
      executionContext.persistedMessages.at(-1)?.content ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    const metadata = {
      ...baseMetadata,
      provider: "MOCK",
      reason: reason ?? "real-tool-demo-mode",
    };

    return {
      stream: createBufferedTextStream(assistantText),
      initialStage: "tooling",
      preludeEvents: executionContext.preludeEvents,
      completion: Promise.resolve({
        assistantText,
        persistedMessages: [
          ...executionContext.persistedMessages,
          {
            role: "assistant",
            content: assistantText,
            metadata,
          },
        ],
        agentSteps: executionContext.agentSteps,
        metadata,
      }),
    };
  }

  const latestUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
  const assistantText = [
    reason ?? "当前正在使用演示模型。",
    "聊天链路、工具执行和持久化仍然可用，但最终生成文本不是来自真实模型。",
    latestUserMessage
      ? `你刚才的问题是：“${latestUserMessage.content}”。`
      : "你可以继续发送消息，观察完整的聊天和工具流。",
  ].join(" ");
  const metadata = {
    ...baseMetadata,
    provider: "MOCK",
    reason: reason ?? "default-demo-provider",
  };

  return {
    stream: createBufferedTextStream(assistantText),
    initialStage: "thinking",
    completion: Promise.resolve({
      assistantText,
      persistedMessages: [
        {
          role: "assistant",
          content: assistantText,
          metadata,
        },
      ],
      agentSteps: [],
      metadata,
    }),
  };
}

export async function generateAssistantTurn(input: GenerateTurnInput) {
  if (input.modelProvider === "MOCK") {
    if (!isDevelopment || (!allowDemoProvider && hasCompatibleApiKey)) {
      throw new Error(
        "当前已处于真实联调模式，演示模型已禁用，请切换到真实模型预设。",
      );
    }

    return generateWithMockProvider(input);
  }

  return generateWithCompatibleProvider(input);
}
