import { hasDatabaseUrl, prisma } from "@/lib/db";
import { isDevelopment } from "@/lib/env";
import {
  getDefaultModelConfig,
  getSuggestedSessionProvider,
} from "@/lib/models";
import type { KnowledgeEntryInput, SessionSettingsPatch } from "@/types/chat";
import {
  createRuntimeStatus,
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
import type { PersistedAssistantTurn } from "@/lib/repositories/chat-repository-shared";

function resolveStorageMode() {
  return hasDatabaseUrl && prisma ? "prisma" : "memory";
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

export async function getChatBootstrap() {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return getMemoryBootstrap();
  }

  try {
    return await getPrismaBootstrap();
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return {
      ...getMemoryBootstrap(),
      runtime: createRuntimeStatus("memory"),
    };
  }
}

export async function createSession() {
  const bootstrap = await getChatBootstrap();
  const defaultConfig =
    bootstrap.modelConfigs.find((config) => config.isDefault) ??
    getDefaultModelConfig(
      getSuggestedSessionProvider(bootstrap.runtime.compatibleApiConfigured),
    );

  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return createMemorySession(
      bootstrap.runtime.compatibleApiConfigured,
      defaultConfig,
    );
  }

  try {
    return await createPrismaSession(defaultConfig);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return createMemorySession(
      bootstrap.runtime.compatibleApiConfigured,
      defaultConfig,
    );
  }
}

export async function getSession(sessionId: string) {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return getMemorySession(sessionId);
  }

  try {
    return await getPrismaSession(sessionId);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return getMemorySession(sessionId);
  }
}

export async function saveUserMessage(sessionId: string, content: string) {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return saveMemoryUserMessage(sessionId, content);
  }

  try {
    return await savePrismaUserMessage(sessionId, content);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return saveMemoryUserMessage(sessionId, content);
  }
}

export async function updateSessionSettings(
  sessionId: string,
  patch: SessionSettingsPatch,
) {
  const appliedConfig = patch.modelConfigId
    ? await findModelConfig(patch.modelConfigId)
    : null;

  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return updateMemorySessionSettings(sessionId, patch, appliedConfig);
  }

  try {
    return await updatePrismaSessionSettings(sessionId, patch, appliedConfig);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return updateMemorySessionSettings(sessionId, patch, appliedConfig);
  }
}

export async function saveAssistantTurn(
  sessionId: string,
  turn: PersistedAssistantTurn,
) {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return saveMemoryAssistantTurn(sessionId, turn);
  }

  try {
    return await savePrismaAssistantTurn(sessionId, turn);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return saveMemoryAssistantTurn(sessionId, turn);
  }
}

export async function searchKnowledgeBase(query: string) {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return searchMemoryKnowledgeBase(query);
  }

  try {
    return await searchPrismaKnowledgeBase(query);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return searchMemoryKnowledgeBase(query);
  }
}

export async function listKnowledgeEntries() {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return listMemoryKnowledgeEntries();
  }

  try {
    return await listPrismaKnowledgeEntries();
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return listMemoryKnowledgeEntries();
  }
}

export async function createKnowledgeEntry(input: KnowledgeEntryInput) {
  if (!prisma || resolveStorageMode() === "memory") {
    ensureMemoryModeAllowed();
    return createMemoryKnowledgeEntry(input);
  }

  try {
    return await createPrismaKnowledgeEntry(input);
  } catch (error) {
    if (!shouldFallbackToMemory(error)) {
      throw error;
    }

    return createMemoryKnowledgeEntry(input);
  }
}
