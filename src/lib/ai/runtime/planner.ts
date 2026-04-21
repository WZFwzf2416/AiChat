import OpenAI from "openai";

import { getOpenAITools } from "@/lib/ai/tools";
import { safeJsonParse } from "@/lib/utils";
import type { AgentStep, ToolCallRecord } from "@/types/chat";

import { executeToolIntent } from "@/lib/ai/runtime/executor";
import {
  buildBaseMetadata,
  buildDebugMetadata,
  DEFAULT_AGENT_RUNTIME_POLICY,
  extractAssistantText,
  getPolicySnapshot,
  type AgentRuntimePolicy,
  type DirectToolIntent,
  type GenerateTurnInput,
  type PersistedTurnMessage,
  type PreparedToolContext,
  type ProviderStreamEvent,
} from "@/lib/ai/runtime/shared";

function normalizeIntentText(value: string) {
  return value
    .replace(/[，。！；：、“”‘’（）()?]/g, " ")
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
    /(?:查一下|搜索|检索|找找|查找|搜索知识库|查知识库)\s*(.+?)(?:的内容|内容|资料|文档|信息|建议)?$/,
  );
  const candidate = match?.[1]?.trim();

  if (candidate && candidate.length >= 2) {
    return candidate;
  }

  if (normalized.toLowerCase().includes("ai chat")) {
    return "AI Chat 架构演进";
  }

  return fallback;
}

export function inferDirectToolIntent(
  messages: GenerateTurnInput["messages"],
): DirectToolIntent | null {
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

function parseToolArguments(raw: string) {
  const parsed = safeJsonParse<Record<string, unknown> | null>(raw, null);
  return parsed ?? {};
}

function createPlanningStep(params: {
  input: GenerateTurnInput;
  index: number;
  label: string;
  payload?: Record<string, unknown>;
  status?: AgentStep["status"];
}) {
  return {
    id: `plan_${params.input.turnId}_${params.index}`,
    status: params.status ?? "completed",
    kind: "planning",
    label: params.label,
    payload: {
      ...(params.payload ?? {}),
      turnId: params.input.turnId,
      traceId: params.input.traceId,
      planningIteration: params.index,
    },
    createdAt: new Date().toISOString(),
  } satisfies AgentStep;
}

async function requestPlanningStep(params: {
  client: OpenAI;
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
  stepIndex: number;
}) {
  const planning = await params.client.chat.completions.create({
    model: params.input.modelId,
    temperature: params.input.temperature,
    max_completion_tokens: Math.min(600, params.input.maxOutputTokens),
    messages: params.messages as never,
    tools: getOpenAITools() as never,
    tool_choice: "auto",
  });

  const assistantMessage = planning.choices[0]?.message;
  const assistantText = extractAssistantText(assistantMessage?.content).trim();
  const rawToolCalls =
    assistantMessage?.tool_calls?.filter(
      (toolCall) => toolCall.type === "function",
    ) ?? [];

  return {
    planning,
    assistantText,
    rawToolCalls,
    metadata: {
      planningUsage: planning.usage ?? null,
      ...buildBaseMetadata(params.input, Date.now() - params.startedAt),
      planningIteration: params.stepIndex,
    },
  };
}

export async function prepareToolContext(params: {
  client: OpenAI;
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
  policy?: AgentRuntimePolicy;
}): Promise<PreparedToolContext> {
  const {
    client,
    input,
    startedAt,
    messages: initialMessages,
    policy = DEFAULT_AGENT_RUNTIME_POLICY,
  } = params;
  const messages = [...initialMessages];
  const persistedMessages: PersistedTurnMessage[] = [];
  const agentSteps: AgentStep[] = [];
  const preludeEvents: ProviderStreamEvent[] = [];
  const latestUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserContent = latestUserMessage?.content ?? "";
  const shouldFallbackToHeuristic =
    policy.heuristicFallbackEnabled && looksLikeToolRequest(latestUserContent);

  let usedTool = false;
  let initialStage: PreparedToolContext["initialStage"] = "thinking";

  for (
    let stepIndex = 0;
    stepIndex < policy.maxPlanningIterations;
    stepIndex += 1
  ) {
    const planningStep = await requestPlanningStep({
      client,
      input,
      startedAt,
      messages,
      stepIndex,
    });

    let serializedCalls: ToolCallRecord[] = planningStep.rawToolCalls.map(
      (toolCall) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: parseToolArguments(toolCall.function.arguments),
      }),
    );

    const truncatedToolCalls =
      serializedCalls.length > policy.maxToolCallsPerIteration;
    if (truncatedToolCalls) {
      serializedCalls = serializedCalls.slice(0, policy.maxToolCallsPerIteration);
    }

    if (serializedCalls.length === 0) {
      if (!usedTool && stepIndex === 0 && shouldFallbackToHeuristic) {
        const fallbackIntent = inferDirectToolIntent(input.messages);
        if (fallbackIntent) {
          initialStage = "tooling";
          usedTool = true;
          agentSteps.push(
            createPlanningStep({
              input,
              index: stepIndex,
              label: "模型没有主动调用工具，运行时启发式兜底触发了一次工具调用。",
              payload: {
                fallbackReason: "model-did-not-emit-tool-call",
                toolName: fallbackIntent.toolName,
                policy: getPolicySnapshot(policy),
              },
            }),
          );

          await executeToolIntent({
            input,
            startedAt,
            messages,
            policy,
            persistedMessages,
            agentSteps,
            preludeEvents,
            intent: fallbackIntent,
            metadataExtras: {
              directToolIntent: true,
              fallbackReason: "model-did-not-emit-tool-call",
              planningUsage: planningStep.planning.usage ?? null,
              runtimePolicy: getPolicySnapshot(policy),
            },
          });
          continue;
        }
      }

      agentSteps.push(
        createPlanningStep({
          input,
          index: stepIndex,
          label: usedTool
            ? "工具观察已经完成，Agent 决定停止继续调用工具并生成最终答复。"
            : "Agent 决定直接生成最终答复，不再调用工具。",
          payload: {
            modelResponse: planningStep.assistantText || null,
            toolCalls: 0,
            heuristicFallbackEnabled: policy.heuristicFallbackEnabled,
            policy: getPolicySnapshot(policy),
          },
        }),
      );

      if (planningStep.assistantText && policy.persistPlanningMessages) {
        persistedMessages.push({
          role: "assistant",
          content: planningStep.assistantText,
          metadata: buildDebugMetadata(input, {
            modelPlanningNote: true,
            runtimePolicy: getPolicySnapshot(policy),
            ...planningStep.metadata,
          }),
        });
      }

      return {
        initialStage,
        messages,
        persistedMessages,
        agentSteps,
        preludeEvents,
      };
    }

    initialStage = "tooling";
    usedTool = true;

    persistedMessages.push({
      role: "assistant",
      content:
        planningStep.assistantText ||
        "模型决定继续调用工具处理这一轮请求。",
      toolCalls: serializedCalls,
      metadata: buildDebugMetadata(input, {
        modelToolCall: true,
        runtimePolicy: getPolicySnapshot(policy),
        truncatedToolCalls,
        ...planningStep.metadata,
      }),
    });
    agentSteps.push(
      createPlanningStep({
        input,
        index: stepIndex,
        label: `Agent 进入第 ${stepIndex + 1} 轮工具规划，并决定调用 ${serializedCalls.length} 个工具。`,
        payload: {
          toolNames: serializedCalls.map((toolCall) => toolCall.name),
          toolCalls: serializedCalls.length,
          modelResponse: planningStep.assistantText || null,
          truncatedToolCalls,
          policy: getPolicySnapshot(policy),
        },
      }),
    );

    messages.push({
      role: "assistant",
      tool_calls: serializedCalls.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      })),
    });

    for (const toolCall of serializedCalls) {
      await executeToolIntent({
        input,
        startedAt,
        messages,
        policy,
        persistedMessages,
        agentSteps,
        preludeEvents,
        intent: {
          toolName: toolCall.name as DirectToolIntent["toolName"],
          args: toolCall.arguments,
          preamble: `模型正在调用工具：${toolCall.name}`,
          label: `模型调用工具：${toolCall.name}`,
        },
      });
    }
  }

  agentSteps.push(
    createPlanningStep({
      input,
      index: policy.maxPlanningIterations,
      label: `达到最大规划轮数 ${policy.maxPlanningIterations}，Agent 停止继续规划并进入最终答复阶段。`,
      payload: {
        policy: getPolicySnapshot(policy),
      },
      status: "failed",
    }),
  );

  persistedMessages.push({
    role: "assistant",
    content: `本轮最多只允许执行 ${policy.maxPlanningIterations} 轮工具规划，系统已停止继续调用工具。`,
    metadata: buildDebugMetadata(input, {
      maxPlanningIterationsReached: true,
      runtimePolicy: getPolicySnapshot(policy),
      ...buildBaseMetadata(input, Date.now() - startedAt),
    }),
  });

  return {
    initialStage,
    messages,
    persistedMessages,
    agentSteps,
    preludeEvents,
  };
}
