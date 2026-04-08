import { hasDatabaseUrl, prisma } from "@/lib/db";
import {
  getDefaultModelConfig,
  getSuggestedSessionProvider,
} from "@/lib/models";
import type { SessionSettingsPatch } from "@/types/chat";
import {
  createRuntimeStatus,
  isDatabaseUnavailableError,
} from "@/lib/repositories/chat-repository-shared";
import {
  createMemorySession,
  getMemoryBootstrap,
  getMemorySession,
  saveMemoryAssistantTurn,
  saveMemoryUserMessage,
  searchMemoryKnowledgeBase,
  updateMemorySessionSettings,
} from "@/lib/repositories/chat-repository-memory";
import {
  createPrismaSession,
  findModelConfig,
  getPrismaBootstrap,
  getPrismaSession,
  savePrismaAssistantTurn,
  savePrismaUserMessage,
  searchPrismaKnowledgeBase,
  updatePrismaSessionSettings,
} from "@/lib/repositories/chat-repository-prisma";
import type { PersistedAssistantTurn } from "@/lib/repositories/chat-repository-shared";

function resolveStorageMode() {
  return hasDatabaseUrl && prisma ? "prisma" : "memory";
}

export async function getChatBootstrap() {
  if (!prisma || resolveStorageMode() === "memory") {
    return getMemoryBootstrap();
  }

  try {
    return await getPrismaBootstrap();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
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
    return createMemorySession(bootstrap.runtime.compatibleApiConfigured, defaultConfig);
  }

  try {
    return await createPrismaSession(defaultConfig);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return createMemorySession(bootstrap.runtime.compatibleApiConfigured, defaultConfig);
  }
}

export async function getSession(sessionId: string) {
  if (!prisma || resolveStorageMode() === "memory") {
    return getMemorySession(sessionId);
  }

  try {
    return await getPrismaSession(sessionId);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return getMemorySession(sessionId);
  }
}

export async function saveUserMessage(sessionId: string, content: string) {
  if (!prisma || resolveStorageMode() === "memory") {
    return saveMemoryUserMessage(sessionId, content);
  }

  try {
    return await savePrismaUserMessage(sessionId, content);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
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
    return updateMemorySessionSettings(sessionId, patch, appliedConfig);
  }

  try {
    return await updatePrismaSessionSettings(sessionId, patch, appliedConfig);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
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
    return saveMemoryAssistantTurn(sessionId, turn);
  }

  try {
    return await savePrismaAssistantTurn(sessionId, turn);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return saveMemoryAssistantTurn(sessionId, turn);
  }
}

export async function searchKnowledgeBase(query: string) {
  if (!prisma || resolveStorageMode() === "memory") {
    return searchMemoryKnowledgeBase(query);
  }

  try {
    return await searchPrismaKnowledgeBase(query);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return searchMemoryKnowledgeBase(query);
  }
}
