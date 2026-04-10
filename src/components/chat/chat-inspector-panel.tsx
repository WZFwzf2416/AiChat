"use client";

import { useMemo, useState } from "react";

import { CHAT_COPY, getProviderDisplayLabel } from "@/components/chat/chat-copy";
import type { AssistantDiagnostics } from "@/components/chat/message-content";
import { DEFAULT_AGENT_RUNTIME_POLICY } from "@/lib/ai/runtime/shared";
import { cn, getMessageTurnId, getMessageVisibility } from "@/lib/utils";
import type {
  AgentStep,
  ChatSession,
  ChatTurnSummary,
  KnowledgeEntry,
  KnowledgeEntryInput,
} from "@/types/chat";

type ChatInspectorPanelProps = {
  activeSession: ChatSession | null;
  diagnostics: AssistantDiagnostics | null;
  turnSummaries: ChatTurnSummary[];
  knowledgeEntries: KnowledgeEntry[];
  isSavingKnowledgeEntry: boolean;
  onCreateKnowledgeEntry: (input: KnowledgeEntryInput) => Promise<void>;
  onSystemPromptChange: (value: string) => void;
  onSystemPromptBlur: (value: string) => void;
  formatTimestamp: (value: string) => string;
};

function getTurnStatusLabel(status: ChatTurnSummary["status"]) {
  switch (status) {
    case "streaming":
      return CHAT_COPY.turnStatusStreaming;
    case "failed":
      return CHAT_COPY.turnStatusFailed;
    case "completed":
    default:
      return CHAT_COPY.turnStatusCompleted;
  }
}

function getTurnStatusClasses(status: ChatTurnSummary["status"]) {
  switch (status) {
    case "streaming":
      return "bg-sky-100 text-sky-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "completed":
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

function getStepKindLabel(kind: string) {
  switch (kind) {
    case "planning":
      return CHAT_COPY.agentPlanning;
    case "tool":
      return CHAT_COPY.agentTool;
    case "finalize":
      return CHAT_COPY.agentFinalize;
    default:
      return kind;
  }
}

function getStepKindClasses(kind: string) {
  switch (kind) {
    case "planning":
      return "bg-sky-100 text-sky-700";
    case "tool":
      return "bg-amber-100 text-amber-700";
    case "finalize":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-stone-100 text-stone-700";
  }
}

function summarizeStepPayload(step: AgentStep) {
  const payload = step.payload ?? {};

  if (step.kind === "planning") {
    const toolNames = Array.isArray(payload.toolNames)
      ? payload.toolNames.join("、")
      : null;
    const maxToolSteps =
      typeof payload.maxToolSteps === "number" ? payload.maxToolSteps : null;
    const heuristic = payload.heuristicFallbackEnabled;

    return [
      typeof payload.planningIteration === "number"
        ? `第 ${payload.planningIteration + 1} 轮规划`
        : null,
      typeof payload.toolCalls === "number"
        ? `计划工具数 ${payload.toolCalls}`
        : null,
      toolNames ? `工具 ${toolNames}` : null,
      maxToolSteps ? `上限 ${maxToolSteps}` : null,
      typeof heuristic === "boolean"
        ? `兜底 ${heuristic ? "开启" : "关闭"}`
        : null,
    ]
      .filter(Boolean)
      .join(" 路 ");
  }

  if (step.kind === "tool") {
    return [
      typeof payload.toolName === "string" ? payload.toolName : null,
      payload.source ? `来源 ${String(payload.source)}` : null,
      typeof payload.resultCount === "number"
        ? `命中 ${payload.resultCount}`
        : null,
      payload.liveData ? "实时数据" : null,
      typeof payload.errorMessage === "string" ? payload.errorMessage : null,
    ]
      .filter(Boolean)
      .join(" 路 ");
  }

  if (step.kind === "finalize") {
    return [
      typeof payload.finishReason === "string"
        ? `finish ${payload.finishReason}`
        : null,
      payload.usage &&
      typeof payload.usage === "object" &&
      "total_tokens" in payload.usage
        ? `tokens ${String(payload.usage.total_tokens)}`
        : null,
    ]
      .filter(Boolean)
      .join(" 路 ");
  }

  return "";
}

export function ChatInspectorPanel({
  activeSession,
  diagnostics,
  turnSummaries,
  knowledgeEntries,
  isSavingKnowledgeEntry,
  onCreateKnowledgeEntry,
  onSystemPromptChange,
  onSystemPromptBlur,
  formatTimestamp,
}: ChatInspectorPanelProps) {
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeTags, setKnowledgeTags] = useState("");
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const latestTurn = turnSummaries.at(-1) ?? null;
  const latestDebugMessages = useMemo(() => {
    if (!activeSession || !latestTurn) {
      return [];
    }

    return activeSession.messages.filter(
      (message) =>
        getMessageTurnId(message) === latestTurn.id &&
        getMessageVisibility(message.metadata) !== "visible",
    );
  }, [activeSession, latestTurn]);

  async function handleCreateKnowledgeEntry() {
    const title = knowledgeTitle.trim();
    const content = knowledgeContent.trim();
    const tags = knowledgeTags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (title.length < 2 || content.length < 10) {
      setKnowledgeError(CHAT_COPY.knowledgeValidationError);
      return;
    }

    setKnowledgeError(null);
    try {
      await onCreateKnowledgeEntry({ title, content, tags });
      setKnowledgeTitle("");
      setKnowledgeContent("");
      setKnowledgeTags("");
    } catch (error) {
      setKnowledgeError(
        error instanceof Error ? error.message : CHAT_COPY.knowledgeCreateError,
      );
    }
  }

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
          {CHAT_COPY.runtimePolicyTitle}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[20px] bg-stone-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              {CHAT_COPY.runtimePolicySteps}
            </p>
            <p className="mt-2 font-medium text-stone-900">
              {DEFAULT_AGENT_RUNTIME_POLICY.maxToolSteps}
            </p>
          </div>
          <div className="rounded-[20px] bg-stone-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              {CHAT_COPY.runtimePolicyFallback}
            </p>
            <p className="mt-2 font-medium text-stone-900">
              {DEFAULT_AGENT_RUNTIME_POLICY.heuristicFallbackEnabled
                ? CHAT_COPY.runtimePolicyFallbackOn
                : CHAT_COPY.runtimePolicyFallbackOff}
            </p>
          </div>
        </div>
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
                  {CHAT_COPY.diagnosticsPromptTokens}：{diagnostics.promptTokens ?? "-"}
                  {"，"}
                  {CHAT_COPY.diagnosticsCompletionTokens}：
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
          {CHAT_COPY.turnTimeline}
        </p>
        <div className="mt-4 space-y-3">
          {turnSummaries.slice(-6).reverse().map((turn, index) => (
            <div
              key={turn.id}
              className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {index === 0
                      ? CHAT_COPY.latestTurnLabel
                      : formatTimestamp(turn.createdAt)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {turn.userContentPreview || "这一轮没有用户消息摘要。"}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    getTurnStatusClasses(turn.status),
                  )}
                >
                  {getTurnStatusLabel(turn.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                <span>{CHAT_COPY.turnVisibleCount} {turn.visibleMessageCount}</span>
                <span>{CHAT_COPY.turnDebugCount} {turn.debugMessageCount}</span>
                <span>{CHAT_COPY.turnToolCount} {turn.toolCount}</span>
                <span>{CHAT_COPY.turnStepCount} {turn.stepCount}</span>
              </div>
              {turn.toolNames.length > 0 ? (
                <p className="mt-2 text-xs leading-6 text-stone-500">
                  {turn.toolNames.join("、")}
                </p>
              ) : null}
              {turn.errorMessage ? (
                <p className="mt-2 rounded-[16px] bg-rose-50 px-3 py-2 text-xs leading-6 text-rose-700">
                  {turn.errorMessage}
                </p>
              ) : null}
            </div>
          ))}
          {turnSummaries.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              {CHAT_COPY.turnTimelineEmpty}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
          {CHAT_COPY.agentTrail}
        </p>
        <div className="mt-4 space-y-3">
          {(activeSession?.agentSteps ?? []).slice(-8).reverse().map((step) => {
            const payloadSummary = summarizeStepPayload(step);

            return (
              <div
                key={step.id}
                className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {step.label}
                    </p>
                    {payloadSummary ? (
                      <p className="mt-1 text-xs leading-6 text-stone-500">
                        {payloadSummary}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      getStepKindClasses(step.kind),
                    )}
                  >
                    {getStepKindLabel(step.kind)}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                  {step.status} {CHAT_COPY.stepSeparator} {formatTimestamp(step.createdAt)}
                </p>
              </div>
            );
          })}
          {(activeSession?.agentSteps.length ?? 0) === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              {CHAT_COPY.agentTrailEmpty}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
          {CHAT_COPY.debugMessagesTitle}
        </p>
        <div className="mt-4 space-y-3">
          {latestDebugMessages.map((message) => (
            <div
              key={message.id}
              className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {message.role} {CHAT_COPY.stepSeparator} {getMessageVisibility(message.metadata)}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-700">
                {message.content}
              </p>
            </div>
          ))}
          {latestDebugMessages.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              {CHAT_COPY.debugMessagesEmpty}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
          {CHAT_COPY.inspectorKnowledgeTitle}
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          {CHAT_COPY.inspectorKnowledgeDescription}
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={knowledgeTitle}
            onChange={(event) => setKnowledgeTitle(event.target.value)}
            placeholder={CHAT_COPY.knowledgeTitlePlaceholder}
            className="w-full rounded-[18px] border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none"
          />
          <textarea
            value={knowledgeContent}
            onChange={(event) => setKnowledgeContent(event.target.value)}
            placeholder={CHAT_COPY.knowledgeContentPlaceholder}
            className="min-h-28 w-full rounded-[18px] border border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 outline-none"
          />
          <input
            value={knowledgeTags}
            onChange={(event) => setKnowledgeTags(event.target.value)}
            placeholder={CHAT_COPY.knowledgeTagsPlaceholder}
            className="w-full rounded-[18px] border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none"
          />
          {knowledgeError ? (
            <p className="text-sm text-rose-600">{knowledgeError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleCreateKnowledgeEntry();
            }}
            disabled={isSavingKnowledgeEntry}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isSavingKnowledgeEntry
              ? CHAT_COPY.knowledgeSaving
              : CHAT_COPY.knowledgeCreate}
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {knowledgeEntries.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-stone-900">{entry.title}</p>
                <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-stone-500">
                  {formatTimestamp(entry.updatedAt)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-7 text-stone-600">
                {entry.content}
              </p>
              {entry.tags.length > 0 ? (
                <p className="mt-2 text-xs text-stone-500">
                  {CHAT_COPY.tagsLabel}：{entry.tags.join("、")}
                </p>
              ) : null}
            </div>
          ))}
          {knowledgeEntries.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              {CHAT_COPY.knowledgeEmpty}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
