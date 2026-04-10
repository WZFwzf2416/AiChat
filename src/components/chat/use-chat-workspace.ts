"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import {
  type SendingStage,
  getAssistantDiagnostics,
  inferSendingStage,
  isStreamingMessage,
  isVisibleMessage,
  parseSseEvent,
} from "@/components/chat/message-content";
import { buildTurnSummaries, createId } from "@/lib/utils";
import type {
  ChatBootstrapPayload,
  ChatMessage,
  ChatSession,
  KnowledgeEntryInput,
  ModelConfig,
} from "@/types/chat";

type ComposerState = {
  content: string;
};

type WorkspaceError = {
  message: string;
  canRetrySend: boolean;
  canReload: boolean;
};

const initialComposer: ComposerState = { content: "" };

export function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function useChatWorkspace() {
  const [bootstrap, setBootstrap] = useState<ChatBootstrapPayload | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [composer, setComposer] = useState(initialComposer);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendingStage, setSendingStage] = useState<SendingStage>(null);
  const [streamingStatusLabel, setStreamingStatusLabel] = useState<string | null>(
    null,
  );
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [visibleMessageCount, setVisibleMessageCount] = useState(18);
  const [lastFailedUserContent, setLastFailedUserContent] = useState<string | null>(
    null,
  );
  const [isSavingKnowledgeEntry, setIsSavingKnowledgeEntry] = useState(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  function setWorkspaceError(
    message: string,
    options?: { canRetrySend?: boolean; canReload?: boolean },
  ) {
    setError({
      message,
      canRetrySend: options?.canRetrySend ?? false,
      canReload: options?.canReload ?? true,
    });
  }

  function clearError() {
    setError(null);
  }

  const syncBootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    clearError();

    const response = await fetch("/api/chat/bootstrap", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? CHAT_COPY.syncBootstrapError);
    }

    startTransition(() => {
      setBootstrap(payload);
      setActiveSessionId((current) => current ?? payload.sessions[0]?.id ?? null);
    });
    setIsBootstrapping(false);
    return payload;
  }, []);

  async function syncSession(sessionId: string) {
    const response = await fetch(`/api/chat/sessions/${sessionId}`, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? CHAT_COPY.syncSessionError);
    }

    startTransition(() => {
      setBootstrap((current) => {
        if (!current) {
          return current;
        }

        const existingIndex = current.sessions.findIndex(
          (session) => session.id === payload.id,
        );

        if (existingIndex === -1) {
          return {
            ...current,
            sessions: [payload, ...current.sessions],
          };
        }

        const sessions = [...current.sessions];
        sessions[existingIndex] = payload;

        return {
          ...current,
          sessions,
        };
      });
    });
  }

  async function postMessageToSession(sessionId: string, content: string) {
    return fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  function removeOptimisticMessages(
    sessionId: string,
    optimisticUserId: string,
    optimisticAssistantId: string,
  ) {
    startTransition(() => {
      setBootstrap((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.map((session) =>
                session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.filter(
                        (message) =>
                          message.id !== optimisticUserId &&
                          message.id !== optimisticAssistantId,
                      ),
                    }
                  : session,
              ),
            }
          : current,
      );
    });
  }

  useEffect(() => {
    void syncBootstrap().catch((reason: unknown) => {
      setWorkspaceError(
        reason instanceof Error ? reason.message : CHAT_COPY.initError,
        { canReload: true },
      );
      setIsBootstrapping(false);
    });
  }, [syncBootstrap]);

  const deferredSessionId = useDeferredValue(activeSessionId);
  const runtime = bootstrap?.runtime ?? null;
  const modelConfigs = bootstrap?.modelConfigs ?? [];
  const knowledgeEntries = bootstrap?.knowledgeEntries ?? [];

  const filteredSessions = (bootstrap?.sessions ?? []).filter((session) => {
    const keyword = sessionFilter.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return (
      session.title.toLowerCase().includes(keyword) ||
      session.modelId.toLowerCase().includes(keyword) ||
      session.modelProvider.toLowerCase().includes(keyword)
    );
  });

  const activeSession =
    bootstrap?.sessions.find((session) => session.id === deferredSessionId) ??
    filteredSessions[0] ??
    bootstrap?.sessions[0] ??
    null;
  const visibleMessages = activeSession?.messages.filter(isVisibleMessage) ?? [];
  const displayedMessages = visibleMessages.slice(-visibleMessageCount);
  const hiddenMessageCount = Math.max(
    0,
    visibleMessages.length - displayedMessages.length,
  );
  const lastVisibleMessage = displayedMessages.at(-1) ?? null;
  const diagnostics = getAssistantDiagnostics(activeSession);
  const turnSummaries = buildTurnSummaries(activeSession);

  useEffect(() => {
    setVisibleMessageCount(18);
    scrollMessagesToBottom("auto");
  }, [activeSession?.id]);

  useEffect(() => {
    if (isNearBottom || isSending) {
      scrollMessagesToBottom(isSending ? "auto" : "smooth");
    }
  }, [displayedMessages.length, isNearBottom, isSending]);

  useEffect(() => {
    if (
      lastVisibleMessage?.role === "assistant" &&
      isStreamingMessage(lastVisibleMessage)
    ) {
      scrollMessagesToBottom("auto");
    }
  }, [lastVisibleMessage]);

  function scrollMessagesToBottom(behavior: ScrollBehavior = "smooth") {
    messageEndRef.current?.scrollIntoView({
      behavior,
      block: "end",
    });
  }

  function handleMessageScroll() {
    const viewport = messageViewportRef.current;
    if (!viewport) {
      return;
    }

    const remaining =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setIsNearBottom(remaining < 80);
  }

  async function createSession() {
    clearError();
    const response = await fetch("/api/chat/sessions", { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? CHAT_COPY.createSessionError);
    }

    startTransition(() => {
      setBootstrap((current) =>
        current
          ? {
              ...current,
              sessions: [payload, ...current.sessions],
            }
          : current,
      );
      setActiveSessionId(payload.id);
    });
  }

  async function saveSettings(
    session: ChatSession,
    patch: Partial<ModelConfig> & { modelConfigId?: string },
  ) {
    clearError();

    const response = await fetch(`/api/chat/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? CHAT_COPY.saveSessionError);
    }

    startTransition(() => {
      setBootstrap((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.map((item) =>
                item.id === payload.id ? payload : item,
              ),
            }
          : current,
      );
    });
  }

  async function sendUserContent(userContent: string) {
    if (!userContent.trim() || !activeSession) {
      return;
    }

    const optimisticTurnId = createId("turn");
    const optimisticUserId = createId("msg");
    const optimisticAssistantId = createId("msg");
    const optimisticUserMessage: ChatMessage = {
      id: optimisticUserId,
      role: "user",
      content: userContent,
      createdAt: new Date().toISOString(),
      metadata: {
        turnId: optimisticTurnId,
        visibility: "visible",
      },
    };

    setIsSending(true);
    setSendingStage(inferSendingStage(userContent));
    setStreamingStatusLabel(null);
    clearError();
    setLastFailedUserContent(null);
    setComposer(initialComposer);

    startTransition(() => {
      setBootstrap((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.map((session) =>
                session.id === activeSession.id
                  ? {
                      ...session,
                      title:
                        session.messages.filter(
                          (message) => message.role === "user",
                        ).length === 0
                          ? userContent.slice(0, 40)
                          : session.title,
                      updatedAt: new Date().toISOString(),
                      messages: [
                        ...session.messages,
                        optimisticUserMessage,
                        {
                          id: optimisticAssistantId,
                          role: "assistant",
                          content: "",
                          createdAt: new Date().toISOString(),
                          metadata: {
                            streaming: true,
                            visibility: "visible",
                            turnId: optimisticTurnId,
                          },
                        },
                      ],
                    }
                  : session,
              ),
            }
          : current,
      );
    });

    let targetSessionId = activeSession.id;

    try {
      let response = await postMessageToSession(targetSessionId, userContent);

      if (response.status === 404) {
        const refreshed = await syncBootstrap();
        const fallbackSessionId = refreshed.sessions[0]?.id;

        if (!fallbackSessionId) {
          throw new Error(CHAT_COPY.sessionRecoveryError);
        }

        targetSessionId = fallbackSessionId;
        response = await postMessageToSession(targetSessionId, userContent);
      }

      if (!response.ok || !response.body) {
        const payload = await response
          .json()
          .catch(() => ({ error: CHAT_COPY.sendMessageError }));
        throw new Error(payload.error ?? CHAT_COPY.sendMessageError);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let eventBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        eventBuffer += decoder.decode(value, { stream: true });
        const chunks = eventBuffer.split("\n\n");
        eventBuffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const streamEvent = parseSseEvent(chunk);
          if (!streamEvent) {
            continue;
          }

          if (streamEvent.type === "stage") {
            setSendingStage(streamEvent.stage);
            if (streamEvent.stage === "finalizing") {
              setStreamingStatusLabel(null);
            }
            continue;
          }

          if (streamEvent.type === "tool") {
            setSendingStage("tooling");
            setStreamingStatusLabel(streamEvent.label);
            continue;
          }

          if (streamEvent.type === "delta") {
            assistantText += streamEvent.text;
            startTransition(() => {
              setBootstrap((current) =>
                current
                  ? {
                      ...current,
                      sessions: current.sessions.map((session) =>
                        session.id === targetSessionId
                          ? {
                              ...session,
                              messages: session.messages.map((message) =>
                                message.id === optimisticAssistantId
                                  ? {
                                      ...message,
                                      content: assistantText,
                                      metadata: {
                                        streaming: true,
                                        visibility: "visible",
                                        turnId: optimisticTurnId,
                                      },
                                    }
                                  : message,
                              ),
                            }
                          : session,
                      ),
                    }
                  : current,
              );
            });
            continue;
          }

          if (streamEvent.type === "error") {
            throw new Error(streamEvent.message);
          }
        }
      }

      await syncSession(targetSessionId);
    } catch (reason: unknown) {
      removeOptimisticMessages(
        activeSession.id,
        optimisticUserId,
        optimisticAssistantId,
      );
      setLastFailedUserContent(userContent);
      setWorkspaceError(
        reason instanceof Error ? reason.message : CHAT_COPY.sendMessageError,
        {
          canRetrySend: true,
          canReload: true,
        },
      );
    } finally {
      setIsSending(false);
      setSendingStage(null);
      setStreamingStatusLabel(null);
    }
  }

  async function retryLastMessage() {
    if (!lastFailedUserContent || isSending) {
      return;
    }

    await sendUserContent(lastFailedUserContent);
  }

  async function reloadWorkspace() {
    setLastFailedUserContent(null);
    await syncBootstrap();
  }

  async function createKnowledgeEntry(input: KnowledgeEntryInput) {
    setIsSavingKnowledgeEntry(true);
    clearError();

    try {
      const response = await fetch("/api/chat/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? CHAT_COPY.knowledgeCreateError);
      }

      startTransition(() => {
        setBootstrap((current) =>
          current
            ? {
                ...current,
                knowledgeEntries: [payload, ...current.knowledgeEntries],
              }
            : current,
        );
      });
    } catch (reason: unknown) {
      setWorkspaceError(
        reason instanceof Error ? reason.message : CHAT_COPY.knowledgeCreateError,
        {
          canReload: false,
        },
      );
      throw reason;
    } finally {
      setIsSavingKnowledgeEntry(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendUserContent(composer.content.trim());
  }

  function selectSession(sessionId: string) {
    startTransition(() => setActiveSessionId(sessionId));
  }

  function showEarlierMessages() {
    setVisibleMessageCount((current) => current + 20);
  }

  function setComposerContent(value: string) {
    setComposer({ content: value });
  }

  function updateDraftSystemPrompt(value: string) {
    if (!activeSession) {
      return;
    }

    startTransition(() => {
      setBootstrap((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.map((session) =>
                session.id === activeSession.id
                  ? { ...session, systemPrompt: value }
                  : session,
              ),
            }
          : current,
      );
    });
  }

  async function persistSystemPrompt(value: string) {
    if (!activeSession) {
      return;
    }

    await saveSettings(activeSession, { systemPrompt: value });
  }

  async function updateModelConfig(modelConfigId: string) {
    if (!activeSession) {
      return;
    }

    await saveSettings(activeSession, { modelConfigId });
  }

  async function updateTemperature(value: number) {
    if (!activeSession) {
      return;
    }

    await saveSettings(activeSession, { temperature: value });
  }

  async function updateMaxTokens(value: number) {
    if (!activeSession) {
      return;
    }

    await saveSettings(activeSession, { maxOutputTokens: value });
  }

  return {
    activeSession,
    composerContent: composer.content,
    createSession,
    diagnostics,
    displayedMessages,
    error,
    filteredSessions,
    formatTimestamp,
    handleMessageScroll,
    hiddenMessageCount,
    isBootstrapping,
    isNearBottom,
    isSending,
    isSavingKnowledgeEntry,
    knowledgeEntries,
    messageEndRef,
    messageViewportRef,
    modelConfigs,
    createKnowledgeEntry,
    persistSystemPrompt,
    reloadWorkspace,
    retryLastMessage,
    runtime,
    scrollMessagesToBottom,
    selectSession,
    sendMessage,
    sendingStage,
    sessionFilter,
    setComposerContent,
    setError: setWorkspaceError,
    clearError,
    setSessionFilter,
    showEarlierMessages,
    streamingStatusLabel,
    turnSummaries,
    updateDraftSystemPrompt,
    updateMaxTokens,
    updateModelConfig,
    updateTemperature,
    visibleMessages,
  };
}
