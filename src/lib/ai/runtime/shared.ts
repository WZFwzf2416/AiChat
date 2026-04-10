import type {
  AgentStep,
  AppModelProvider,
  ChatMessage,
  ChatMessageMetadata,
  ToolCallRecord,
} from "@/types/chat";

export type AgentRuntimePolicy = {
  maxToolSteps: number;
  heuristicFallbackEnabled: boolean;
};

export const DEFAULT_AGENT_RUNTIME_POLICY: AgentRuntimePolicy = {
  maxToolSteps: 3,
  heuristicFallbackEnabled: true,
};

export type GenerateTurnInput = {
  modelProvider: AppModelProvider;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  turnId: string;
  messages: ChatMessage[];
  context: {
    totalMessages: number;
    includedMessages: number;
    trimmedCount: number;
    toolMessages: number;
  };
};

export type PersistedTurnMessage = {
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
  metadata?: ChatMessageMetadata | null;
};

export type CompletedTurn = {
  assistantText: string;
  persistedMessages: PersistedTurnMessage[];
  agentSteps: AgentStep[];
  metadata: ChatMessageMetadata;
};

export type ProviderStreamEvent =
  | { type: "stage"; stage: "thinking" | "tooling" | "finalizing" }
  | {
      type: "tool";
      phase: "start" | "result";
      toolName: string;
      label: string;
      summary?: string;
      error?: boolean;
    };

export type StreamedTurnResult = {
  stream: ReadableStream<Uint8Array>;
  completion: Promise<CompletedTurn>;
  initialStage: "thinking" | "tooling";
  preludeEvents?: ProviderStreamEvent[];
};

export type DirectToolIntent = {
  toolName:
    | "search_knowledge_base"
    | "get_current_time"
    | "get_weather_snapshot";
  args: Record<string, unknown>;
  preamble: string;
  label: string;
};

export type CompatibleTarget =
  | {
      label: "QWEN" | "OPENAI";
      apiKey: string;
      baseURL?: string;
    }
  | { error: string };

export type PreparedToolContext = {
  initialStage: "thinking" | "tooling";
  messages: Array<Record<string, unknown>>;
  persistedMessages: PersistedTurnMessage[];
  agentSteps: AgentStep[];
  preludeEvents: ProviderStreamEvent[];
};

export function buildOpenAIMessages(
  systemPrompt: string,
  messages: ChatMessage[],
) {
  const baseMessages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: [
        systemPrompt,
        "",
        "上下文组织规则：",
        "1. 优先回答用户最新问题。",
        "2. 如果使用过工具，请明确哪些结论来自工具，哪些来自模型整理。",
        "3. 如果上下文被裁剪，请基于当前窗口继续，不要虚构更早对话。",
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

export function extractAssistantText(content: unknown) {
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

export function buildBaseMetadata(
  input: GenerateTurnInput,
  durationMs: number,
): ChatMessageMetadata {
  return {
    model: input.modelId,
    provider: input.modelProvider,
    durationMs,
    context: input.context,
    turnId: input.turnId,
  };
}

export function buildVisibleMetadata(
  input: GenerateTurnInput,
  extras?: ChatMessageMetadata,
): ChatMessageMetadata {
  return {
    ...extras,
    turnId: input.turnId,
    visibility: "visible",
  };
}

export function buildDebugMetadata(
  input: GenerateTurnInput,
  extras?: ChatMessageMetadata,
): ChatMessageMetadata {
  return {
    ...extras,
    turnId: input.turnId,
    visibility: "debug",
  };
}

export function attachTurnId(step: AgentStep, turnId: string): AgentStep {
  return {
    ...step,
    payload: {
      ...(step.payload ?? {}),
      turnId,
    },
  };
}
