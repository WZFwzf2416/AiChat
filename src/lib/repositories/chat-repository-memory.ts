import {
  DEFAULT_SYSTEM_PROMPT,
  getDefaultModelConfig,
  getSuggestedSessionProvider,
} from "@/lib/models";
import { createId, summarizeTitle } from "@/lib/utils";
import type {
  ChatBootstrapPayload,
  ChatMessageMetadata,
  ChatSession,
  KnowledgeEntry,
  KnowledgeEntryInput,
  ModelConfig,
  SearchableKnowledgeEntry,
  SessionSettingsPatch,
} from "@/types/chat";
import {
  createRuntimeStatus,
  getMemoryStore,
  NEW_SESSION_TITLE,
  normalizeKnowledgeEntry,
  rankKnowledgeEntries,
  type PersistedAssistantTurn,
} from "@/lib/repositories/chat-repository-shared";

export function getMemoryBootstrap(): ChatBootstrapPayload {
  const store = getMemoryStore();

  return {
    sessions: store.sessions,
    modelConfigs: store.modelConfigs,
    runtime: createRuntimeStatus("memory"),
    knowledgeEntries: store.knowledgeEntries,
  };
}

export function createMemorySession(
  compatibleApiConfigured: boolean,
  defaultConfig?: ModelConfig,
) {
  const store = getMemoryStore();
  const selectedConfig =
    defaultConfig ??
    getDefaultModelConfig(getSuggestedSessionProvider(compatibleApiConfigured));

  const session: ChatSession = {
    id: createId("session"),
    title: NEW_SESSION_TITLE,
    modelProvider: selectedConfig.provider,
    modelId: selectedConfig.modelId,
    temperature: selectedConfig.temperature,
    maxOutputTokens: selectedConfig.maxOutputTokens,
    systemPrompt: selectedConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    agentSteps: [],
  };

  store.sessions.unshift(session);
  return session;
}

export function getMemorySession(sessionId: string) {
  return getMemoryStore().sessions.find((session) => session.id === sessionId) ?? null;
}

export function saveMemoryUserMessage(
  sessionId: string,
  content: string,
  metadata?: ChatMessageMetadata,
) {
  const store = getMemoryStore();
  const session = store.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return null;
  }

  session.messages.push({
    id: createId("msg"),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
    metadata: metadata ?? { visibility: "visible" },
  });
  session.updatedAt = new Date().toISOString();

  if (session.messages.filter((item) => item.role === "user").length === 1) {
    session.title = summarizeTitle(content);
  }

  return session;
}

export function updateMemorySessionSettings(
  sessionId: string,
  patch: SessionSettingsPatch,
  appliedConfig?: ModelConfig | null,
) {
  const store = getMemoryStore();
  const session = store.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return null;
  }

  session.modelProvider =
    appliedConfig?.provider ?? patch.modelProvider ?? session.modelProvider;
  session.modelId = appliedConfig?.modelId ?? patch.modelId ?? session.modelId;
  session.temperature =
    appliedConfig?.temperature ?? patch.temperature ?? session.temperature;
  session.maxOutputTokens =
    appliedConfig?.maxOutputTokens ??
    patch.maxOutputTokens ??
    session.maxOutputTokens;
  session.systemPrompt =
    appliedConfig?.systemPrompt ?? patch.systemPrompt ?? session.systemPrompt;
  session.updatedAt = new Date().toISOString();

  return session;
}

export function saveMemoryAssistantTurn(
  sessionId: string,
  turn: PersistedAssistantTurn,
) {
  const store = getMemoryStore();
  const session = store.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return null;
  }

  const createdAt = new Date().toISOString();
  session.messages.push(
    ...turn.messages.map((message) => ({
      id: createId("msg"),
      role: message.role,
      content: message.content,
      createdAt,
      toolCallId: message.toolCallId ?? null,
      toolName: message.toolName ?? null,
      toolCalls: message.toolCalls ?? null,
      toolResults: message.toolResults ?? null,
      metadata: message.metadata ?? null,
    })),
  );
  session.agentSteps.push(
    ...turn.agentSteps.map((step) => ({
      ...step,
      id: step.id || createId("step"),
    })),
  );
  session.updatedAt = new Date().toISOString();
  return session;
}

export function searchMemoryKnowledgeBase(
  query: string,
): SearchableKnowledgeEntry[] {
  return rankKnowledgeEntries(getMemoryStore().knowledgeEntries, query);
}

export function listMemoryKnowledgeEntries() {
  return [...getMemoryStore().knowledgeEntries].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function createMemoryKnowledgeEntry(input: KnowledgeEntryInput): KnowledgeEntry {
  const entry = normalizeKnowledgeEntry({
    id: createId("kb"),
    title: input.title.trim(),
    content: input.content.trim(),
    tags: input.tags,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const store = getMemoryStore();
  store.knowledgeEntries.unshift(entry);

  return entry;
}
