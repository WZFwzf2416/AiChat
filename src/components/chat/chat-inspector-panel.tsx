"use client";

import { CHAT_COPY, getProviderDisplayLabel } from "@/components/chat/chat-copy";
import type { AssistantDiagnostics } from "@/components/chat/message-content";
import type { ChatSession } from "@/types/chat";

type ChatInspectorPanelProps = {
  activeSession: ChatSession | null;
  diagnostics: AssistantDiagnostics | null;
  onSystemPromptChange: (value: string) => void;
  onSystemPromptBlur: (value: string) => void;
  formatTimestamp: (value: string) => string;
};

export function ChatInspectorPanel({
  activeSession,
  diagnostics,
  onSystemPromptChange,
  onSystemPromptBlur,
  formatTimestamp,
}: ChatInspectorPanelProps) {
  return (
    <aside className="min-w-0 space-y-4 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1">
      <div className="rounded-[28px] border border-black/5 bg-stone-950 p-5 text-stone-100">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-300">
          {CHAT_COPY.systemPrompt}
        </p>
        <textarea
          value={activeSession?.systemPrompt ?? ""}
          onChange={(event) => onSystemPromptChange(event.target.value)}
          onBlur={(event) => onSystemPromptBlur(event.target.value)}
          className="mt-4 min-h-40 w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-stone-100 outline-none"
        />
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
          {CHAT_COPY.diagnosticsTitle}
        </p>
        {diagnostics ? (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-[20px] bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsProvider}
              </p>
              <p className="mt-2 font-medium text-stone-900">
                {getProviderDisplayLabel(diagnostics.provider, diagnostics.model)}
              </p>
            </div>
            <div className="rounded-[20px] bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsModel}
              </p>
              <p className="mt-2 font-medium text-stone-900">
                {diagnostics.model}
              </p>
            </div>
            <div className="rounded-[20px] bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsDuration}
              </p>
              <p className="mt-2 font-medium text-stone-900">
                {diagnostics.durationMs !== null
                  ? `${diagnostics.durationMs} ms`
                  : CHAT_COPY.diagnosticsUnavailable}
              </p>
            </div>
            <div className="rounded-[20px] bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsFinishReason}
              </p>
              <p className="mt-2 font-medium text-stone-900">
                {diagnostics.finishReason ?? CHAT_COPY.diagnosticsUnavailable}
              </p>
            </div>
            <div className="rounded-[20px] bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsTotalTokens}
              </p>
              <p className="mt-2 font-medium text-stone-900">
                {diagnostics.totalTokens ?? CHAT_COPY.diagnosticsUnavailable}
              </p>
            </div>
            <div className="rounded-[20px] bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsTrimmedCount}
              </p>
              <p className="mt-2 font-medium text-stone-900">
                {diagnostics.trimmedCount ?? 0}
              </p>
            </div>
            <div className="col-span-2 rounded-[20px] bg-stone-50 px-4 py-3 text-stone-600">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsContext}
              </p>
              <p className="mt-2 leading-7">
                当前纳入 {diagnostics.includedMessages ?? 0} /{" "}
                {diagnostics.totalMessages ?? 0} 条消息，其中工具消息{" "}
                {diagnostics.toolMessages ?? 0} 条。
              </p>
              {diagnostics.promptTokens !== null ||
              diagnostics.completionTokens !== null ? (
                <p className="mt-2 leading-7">
                  {CHAT_COPY.diagnosticsPromptTokens}：
                  {diagnostics.promptTokens ?? "-"}，{CHAT_COPY.diagnosticsCompletionTokens}：
                  {diagnostics.completionTokens ?? "-"}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
            {CHAT_COPY.diagnosticsEmpty}
          </p>
        )}
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
          {CHAT_COPY.agentTrail}
        </p>
        <div className="mt-4 space-y-3">
          {(activeSession?.agentSteps ?? []).slice(-6).map((step) => (
            <div
              key={step.id}
              className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
            >
              <p className="text-sm font-medium text-stone-900">{step.label}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                {step.status} {CHAT_COPY.stepSeparator}{" "}
                {formatTimestamp(step.createdAt)}
              </p>
            </div>
          ))}
          {(activeSession?.agentSteps.length ?? 0) === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              {CHAT_COPY.agentTrailEmpty}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
