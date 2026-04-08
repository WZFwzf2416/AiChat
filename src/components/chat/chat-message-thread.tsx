"use client";

import type { RefObject, UIEventHandler } from "react";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import {
  ReadableMessageBody,
  getToolBadgeClasses,
  getToolBadgeLabel,
  shouldShowToolDetails,
  toolSummary,
  type SendingStage,
} from "@/components/chat/message-content";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

type ChatMessageThreadProps = {
  visibleCount: number;
  hiddenMessageCount: number;
  displayedMessages: ChatMessage[];
  sendingStage: SendingStage;
  streamingStatusLabel?: string | null;
  isNearBottom: boolean;
  onShowEarlierMessages: () => void;
  onScroll: UIEventHandler<HTMLDivElement>;
  onBackToBottom: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  formatTimestamp: (value: string) => string;
};

function getRoleLabel(message: ChatMessage) {
  if (message.role === "tool") {
    return `工具 ${CHAT_COPY.stepSeparator} ${message.toolName ?? "未知工具"}`;
  }

  if (message.role === "user") {
    return "用户";
  }

  return "助手";
}

export function ChatMessageThread({
  visibleCount,
  hiddenMessageCount,
  displayedMessages,
  sendingStage,
  streamingStatusLabel,
  isNearBottom,
  onShowEarlierMessages,
  onScroll,
  onBackToBottom,
  viewportRef,
  endRef,
  formatTimestamp,
}: ChatMessageThreadProps) {
  return (
    <section className="relative flex min-h-[60vh] min-w-0 flex-col rounded-[28px] border border-black/5 bg-stone-50/80 p-4 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
          {CHAT_COPY.messagesTitle}
        </p>
        <p className="text-xs text-stone-500">{visibleCount} 条</p>
      </div>

      {hiddenMessageCount > 0 ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[18px] border border-dashed border-black/10 bg-white/70 px-3 py-2 text-xs text-stone-600">
          <span>
            {CHAT_COPY.hiddenMessagesPrefix} {hiddenMessageCount}{" "}
            {CHAT_COPY.hiddenMessagesSuffix}
          </span>
          <button
            type="button"
            onClick={onShowEarlierMessages}
            className="rounded-full bg-stone-900 px-3 py-1 font-medium text-white transition hover:bg-stone-700"
          >
            {CHAT_COPY.showEarlierMessages}
          </button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto pr-2"
      >
        {displayedMessages.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-white/60 px-6 text-center">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-stone-900">
                {CHAT_COPY.emptyMessagesTitle}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                {CHAT_COPY.emptyMessagesDescription}
              </p>
            </div>
          </div>
        ) : null}

        {displayedMessages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "min-w-0 overflow-x-auto rounded-[24px] px-4 py-4",
              message.role === "user" &&
                "ml-auto max-w-[85%] bg-stone-900 text-white",
              message.role === "assistant" &&
                "max-w-[90%] bg-white text-stone-900 shadow-sm",
              message.role === "tool" &&
                "max-w-[90%] border border-dashed border-amber-200 bg-amber-50 text-stone-700",
            )}
          >
            <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.2em]">
              <span>{getRoleLabel(message)}</span>
              <span
                className={
                  message.role === "user" ? "text-stone-300" : "text-stone-400"
                }
              >
                {formatTimestamp(message.createdAt)}
              </span>
            </div>

            {message.role === "tool" ? (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium",
                    getToolBadgeClasses(message.toolName),
                  )}
                >
                  {getToolBadgeLabel(message.toolName)}
                </span>
                <span className="text-stone-500">
                  {CHAT_COPY.toolResultDescription}
                </span>
              </div>
            ) : null}

            <ReadableMessageBody
              message={message}
              sendingStage={sendingStage}
              streamingStatusLabel={streamingStatusLabel}
            />

            {message.role === "tool" && shouldShowToolDetails(message) ? (
              <details className="mt-3 rounded-[18px] border border-black/5 bg-white/80 px-3 py-3 text-xs leading-6 text-stone-600">
                <summary className="cursor-pointer list-none font-medium text-stone-700">
                  {CHAT_COPY.viewToolRawResult}
                </summary>
                <div className="mt-2 border-t border-black/5 pt-2">
                  <ReadableMessageBody
                    message={{
                      ...message,
                      content: toolSummary(message) ?? "",
                    }}
                    sendingStage={null}
                    streamingStatusLabel={null}
                  />
                </div>
              </details>
            ) : null}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      {!isNearBottom ? (
        <button
          type="button"
          onClick={onBackToBottom}
          className="absolute bottom-4 right-4 rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white shadow-[0_12px_24px_rgba(28,25,23,0.2)] transition hover:bg-stone-700"
        >
          {CHAT_COPY.backToBottom}
        </button>
      ) : null}
    </section>
  );
}
