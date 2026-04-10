import { runToolByName } from "@/lib/ai/tools";
import { createId } from "@/lib/utils";
import type { AgentStep, ChatMessageMetadata } from "@/types/chat";

import {
  attachTurnId,
  buildBaseMetadata,
  buildDebugMetadata,
  buildVisibleMetadata,
  type DirectToolIntent,
  type GenerateTurnInput,
  type PersistedTurnMessage,
  type ProviderStreamEvent,
} from "@/lib/ai/runtime/shared";

export async function executeToolIntent(params: {
  input: GenerateTurnInput;
  startedAt: number;
  messages: Array<Record<string, unknown>>;
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
    persistedMessages = [],
    agentSteps = [],
    preludeEvents = [],
    metadataExtras,
  } = params;

  const toolCallId = createId("tool");
  const execution = await runToolByName(intent.toolName, intent.args, toolCallId);
  const toolFailed = execution.agentStep.status === "failed";

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
      ...buildBaseMetadata(input, Date.now() - startedAt),
    }),
  });
  persistedMessages.push({
    ...execution.toolMessage,
    metadata: {
      ...execution.toolMessage.metadata,
      ...buildVisibleMetadata(input, execution.toolMessage.metadata),
    },
  });
  agentSteps.push(attachTurnId(execution.agentStep, input.turnId));

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
