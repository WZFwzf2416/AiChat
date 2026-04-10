import type {
  AgentStep,
  ChatMessage,
  ChatMessageMetadata,
  ChatMessageVisibility,
  ChatSession,
  ChatTurnStatus,
  ChatTurnSummary,
} from "@/types/chat";

export function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "新会话";
  }

  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

export function buildContextWindow(messages: ChatMessage[], maxMessages = 14) {
  const safeMaxMessages = Math.max(4, maxMessages);
  const trimmedMessages = messages.slice(
    Math.max(0, messages.length - safeMaxMessages),
  );

  return {
    messages: trimmedMessages,
    totalMessages: messages.length,
    includedMessages: trimmedMessages.length,
    trimmedCount: Math.max(0, messages.length - trimmedMessages.length),
    toolMessages: trimmedMessages.filter((message) => message.role === "tool")
      .length,
  };
}

export function chunkText(text: string, chunkSize = 36) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

export function getMessageVisibility(
  metadata: ChatMessageMetadata | null | undefined,
): ChatMessageVisibility {
  if (metadata?.visibility) {
    return metadata.visibility;
  }

  if (metadata?.hidden) {
    return "internal";
  }

  return "visible";
}

export function isMessageVisibleToUser(message: ChatMessage) {
  return getMessageVisibility(message.metadata) === "visible";
}

export function getMessageTurnId(message: ChatMessage) {
  return typeof message.metadata?.turnId === "string"
    ? message.metadata.turnId
    : null;
}

function getStepTurnId(step: AgentStep) {
  return typeof step.payload?.turnId === "string" ? step.payload.turnId : null;
}

function getTurnStatus(params: {
  hasStreaming: boolean;
  hasFailure: boolean;
}): ChatTurnStatus {
  if (params.hasStreaming) {
    return "streaming";
  }

  if (params.hasFailure) {
    return "failed";
  }

  return "completed";
}

export function buildTurnSummaries(session: ChatSession | null): ChatTurnSummary[] {
  if (!session) {
    return [];
  }

  const turnMap = new Map<
    string,
    {
      id: string;
      createdAt: string;
      updatedAt: string;
      userMessageId: string | null;
      userContentPreview: string;
      visibleMessageCount: number;
      debugMessageCount: number;
      toolNames: Set<string>;
      toolCount: number;
      stepCount: number;
      hasStreaming: boolean;
      hasFailure: boolean;
      errorMessage: string | null;
    }
  >();

  function ensureTurn(turnId: string, createdAt: string) {
    const existing = turnMap.get(turnId);
    if (existing) {
      return existing;
    }

    const created = {
      id: turnId,
      createdAt,
      updatedAt: createdAt,
      userMessageId: null,
      userContentPreview: "",
      visibleMessageCount: 0,
      debugMessageCount: 0,
      toolNames: new Set<string>(),
      toolCount: 0,
      stepCount: 0,
      hasStreaming: false,
      hasFailure: false,
      errorMessage: null,
    };
    turnMap.set(turnId, created);
    return created;
  }

  for (const message of session.messages) {
    const turnId = getMessageTurnId(message);
    if (!turnId) {
      continue;
    }

    const turn = ensureTurn(turnId, message.createdAt);
    turn.updatedAt = message.createdAt;

    if (isMessageVisibleToUser(message)) {
      turn.visibleMessageCount += 1;
    } else {
      turn.debugMessageCount += 1;
    }

    if (message.role === "user" && !turn.userMessageId) {
      turn.userMessageId = message.id;
      turn.userContentPreview = message.content.trim();
    }

    if (message.role === "tool") {
      turn.toolCount += 1;
      if (message.toolName) {
        turn.toolNames.add(message.toolName);
      }
    }

    if (message.metadata?.streaming === true) {
      turn.hasStreaming = true;
    }

    if (message.metadata?.error) {
      turn.hasFailure = true;
      turn.errorMessage = message.content;
    }
  }

  for (const step of session.agentSteps) {
    const turnId = getStepTurnId(step);
    if (!turnId) {
      continue;
    }

    const turn = ensureTurn(turnId, step.createdAt);
    turn.updatedAt = step.createdAt;
    turn.stepCount += 1;

    if (step.status === "failed") {
      turn.hasFailure = true;
      turn.errorMessage = step.label;
    }
  }

  return [...turnMap.values()]
    .map((turn) => ({
      id: turn.id,
      createdAt: turn.createdAt,
      updatedAt: turn.updatedAt,
      status: getTurnStatus({
        hasStreaming: turn.hasStreaming,
        hasFailure: turn.hasFailure,
      }),
      userMessageId: turn.userMessageId,
      userContentPreview: turn.userContentPreview,
      visibleMessageCount: turn.visibleMessageCount,
      debugMessageCount: turn.debugMessageCount,
      toolCount: turn.toolCount,
      stepCount: turn.stepCount,
      toolNames: [...turn.toolNames],
      errorMessage: turn.errorMessage,
    }))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
