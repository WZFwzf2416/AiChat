"use client";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatInspectorPanel } from "@/components/chat/chat-inspector-panel";
import { ChatMessageThread } from "@/components/chat/chat-message-thread";
import { ChatSessionHeader } from "@/components/chat/chat-session-header";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useChatWorkspace } from "@/components/chat/use-chat-workspace";

export function ChatShell() {
  const {
    activeSession,
    composerContent,
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
    setError,
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
  } = useChatWorkspace();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,_#f7f4ec_0%,_#f3efe6_50%,_#ece6db_100%)] px-6">
        <div className="w-full max-w-md rounded-[28px] border border-black/5 bg-white/80 p-8 shadow-[0_24px_80px_rgba(58,36,10,0.08)] backdrop-blur">
          <p className="text-sm uppercase tracking-[0.28em] text-amber-700">
            {CHAT_COPY.bootingEyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-stone-900">
            {CHAT_COPY.bootingTitle}
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {CHAT_COPY.bootingDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.12),_transparent_20%),linear-gradient(180deg,_#f8f5ef_0%,_#f0ebe2_55%,_#ebe4da_100%)] text-stone-900 lg:h-[100dvh] lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden lg:px-6">
        <ChatSidebar
          runtime={runtime}
          sessionFilter={sessionFilter}
          filteredSessions={filteredSessions}
          activeSessionId={activeSession?.id ?? null}
          onCreateSession={() =>
            createSession().catch((reason: unknown) =>
              setError(
                reason instanceof Error
                  ? reason.message
                  : CHAT_COPY.createSessionError,
              ),
            )
          }
          onFilterChange={setSessionFilter}
          onSelectSession={selectSession}
          formatTimestamp={formatTimestamp}
        />

        <main className="flex min-h-[80vh] flex-1 flex-col rounded-[32px] border border-black/5 bg-white/80 shadow-[0_30px_90px_rgba(58,36,10,0.08)] backdrop-blur lg:h-full lg:min-h-0 lg:overflow-hidden">
          <ChatSessionHeader
            activeSession={activeSession}
            modelConfigs={modelConfigs}
            onModelConfigChange={(modelConfigId) => {
              void updateModelConfig(modelConfigId).catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : CHAT_COPY.saveModelConfigError,
                ),
              );
            }}
            onTemperatureChange={(value) => {
              void updateTemperature(value).catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : CHAT_COPY.saveTemperatureError,
                ),
              );
            }}
            onMaxTokensChange={(value) => {
              void updateMaxTokens(value).catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : CHAT_COPY.saveMaxTokensError,
                ),
              );
            }}
          />

          <div className="min-h-0 flex-1 px-6 py-5">
            {error ? (
              <div className="mb-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p>{error.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {error.canRetrySend ? (
                    <button
                      type="button"
                      onClick={() => {
                        void retryLastMessage();
                      }}
                      className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                    >
                      重试发送
                    </button>
                  ) : null}
                  {error.canReload ? (
                    <button
                      type="button"
                      onClick={() => {
                        void reloadWorkspace().catch((reason: unknown) =>
                          setError(
                            reason instanceof Error
                              ? reason.message
                              : CHAT_COPY.syncBootstrapError,
                          ),
                        );
                      }}
                      className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-50"
                    >
                      重新加载
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearError}
                    className="rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    关闭提示
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <ChatMessageThread
                visibleCount={visibleMessages.length}
                hiddenMessageCount={hiddenMessageCount}
                displayedMessages={displayedMessages}
                sendingStage={sendingStage}
                streamingStatusLabel={streamingStatusLabel}
                isNearBottom={isNearBottom}
                onShowEarlierMessages={showEarlierMessages}
                onScroll={handleMessageScroll}
                onBackToBottom={() => scrollMessagesToBottom()}
                viewportRef={messageViewportRef}
                endRef={messageEndRef}
                formatTimestamp={formatTimestamp}
              />

              <ChatInspectorPanel
                activeSession={activeSession}
                diagnostics={diagnostics}
                turnSummaries={turnSummaries}
                knowledgeEntries={knowledgeEntries}
                isSavingKnowledgeEntry={isSavingKnowledgeEntry}
                onCreateKnowledgeEntry={(input) => createKnowledgeEntry(input)}
                onSystemPromptChange={updateDraftSystemPrompt}
                onSystemPromptBlur={(value) => {
                  void persistSystemPrompt(value).catch((reason: unknown) =>
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : CHAT_COPY.saveSystemPromptError,
                    ),
                  );
                }}
                formatTimestamp={formatTimestamp}
              />
            </div>
          </div>

          <ChatComposer
            content={composerContent}
            isSending={isSending}
            sendingStage={sendingStage}
            disabled={isSending || !activeSession}
            onChange={setComposerContent}
            onSubmit={sendMessage}
          />
        </main>
      </div>
    </div>
  );
}
