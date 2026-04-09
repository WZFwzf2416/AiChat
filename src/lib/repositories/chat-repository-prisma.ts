import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/models";
import { summarizeTitle } from "@/lib/utils";
import type {
  ChatBootstrapPayload,
  ChatSession,
  KnowledgeEntry,
  KnowledgeEntryInput,
  ModelConfig,
  SessionSettingsPatch,
} from "@/types/chat";
import {
  createRuntimeStatus,
  KNOWLEDGE_SEED,
  normalizeAgentStep,
  normalizeKnowledgeEntry,
  normalizeMessage,
  rankKnowledgeEntries,
  STARTER_TITLE,
  type PersistedAssistantTurn,
} from "@/lib/repositories/chat-repository-shared";

export async function ensureDatabaseSeed() {
  if (!prisma) {
    return;
  }

  const desiredConfigs = (await import("@/lib/models")).getAvailableModelConfigs();
  const desiredConfigIds = desiredConfigs.map((config) => config.id);

  await prisma.modelConfig.deleteMany({
    where: {
      id: {
        notIn: desiredConfigIds,
      },
    },
  });

  for (const config of desiredConfigs) {
    await prisma.modelConfig.upsert({
      where: { id: config.id },
      update: {
        provider: config.provider,
        name: config.name,
        modelId: config.modelId,
        isDefault: config.isDefault,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        systemPrompt: config.systemPrompt,
      },
      create: {
        id: config.id,
        provider: config.provider,
        name: config.name,
        modelId: config.modelId,
        isDefault: config.isDefault,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        systemPrompt: config.systemPrompt,
      },
    });
  }

  const knowledgeCount = await prisma.knowledgeEntry.count();
  if (knowledgeCount === 0) {
    await prisma.knowledgeEntry.createMany({
      data: KNOWLEDGE_SEED,
    });
  }
}

export async function normalizeDatabaseSession(
  sessionId: string,
): Promise<ChatSession | null> {
  if (!prisma) {
    return null;
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      agentSteps: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    title: session.title,
    modelProvider: session.modelProvider,
    modelId: session.modelId,
    temperature: session.temperature,
    maxOutputTokens: session.maxOutputTokens,
    systemPrompt: session.systemPrompt,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map(normalizeMessage),
    agentSteps: session.agentSteps.map(normalizeAgentStep),
  };
}

export async function getPrismaBootstrap(): Promise<ChatBootstrapPayload> {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  await ensureDatabaseSeed();

  const {
    getAvailableModelConfigs,
    getDefaultModelConfig,
    getSuggestedSessionProvider,
  } = await import("@/lib/models");
  const runtime = createRuntimeStatus("prisma");
  const desiredConfigIds = getAvailableModelConfigs().map((config) => config.id);

  const [modelConfigs, sessionsCount, knowledgeEntries] = await Promise.all([
    prisma.modelConfig.findMany({
      where: { id: { in: desiredConfigIds } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.chatSession.count(),
    prisma.knowledgeEntry.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  if (sessionsCount === 0) {
    const suggested = getDefaultModelConfig(
      getSuggestedSessionProvider(runtime.compatibleApiConfigured),
    );
    await prisma.chatSession.create({
      data: {
        title: STARTER_TITLE,
        modelConfigId: suggested.id,
        modelProvider: suggested.provider,
        modelId: suggested.modelId,
        temperature: suggested.temperature,
        maxOutputTokens: suggested.maxOutputTokens,
        systemPrompt: suggested.systemPrompt,
        messages: {
          create: {
            role: "ASSISTANT",
            content:
              "你的工作台已经准备好了。你可以先让我帮你设计功能、做代码评审，或者试试查询时间、天气、知识库这类 Agent 风格任务。",
            metadata: { seed: true },
          },
        },
      },
    });
  }

  const sessions = await prisma.chatSession.findMany({
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      agentSteps: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      modelProvider: session.modelProvider,
      modelId: session.modelId,
      temperature: session.temperature,
      maxOutputTokens: session.maxOutputTokens,
      systemPrompt: session.systemPrompt,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: session.messages.map(normalizeMessage),
      agentSteps: session.agentSteps.map(normalizeAgentStep),
    })),
    modelConfigs: modelConfigs.map((config) => ({
      id: config.id,
      provider: config.provider,
      name: config.name,
      modelId: config.modelId,
      isDefault: config.isDefault,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      systemPrompt: config.systemPrompt,
    })),
    runtime,
    knowledgeEntries: knowledgeEntries.map(normalizeKnowledgeEntry),
  };
}

export async function createPrismaSession(defaultConfig: ModelConfig) {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  const session = await prisma.chatSession.create({
    data: {
      title: "新会话",
      modelConfigId: defaultConfig.id,
      modelProvider: defaultConfig.provider,
      modelId: defaultConfig.modelId,
      temperature: defaultConfig.temperature,
      maxOutputTokens: defaultConfig.maxOutputTokens,
      systemPrompt: defaultConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    },
  });

  return normalizeDatabaseSession(session.id);
}

export async function getPrismaSession(sessionId: string) {
  return normalizeDatabaseSession(sessionId);
}

export async function savePrismaUserMessage(sessionId: string, content: string) {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  await prisma.message.create({
    data: {
      sessionId,
      role: "USER",
      content,
    },
  });

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { messages: { where: { role: "USER" }, select: { id: true } } },
  });

  if (session && session.messages.length === 1) {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: summarizeTitle(content) },
    });
  }

  return normalizeDatabaseSession(sessionId);
}

export async function findModelConfig(modelConfigId: string) {
  if (!prisma) {
    return null;
  }

  const config = await prisma.modelConfig.findUnique({
    where: { id: modelConfigId },
  });

  if (!config) {
    return null;
  }

  return {
    id: config.id,
    provider: config.provider,
    name: config.name,
    modelId: config.modelId,
    isDefault: config.isDefault,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    systemPrompt: config.systemPrompt,
  };
}

export async function updatePrismaSessionSettings(
  sessionId: string,
  patch: SessionSettingsPatch,
  appliedConfig?: ModelConfig | null,
) {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      modelConfigId: patch.modelConfigId,
      modelProvider: appliedConfig?.provider ?? patch.modelProvider,
      modelId: appliedConfig?.modelId ?? patch.modelId,
      temperature: appliedConfig?.temperature ?? patch.temperature,
      maxOutputTokens: appliedConfig?.maxOutputTokens ?? patch.maxOutputTokens,
      systemPrompt: appliedConfig?.systemPrompt ?? patch.systemPrompt,
    },
  });

  return normalizeDatabaseSession(sessionId);
}

export async function savePrismaAssistantTurn(
  sessionId: string,
  turn: PersistedAssistantTurn,
) {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  await prisma.$transaction(async (tx) => {
    for (const message of turn.messages) {
      await tx.message.create({
        data: {
          sessionId,
          role: message.role.toUpperCase() as
            | "SYSTEM"
            | "USER"
            | "ASSISTANT"
            | "TOOL",
          content: message.content,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
          toolCalls:
            (message.toolCalls ?? undefined) as Prisma.InputJsonValue | undefined,
          toolResults:
            (message.toolResults ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          metadata:
            (message.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }

    for (const step of turn.agentSteps) {
      await tx.agentStep.create({
        data: {
          sessionId,
          status: step.status.toUpperCase() as
            | "PENDING"
            | "RUNNING"
            | "COMPLETED"
            | "FAILED",
          kind: step.kind,
          label: step.label,
          payload: (step.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
  });

  return normalizeDatabaseSession(sessionId);
}

export async function searchPrismaKnowledgeBase(query: string) {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  const entries = await prisma.knowledgeEntry.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return rankKnowledgeEntries(entries, query);
}

export async function listPrismaKnowledgeEntries() {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  const entries = await prisma.knowledgeEntry.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return entries.map(normalizeKnowledgeEntry);
}

export async function createPrismaKnowledgeEntry(
  input: KnowledgeEntryInput,
): Promise<KnowledgeEntry> {
  if (!prisma) {
    throw new Error("Prisma client 不可用。");
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      title: input.title.trim(),
      content: input.content.trim(),
      tags: input.tags,
    },
  });

  return normalizeKnowledgeEntry(entry);
}
