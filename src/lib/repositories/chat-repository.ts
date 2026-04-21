import { hasDatabaseUrl, prisma } from "@/lib/db";
import { isDevelopment } from "@/lib/env";
import {
  getDefaultModelConfig,
  getSuggestedSessionProvider,
} from "@/lib/models";
import {
  createRuntimeStatus,
  type PersistedAssistantTurn,
  isDatabaseUnavailableError,
} from "@/lib/repositories/chat-repository-shared";
import {
  createMemoryKnowledgeEntry,
  createMemorySession,
  getMemoryBootstrap,
  getMemorySession,
  listMemoryKnowledgeEntries,
  saveMemoryAssistantTurn,
  saveMemoryUserMessage,
  searchMemoryKnowledgeBase,
  updateMemorySessionSettings,
} from "@/lib/repositories/chat-repository-memory";
import {
  createPrismaKnowledgeEntry,
  createPrismaSession,
  findModelConfig,
  getPrismaBootstrap,
  getPrismaSession,
  listPrismaKnowledgeEntries,
  savePrismaAssistantTurn,
  savePrismaUserMessage,
  searchPrismaKnowledgeBase,
  updatePrismaSessionSettings,
} from "@/lib/repositories/chat-repository-prisma";
import type {
  ChatMessageMetadata,
  KnowledgeEntryInput,
  SearchableKnowledgeEntry,
  SessionSettingsPatch,
} from "@/types/chat";

function resolveStorageMode() {
  return hasDatabaseUrl && prisma ? "prisma" : "memory";
}

function shouldUseMemoryStorage() {
  return !prisma || resolveStorageMode() === "memory";
}

function ensureMemoryModeAllowed() {
  if (isDevelopment) {
    return;
  }

  throw new Error("当前环境要求使用真实数据库，不允许回退到内存模式。");
}

function shouldFallbackToMemory(error: unknown) {
  return isDevelopment && isDatabaseUnavailableError(error);
}

async function runWithStorageFallback<T>(
  memoryFactory: () => T | Promise<T>,
  prismaFactory: () => Promise<T>,
  fallbackFactory: () => T | Promise<T> = memoryFactory,
) {
  if (shouldUseMemoryStorage()) {
    ensureMemoryModeAllowed();
    return await memoryFactory();
  }

  try {
    return await prismaFactory();
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return await fallbackFactory();
  }
}

export async function getChatBootstrap() {
  return runWithStorageFallback(
    () => getMemoryBootstrap(),
    () => getPrismaBootstrap(),
    () => ({
      ...getMemoryBootstrap(),
      runtime: createRuntimeStatus("memory"),
    }),
  );
}

export async function createSession() {
  const bootstrap = await getChatBootstrap();
  const defaultConfig =
    bootstrap.modelConfigs.find((config) => config.isDefault) ??
    getDefaultModelConfig(
      getSuggestedSessionProvider(bootstrap.runtime.compatibleApiConfigured),
    );

  return runWithStorageFallback(
    () =>
      createMemorySession(
        bootstrap.runtime.compatibleApiConfigured,
        defaultConfig,
      ),
    () => createPrismaSession(defaultConfig),
  );
}

export async function getSession(sessionId: string) {
  return runWithStorageFallback(
    () => getMemorySession(sessionId),
    () => getPrismaSession(sessionId),
  );
}

export async function saveUserMessage(
  sessionId: string,
  content: string,
  metadata?: ChatMessageMetadata,
) {
  return runWithStorageFallback(
    () => saveMemoryUserMessage(sessionId, content, metadata),
    () => savePrismaUserMessage(sessionId, content, metadata),
  );
}

export async function updateSessionSettings(
  sessionId: string,
  patch: SessionSettingsPatch,
) {
  const appliedConfig = patch.modelConfigId
    ? await findModelConfig(patch.modelConfigId)
    : null;

  return runWithStorageFallback(
    () => updateMemorySessionSettings(sessionId, patch, appliedConfig),
    () => updatePrismaSessionSettings(sessionId, patch, appliedConfig),
  );
}

export async function saveAssistantTurn(
  sessionId: string,
  turn: PersistedAssistantTurn,
) {
  return runWithStorageFallback(
    () => saveMemoryAssistantTurn(sessionId, turn),
    () => savePrismaAssistantTurn(sessionId, turn),
  );
}

export async function searchKnowledgeBase(
  query: string,
): Promise<SearchableKnowledgeEntry[]> {
  return runWithStorageFallback(
    () => searchMemoryKnowledgeBase(query),
    () => searchPrismaKnowledgeBase(query),
  );
}

export async function listKnowledgeEntries() {
  return runWithStorageFallback(
    () => listMemoryKnowledgeEntries(),
    () => listPrismaKnowledgeEntries(),
  );
}

export async function createKnowledgeEntry(input: KnowledgeEntryInput) {
  return runWithStorageFallback(
    () => createMemoryKnowledgeEntry(input),
    () => createPrismaKnowledgeEntry(input),
  );
}
