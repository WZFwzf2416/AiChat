import { generateAssistantTurn } from "@/lib/ai/providers";
import {
  createSession,
  getChatBootstrap,
  getSession,
  saveAssistantTurn,
  saveUserMessage,
  updateSessionSettings,
} from "@/lib/repositories/chat-repository";
import { buildContextWindow } from "@/lib/utils";
import type { SessionSettingsPatch } from "@/types/chat";

export async function getBootstrapData() {
  return getChatBootstrap();
}

export async function createChatSession() {
  return createSession();
}

export async function getChatSession(sessionId: string) {
  return getSession(sessionId);
}

export async function patchChatSession(
  sessionId: string,
  patch: SessionSettingsPatch,
) {
  return updateSessionSettings(sessionId, patch);
}

export async function handleChatTurn(sessionId: string, content: string) {
  const updatedSession = await saveUserMessage(sessionId, content);

  if (!updatedSession) {
    throw new Error("未找到对应会话。");
  }

  const latestSession = await getSession(sessionId);
  if (!latestSession) {
    throw new Error("会话在生成回复前丢失了。");
  }

  const contextWindow = buildContextWindow(latestSession.messages);
  const turn = await generateAssistantTurn({
    modelProvider: latestSession.modelProvider,
    modelId: latestSession.modelId,
    systemPrompt: latestSession.systemPrompt,
    temperature: latestSession.temperature,
    maxOutputTokens: latestSession.maxOutputTokens,
    messages: contextWindow.messages,
    context: {
      totalMessages: contextWindow.totalMessages,
      includedMessages: contextWindow.includedMessages,
      trimmedCount: contextWindow.trimmedCount,
      toolMessages: contextWindow.toolMessages,
    },
  });

  return {
    stream: turn.stream,
    initialStage: turn.initialStage,
    preludeEvents: turn.preludeEvents ?? [],
    finalize: async () => {
      const completedTurn = await turn.completion;

      await saveAssistantTurn(sessionId, {
        messages: completedTurn.persistedMessages,
        agentSteps: completedTurn.agentSteps,
      });

      return completedTurn.metadata;
    },
  };
}
