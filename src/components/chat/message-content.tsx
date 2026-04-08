"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSession } from "@/types/chat";

export type SendingStage = "thinking" | "tooling" | "finalizing" | null;

export type ChatStreamEvent =
  | { type: "stage"; stage: Exclude<SendingStage, null> }
  | { type: "delta"; text: string }
  | { type: "complete" }
  | { type: "error"; message: string }
  | {
      type: "tool";
      phase: "start" | "result";
      toolName: string;
      label: string;
      summary?: string;
    };

export type AssistantDiagnostics = {
  provider: string;
  model: string;
  durationMs: number | null;
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  totalMessages: number | null;
  includedMessages: number | null;
  trimmedCount: number | null;
  toolMessages: number | null;
};

function readNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function getAssistantDiagnostics(
  session: ChatSession | null,
): AssistantDiagnostics | null {
  if (!session) {
    return null;
  }

  const latestAssistant = [...session.messages]
    .reverse()
    .find(
      (message) => message.role === "assistant" && !message.metadata?.hidden,
    );

  const metadata = latestAssistant?.metadata;
  if (!metadata) {
    return null;
  }

  const usage =
    typeof metadata.usage === "object" && metadata.usage
      ? (metadata.usage as Record<string, unknown>)
      : null;
  const context =
    typeof metadata.context === "object" && metadata.context
      ? (metadata.context as Record<string, unknown>)
      : null;

  return {
    provider: readString(metadata.provider) ?? session.modelProvider,
    model: readString(metadata.model) ?? session.modelId,
    durationMs: readNumber(metadata.durationMs),
    finishReason: readString(metadata.finishReason),
    promptTokens: usage ? readNumber(usage.prompt_tokens) : null,
    completionTokens: usage ? readNumber(usage.completion_tokens) : null,
    totalTokens: usage ? readNumber(usage.total_tokens) : null,
    totalMessages: context ? readNumber(context.totalMessages) : null,
    includedMessages: context ? readNumber(context.includedMessages) : null,
    trimmedCount: context ? readNumber(context.trimmedCount) : null,
    toolMessages: context ? readNumber(context.toolMessages) : null,
  };
}

export function toolSummary(message: ChatMessage) {
  if (!message.toolResults?.length) {
    return null;
  }

  return message.toolResults.map((item) => item.result).join("\n");
}

export function shouldShowToolDetails(message: ChatMessage) {
  const summary = toolSummary(message);
  if (!summary) {
    return false;
  }

  return summary.trim() !== message.content.trim();
}

export function getToolBadgeLabel(toolName: string | null | undefined) {
  switch (toolName) {
    case "get_current_time":
      return "时间工具";
    case "get_weather_snapshot":
      return "天气工具";
    case "search_knowledge_base":
      return "知识库工具";
    default:
      return "工具结果";
  }
}

export function getToolBadgeClasses(toolName: string | null | undefined) {
  switch (toolName) {
    case "get_current_time":
      return "bg-sky-100 text-sky-700";
    case "get_weather_snapshot":
      return "bg-emerald-100 text-emerald-700";
    case "search_knowledge_base":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export function isStreamingMessage(message: ChatMessage) {
  return message.metadata?.streaming === true;
}

export function inferSendingStage(content: string): Exclude<SendingStage, null> {
  const normalized = content.toLowerCase();

  if (
    normalized.includes("天气") ||
    normalized.includes("weather") ||
    normalized.includes("时间") ||
    normalized.includes("time") ||
    normalized.includes("知识库") ||
    normalized.includes("knowledge")
  ) {
    return "tooling";
  }

  return "thinking";
}

export function getSendingStageLabel(stage: SendingStage) {
  switch (stage) {
    case "tooling":
      return CHAT_COPY.stageTooling;
    case "finalizing":
      return CHAT_COPY.stageFinalizing;
    case "thinking":
    default:
      return CHAT_COPY.stageThinking;
  }
}

export function parseSseEvent(rawEvent: string): ChatStreamEvent | null {
  const lines = rawEvent
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (eventName === "message" || dataLines.length === 0) {
    return null;
  }

  try {
    const payload = JSON.parse(dataLines.join("\n")) as ChatStreamEvent;
    return payload.type === eventName ? payload : null;
  } catch {
    return null;
  }
}

function renderMessageContent(
  message: ChatMessage,
  sendingStage: SendingStage,
  streamingStatusLabel?: string | null,
) {
  if (isStreamingMessage(message) && !message.content.trim()) {
    return streamingStatusLabel || getSendingStageLabel(sendingStage);
  }

  if (isStreamingMessage(message)) {
    return `${message.content}▍`;
  }

  return message.content || "...";
}

function getCodeLanguageLabel(className?: string) {
  const matched = className?.match(/language-([\w+-]+)/i)?.[1];
  return matched?.replace(/[^a-z0-9#+.-]/gi, "").toUpperCase() || "CODE";
}

function MarkdownBody({ content }: { content: string }) {
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  async function handleCopyCode(blockId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBlockId(blockId);
      window.setTimeout(
        () =>
          setCopiedBlockId((current) => (current === blockId ? null : current)),
        1200,
      );
    } catch {
      setCopiedBlockId(null);
    }
  }

  return (
    <div className="prose prose-stone max-w-none text-[15px] leading-7 prose-p:my-4 prose-headings:tracking-tight prose-headings:text-stone-900 prose-h1:text-xl prose-h2:text-lg prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-[0.24em] prose-code:rounded prose-code:bg-stone-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.92em] prose-code:text-stone-800 prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-2 prose-blockquote:border-amber-300 prose-blockquote:bg-amber-50/60 prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:font-normal prose-blockquote:text-stone-700 prose-hr:my-6 prose-hr:border-stone-200 prose-li:my-1 prose-table:my-5 prose-table:w-full prose-table:overflow-hidden prose-table:rounded-2xl prose-table:border prose-table:border-black/5 prose-thead:bg-stone-100 prose-th:border-b prose-th:border-black/5 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-td:px-4 prose-td:py-3 prose-td:align-top prose-td:text-stone-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, node, ...props }) {
            const inline = !className;
            const codeContent = String(children).replace(/\n$/, "");

            if (inline) {
              return (
                <code
                  className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.92em] text-stone-800"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const blockId =
              typeof node?.position?.start.offset === "number"
                ? `code-${node.position.start.offset}`
                : `code-${codeContent.length}`;

            return (
              <div className="my-5 overflow-hidden rounded-[22px] border border-black/5 bg-stone-950 text-stone-100 shadow-[0_16px_40px_rgba(28,25,23,0.18)]">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] uppercase tracking-[0.24em] text-stone-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-stone-200">
                    {getCodeLanguageLabel(className)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode(blockId, codeContent)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] text-stone-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                  >
                    {copiedBlockId === blockId ? "已复制" : "复制代码"}
                  </button>
                </div>
                <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6">
                  <code className={cn("font-mono", className)} {...props}>
                    {codeContent}
                  </code>
                </pre>
              </div>
            );
          },
          table({ children }) {
            return (
              <div className="my-5 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(28,25,23,0.04)]">
                <table className="min-w-full border-collapse text-left text-[13px] leading-6">
                  {children}
                </table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ReadableMessageBody({
  message,
  sendingStage,
  streamingStatusLabel,
}: {
  message: ChatMessage;
  sendingStage: SendingStage;
  streamingStatusLabel?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isStreaming = isStreamingMessage(message);
  const baseContent = renderMessageContent(
    message,
    sendingStage,
    streamingStatusLabel,
  );
  const shouldCollapse =
    !isStreaming && message.role !== "tool" && baseContent.length > 900;
  const visibleContent =
    shouldCollapse && !expanded
      ? `${baseContent.slice(0, 900).trimEnd()}\n\n...`
      : baseContent;

  return (
    <div
      className={cn("mt-3 text-sm leading-7", isStreaming && "text-stone-600")}
    >
      <div className={cn(message.role !== "tool" && "max-w-[72ch]")}>
        <MarkdownBody content={visibleContent} />
      </div>

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          {expanded ? "收起内容" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
}

export function isVisibleMessage(message: ChatMessage) {
  if (message.metadata?.hidden) {
    return false;
  }

  if (message.role === "assistant") {
    const trimmedContent = message.content.trim();
    const hiddenAssistantMessages = new Set([
      "正在规划工具调用...",
      "正在检索知识库内容...",
      "正在查询当前时间...",
      "正在获取实时天气...",
    ]);

    if (hiddenAssistantMessages.has(trimmedContent)) {
      return false;
    }
  }

  return true;
}
