import { getToolDefinition, runToolByName } from "@/lib/ai/tools";
import { createId } from "@/lib/utils";
import type { AgentStep, ChatMessageMetadata } from "@/types/chat";

import {
  attachTurnId,
  buildBaseMetadata,
  buildDebugMetadata,
  buildVisibleMetadata,
  type AgentRuntimePolicy,
  type DirectToolIntent,
  type GenerateTurnInput,
  type PersistedTurnMessage,
  type ProviderStreamEvent,
} from "@/lib/ai/runtime/shared";

function createTimeoutError(toolName: string, timeoutMs: number) {
  return new Error(`工具 ${toolName} 在 ${timeoutMs}ms 内未完成。`);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(createTimeoutError(toolName, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function executeToolIntent(params: {
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
  policy: AgentRuntimePolicy;
  persistedMessages?: PersistedTurnMessage[];
  agentSteps?: AgentStep[];
  preludeEvents?: ProviderStreamEvent[];
  intent: DirectToolIntent;
  metadataExtras?: ChatMessageMetadata;
}) {
  const {
    input,
    startedAt,
    messages,
    intent,
    policy,
    persistedMessages = [],
    agentSteps = [],
    preludeEvents = [],
    metadataExtras,
  } = params;

  const toolDefinition = getToolDefinition(intent.toolName);
  const toolCallId = createId("tool");
  const maxAttempts =
    1 + Math.min(policy.toolRetryLimit, toolDefinition?.retryable ? 1 : 0);
  const timeoutMs = toolDefinition?.timeoutMs ?? policy.toolExecutionTimeoutMs;

  let attempt = 0;
  let execution = await runToolByName(intent.toolName, intent.args, toolCallId);
  let lastErrorMessage: string | null = null;
  const executionStartedAt = Date.now();

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      execution = await withTimeout(
        runToolByName(intent.toolName, intent.args, toolCallId),
        timeoutMs,
        intent.toolName,
      );
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "未知错误";
      execution = await runToolByName(intent.toolName, intent.args, toolCallId);
      execution.agentStep.status = "failed";
      execution.agentStep.payload = {
        ...(execution.agentStep.payload ?? {}),
        errorMessage: lastErrorMessage,
      };
    }

    if (execution.agentStep.status !== "failed") {
      lastErrorMessage = null;
      break;
    }

    lastErrorMessage = String(
      execution.agentStep.payload?.errorMessage ?? execution.toolMessage.content,
    );
  }

  const toolFailed = execution.agentStep.status === "failed";
  const durationMs = Date.now() - executionStartedAt;
  const toolMetadata = {
    toolCategory: toolDefinition?.category ?? null,
    toolRiskLevel: toolDefinition?.riskLevel ?? null,
    toolSource: toolDefinition?.source ?? null,
    toolRetryable: toolDefinition?.retryable ?? false,
    timeoutMs,
    attempts: attempt,
    maxAttempts,
    durationMs,
  };

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
    metadata: buildDebugMetadata(input, {
      ...metadataExtras,
      ...toolMetadata,
      ...buildBaseMetadata(input, Date.now() - startedAt),
    }),
  });

  persistedMessages.push({
    ...execution.toolMessage,
    metadata: {
      ...execution.toolMessage.metadata,
      ...toolMetadata,
      ...buildVisibleMetadata(input, execution.toolMessage.metadata),
    },
  });

  const finalStep = attachTurnId(
    {
      ...execution.agentStep,
      payload: {
        ...(execution.agentStep.payload ?? {}),
        ...toolMetadata,
        lastErrorMessage,
      },
    },
    input.turnId,
    input.traceId,
  );

  agentSteps.push(finalStep);

  preludeEvents.push({
    type: "tool",
    phase: "start",
    toolName: intent.toolName,
    label: intent.label,
    traceId: input.traceId,
  });
  preludeEvents.push({
    type: "tool",
    phase: "result",
    toolName: intent.toolName,
    label: finalStep.label,
    traceId: input.traceId,
    summary: execution.toolMessage.content,
    error: toolFailed,
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
