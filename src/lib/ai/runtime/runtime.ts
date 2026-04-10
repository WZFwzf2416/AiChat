import OpenAI from "openai";

import {
  allowDemoProvider,
  appEnv,
  hasCompatibleApiKey,
  hasOpenAIKey,
  hasQwenKey,
  isDevelopment,
} from "@/lib/env";

import { executeToolIntent } from "@/lib/ai/runtime/executor";
import {
  inferDirectToolIntent,
  prepareToolContext,
} from "@/lib/ai/runtime/planner";
import {
  buildBaseMetadata,
  buildOpenAIMessages,
  type CompatibleTarget,
  type GenerateTurnInput,
  type StreamedTurnResult,
} from "@/lib/ai/runtime/shared";
import {
  createBufferedTextStream,
  streamAssistantCompletion,
} from "@/lib/ai/runtime/streaming";

function isQwenModel(modelId: string) {
  return modelId.toLowerCase().startsWith("qwen");
}

function resolveCompatibleClient(modelId: string): CompatibleTarget {
  if (isQwenModel(modelId)) {
    if (!hasQwenKey) {
      return {
        error:
          "当前会话选择的是通义千问模型，但没有配置 `QWEN_API_KEY`。",
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
  const latestUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
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
      visibility: "visible" as const,
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
    visibility: "visible" as const,
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

export async function generateTurnRuntime(
  input: GenerateTurnInput,
): Promise<StreamedTurnResult> {
  if (input.modelProvider === "MOCK") {
    if (!isDevelopment || (!allowDemoProvider && hasCompatibleApiKey)) {
      throw new Error(
        "当前已经处于真实联调模式，演示模型已禁用，请切换到真实模型预设。",
      );
    }

    return generateWithMockProvider(input);
  }

  return generateWithCompatibleProvider(input);
}
