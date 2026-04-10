import { hasCompatibleApiKey, isDevelopment, preferredCompatibleBackend } from "@/lib/env";
import {
  DEFAULT_SYSTEM_PROMPT,
  getAvailableModelConfigs,
  getDefaultModelConfig,
  getSuggestedSessionProvider,
} from "@/lib/models";
import { createId, safeJsonParse } from "@/lib/utils";
import type {
  AgentStep,
  ChatMessage,
  ChatMessageMetadata,
  ChatSession,
  KnowledgeEntry,
  ModelConfig,
  ToolCallRecord,
  ToolResultRecord,
} from "@/types/chat";

export type PersistedMessageInput = {
  role: ChatMessage["role"];
  content: string;
  toolCallId?: string | null;
  toolName?: string | null;
  toolCalls?: ToolCallRecord[] | null;
  toolResults?: ToolResultRecord[] | null;
  metadata?: ChatMessageMetadata | null;
};

export type PersistedAssistantTurn = {
  messages: PersistedMessageInput[];
  agentSteps: AgentStep[];
};

export type KnowledgeEntrySeed = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

export type RepositoryStore = {
  sessions: ChatSession[];
  modelConfigs: ModelConfig[];
  knowledgeEntries: KnowledgeEntry[];
};

declare global {
  var memoryChatStore: RepositoryStore | undefined;
}

export const STARTER_TITLE = "开始搭建你的第一个 AI Chat";
export const NEW_SESSION_TITLE = "新会话";

export const KNOWLEDGE_SEED: KnowledgeEntrySeed[] = [
  {
    id: "kb-architecture",
    title: "AI Chat 架构清单",
    content:
      "一个接近生产可用的 AI Chat 通常需要模型提供商抽象、会话持久化、流式传输、提示词分层、调用日志，以及未来可扩展为 Agent 的工具注册表。",
    tags: ["架构", "聊天", "agent"],
  },
  {
    id: "kb-context-window",
    title: "上下文窗口策略",
    content:
      "优先保留最近的用户与助手对话，保留会影响答案的工具输出，只有在会话长度明显影响成本或延迟时再引入摘要。",
    tags: ["上下文", "记忆", "tokens"],
  },
  {
    id: "kb-frontend-learning",
    title: "前端开发者学习路线",
    content:
      "前端工程师学习 AI 产品开发最快的方式，是先做真实界面，再逐步补上模型编排、提示词组合、工具调用和可观测性。",
    tags: ["学习", "前端", "路线图"],
  },
];

function createKnowledgeEntryRecord(entry: KnowledgeEntrySeed): KnowledgeEntry {
  const now = new Date().toISOString();
  return {
    ...entry,
    createdAt: now,
    updatedAt: now,
  };
}

export function createStarterSession(
  modelConfig = getDefaultModelConfig(
    getSuggestedSessionProvider(hasCompatibleApiKey),
  ),
): ChatSession {
  const now = new Date().toISOString();

  return {
    id: createId("session"),
    title: STARTER_TITLE,
    modelProvider: modelConfig.provider,
    modelId: modelConfig.modelId,
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxOutputTokens,
    systemPrompt: modelConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createId("msg"),
        role: "assistant",
        content:
          "欢迎来到你的 AI Chat 工作台。这里保留了真实聊天、工具调用和 Agent 轨迹的完整链路，你可以一边试，一边理解产品和代码是怎么连起来的。",
        createdAt: now,
        metadata: { seed: true, visibility: "visible" },
      },
    ],
    agentSteps: [],
  };
}

export function getMemoryStore(): RepositoryStore {
  const modelConfigs = getAvailableModelConfigs();

  if (!globalThis.memoryChatStore) {
    globalThis.memoryChatStore = {
      sessions: [createStarterSession()],
      modelConfigs: [...modelConfigs],
      knowledgeEntries: KNOWLEDGE_SEED.map(createKnowledgeEntryRecord),
    };
  }

  globalThis.memoryChatStore.modelConfigs = [...modelConfigs];

  return globalThis.memoryChatStore;
}

export function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    ("code" in error &&
      (error as { code?: string }).code !== undefined &&
      ["ECONNREFUSED", "P1001"].includes(
        String((error as { code?: string }).code),
      )) ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("client password must be a string") ||
    error.message.includes("Can't reach database server")
  );
}

export function normalizeMessage(record: {
  id: string;
  role: string;
  content: string;
  createdAt: Date | string;
  toolCallId?: string | null;
  toolName?: string | null;
  toolCalls?: unknown;
  toolResults?: unknown;
  metadata?: unknown;
}): ChatMessage {
  return {
    id: record.id,
    role: record.role.toLowerCase() as ChatMessage["role"],
    content: record.content,
    createdAt: new Date(record.createdAt).toISOString(),
    toolCallId: record.toolCallId ?? null,
    toolName: record.toolName ?? null,
    toolCalls: safeJsonParse<ToolCallRecord[] | null>(record.toolCalls, null),
    toolResults: safeJsonParse<ToolResultRecord[] | null>(
      record.toolResults,
      null,
    ),
    metadata: safeJsonParse<ChatMessageMetadata | null>(record.metadata, null),
  };
}

export function normalizeAgentStep(record: {
  id: string;
  status: string;
  kind: string;
  label: string;
  payload?: unknown;
  createdAt: Date | string;
}): AgentStep {
  return {
    id: record.id,
    status: record.status.toLowerCase() as AgentStep["status"],
    kind: record.kind,
    label: record.label,
    payload: safeJsonParse<Record<string, unknown> | null>(record.payload, null),
    createdAt: new Date(record.createdAt).toISOString(),
  };
}

export function normalizeKnowledgeEntry(record: {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}): KnowledgeEntry {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    tags: record.tags,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}

export function createRuntimeStatus(storageMode: "prisma" | "memory") {
  return {
    storageMode,
    compatibleApiConfigured: hasCompatibleApiKey,
    preferredBackend: preferredCompatibleBackend,
    experienceMode: hasCompatibleApiKey ? ("real" as const) : ("demo" as const),
    demoModeReason: hasCompatibleApiKey
      ? null
      : isDevelopment
        ? "当前处于开发演示模式：尚未配置真实模型 API Key，最终生成文本将由演示模型返回。"
        : "当前环境未配置可用的真实模型 API Key。",
  };
}

export function rankKnowledgeEntries<
  T extends { title: string; content: string; tags: string[] },
>(entries: T[], query: string) {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const cjkPhrases =
    normalizedQuery.match(/[\u4e00-\u9fa5]{2,}/g)?.filter(Boolean) ?? [];
  const terms = [
    ...new Set([...words, ...cjkPhrases, normalizedQuery].filter(Boolean)),
  ];

  const scoreEntry = (entry: T) => {
    const title = entry.title.toLowerCase();
    const content = entry.content.toLowerCase();
    const tags = entry.tags.map((tag) => tag.toLowerCase());
    const haystack = `${title} ${content} ${tags.join(" ")}`;

    let score = 0;
    for (const term of terms) {
      if (!term) {
        continue;
      }

      if (title.includes(term)) {
        score += 6;
      }

      if (tags.some((tag) => tag.includes(term))) {
        score += 4;
      }

      if (content.includes(term)) {
        score += 2;
      }
    }

    if (normalizedQuery && haystack.includes(normalizedQuery)) {
      score += 8;
    }

    return score;
  };

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((item) => item.entry);
}
