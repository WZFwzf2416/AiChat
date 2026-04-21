"use client";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import { cn } from "@/lib/utils";
import type {
  ChatMessage,
  ToolDisplayMetric,
  ToolResultRecord,
  ToolSourceRecord,
} from "@/types/chat";

function getToneClasses(
  tone: "info" | "success" | "warning" | "danger" | undefined,
) {
  switch (tone) {
    case "danger":
      return "border-rose-200 bg-rose-50/80";
    case "warning":
      return "border-amber-200 bg-amber-50/80";
    case "success":
      return "border-emerald-200 bg-emerald-50/80";
    case "info":
    default:
      return "border-black/5 bg-white/70";
  }
}

function MetricsGrid({ metrics }: { metrics: ToolDisplayMetric[] }) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="rounded-[16px] bg-white/80 px-3 py-3"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
            {metric.label}
          </p>
          <p className="mt-1 text-sm font-medium text-stone-900">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function SourceList({ sources }: { sources: ToolSourceRecord[] }) {
  return (
    <div className="mt-3 rounded-[16px] bg-white/80 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
        {CHAT_COPY.toolSourcesTitle}
      </p>
      <ul className="mt-2 space-y-3 text-sm leading-6 text-stone-700">
        {sources.map((source) => (
          <li key={`${source.title}-${source.id ?? source.href ?? "source"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-stone-900">{source.title}</span>
              {source.citationLabel ? (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
                  {source.citationLabel}
                </span>
              ) : null}
              {typeof source.confidence === "number" ? (
                <span className="text-[11px] text-stone-500">
                  置信度 {Math.round(source.confidence * 100)}%
                </span>
              ) : null}
            </div>

            {source.snippet ? (
              <p className="mt-1 text-sm leading-6 text-stone-600">
                {source.snippet}
              </p>
            ) : null}

            <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
              {source.sourceType ? <span>类型：{source.sourceType}</span> : null}
              {source.originTool ? <span>来源工具：{source.originTool}</span> : null}
              {source.updatedAt ? <span>更新时间：{source.updatedAt}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function getPrimaryToolResult(message: ChatMessage): ToolResultRecord | null {
  return message.toolResults?.[0] ?? null;
}

export function ToolResultCard({ result }: { result: ToolResultRecord }) {
  const display = result.display;

  if (!display) {
    return null;
  }

  const items = display.items ?? [];
  const metrics = display.metrics ?? [];
  const rows = display.rows ?? [];

  return (
    <div
      className={cn(
        "mt-3 rounded-[20px] border px-4 py-4 text-sm text-stone-700",
        getToneClasses(display.tone),
      )}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
        {CHAT_COPY.toolStructuredSummary}
      </p>
      <p className="mt-2 text-base font-semibold text-stone-900">
        {display.title ?? CHAT_COPY.toolDisplayFallback}
      </p>

      {display.body ? (
        <p className="mt-2 text-sm leading-7 text-stone-700">{display.body}</p>
      ) : null}

      <MetricsGrid metrics={metrics} />

      {items.length > 0 ? (
        <div className="mt-3 rounded-[16px] bg-white/80 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
            {CHAT_COPY.toolResultItems}
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-[16px] bg-white/80">
          <table className="min-w-full text-left text-sm text-stone-700">
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`row-${index}`}
                  className="border-b border-black/5 last:border-b-0"
                >
                  {Object.entries(row).map(([key, value]) => (
                    <td key={key} className="px-3 py-2 align-top">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                        {key}
                      </div>
                      <div className="mt-1">{value}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result.sources?.length ? <SourceList sources={result.sources} /> : null}
    </div>
  );
}

export function ToolResultCollection({ message }: { message: ChatMessage }) {
  if (!message.toolResults?.length) {
    return null;
  }

  return (
    <>
      {message.toolResults.map((result) => (
        <ToolResultCard
          key={`${result.toolCallId}-${result.toolName}-${result.summary ?? result.result}`}
          result={result}
        />
      ))}
    </>
  );
}
