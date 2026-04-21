"use client";

import { useMemo, useState } from "react";

import { CHAT_COPY, getProviderDisplayLabel } from "@/components/chat/chat-copy";
import type { AssistantDiagnostics } from "@/components/chat/message-content";
import { getPrimaryToolResult } from "@/components/chat/tool-result-card";
import { DEFAULT_AGENT_RUNTIME_POLICY } from "@/lib/ai/runtime/shared";
import { cn, getMessageTurnId, getMessageVisibility } from "@/lib/utils";
import type {
  AgentStep,
  ChatSession,
  ChatTurnSummary,
  KnowledgeEntry,
  KnowledgeEntryInput,
  ToolSourceRecord,
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

function formatVisibilityLabel(value: string) {
  switch (value) {
    case "debug":
      return CHAT_COPY.debugVisibilityDebug;
    case "internal":
      return CHAT_COPY.debugVisibilityInternal;
    case "visible":
    default:
      return CHAT_COPY.debugVisibilityVisible;
  }
}

function summarizeStepPayload(step: AgentStep) {
  const payload = step.payload ?? {};

  if (step.kind === "planning") {
    const toolNames = Array.isArray(payload.toolNames)
      ? payload.toolNames.join("、")
      : null;

    return [
      typeof payload.planningIteration === "number"
        ? `第 ${payload.planningIteration + 1} 轮`
        : null,
      typeof payload.toolCalls === "number"
        ? `计划工具 ${payload.toolCalls}`
        : null,
      toolNames ? `工具：${toolNames}` : null,
      typeof payload.truncatedToolCalls === "boolean" && payload.truncatedToolCalls
        ? "工具调用已截断"
        : null,
      typeof payload.fallbackReason === "string"
        ? `兜底：${payload.fallbackReason}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (step.kind === "tool") {
    return [
      typeof payload.toolName === "string" ? `工具：${payload.toolName}` : null,
      typeof payload.toolSource === "string" ? `来源：${payload.toolSource}` : null,
      typeof payload.toolRiskLevel === "string"
        ? `风险：${payload.toolRiskLevel}`
        : null,
      typeof payload.attempts === "number"
        ? `尝试 ${payload.attempts}/${payload.maxAttempts ?? payload.attempts}`
        : null,
      typeof payload.durationMs === "number"
        ? `耗时 ${payload.durationMs} ms`
        : null,
      typeof payload.resultCount === "number" ? `命中 ${payload.resultCount}` : null,
      typeof payload.lastErrorMessage === "string"
        ? `错误：${payload.lastErrorMessage}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (step.kind === "finalize") {
    const usage =
      payload.usage && typeof payload.usage === "object"
        ? (payload.usage as Record<string, unknown>)
        : null;
    const citationLabels = Array.isArray(payload.citationLabels)
      ? payload.citationLabels.join("、")
      : null;

    return [
      typeof payload.finishReason === "string"
        ? `finish：${payload.finishReason}`
        : null,
      typeof usage?.total_tokens === "number"
        ? `tokens：${usage.total_tokens}`
        : null,
      citationLabels ? `引用：${citationLabels}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-[20px] bg-stone-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</p>
      <p className="mt-2 font-medium text-stone-900">{value}</p>
      {description ? (
        <p className="mt-1 text-xs leading-6 text-stone-500">{description}</p>
      ) : null}
    </div>
  );
}

function CitationList({
  sources,
  emptyText,
}: {
  sources: ToolSourceRecord[];
  emptyText: string;
}) {
  if (sources.length === 0) {
    return (
      <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <div
          key={`${source.title}-${source.id ?? source.href ?? source.citationLabel ?? "source"}`}
          className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-stone-900">{source.title}</p>
            {source.citationLabel ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
                {source.citationLabel}
              </span>
            ) : null}
          </div>
          {source.snippet ? (
            <p className="mt-2 text-sm leading-7 text-stone-600">{source.snippet}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
            {source.sourceType ? <span>类型：{source.sourceType}</span> : null}
            {source.originTool ? <span>来源工具：{source.originTool}</span> : null}
            {typeof source.confidence === "number" ? (
              <span>置信度：{Math.round(source.confidence * 100)}%</span>
            ) : null}
            {source.updatedAt ? <span>更新时间：{source.updatedAt}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
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
  const latestAssistantMessage = useMemo(() => {
    if (!activeSession || !latestTurn) {
      return null;
    }

    return [...activeSession.messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          getMessageTurnId(message) === latestTurn.id &&
          getMessageVisibility(message.metadata) === "visible",
      );
  }, [activeSession, latestTurn]);

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

  const latestToolResults = useMemo(() => {
    if (!activeSession || !latestTurn) {
      return [];
    }

    return activeSession.messages
      .filter(
        (message) =>
          message.role === "tool" &&
          getMessageTurnId(message) === latestTurn.id &&
          getMessageVisibility(message.metadata) === "visible",
      )
      .map((message) => ({
        messageId: message.id,
        toolName: message.toolName ?? "unknown",
        result: getPrimaryToolResult(message),
      }))
      .filter(
        (
          item,
        ): item is {
          messageId: string;
          toolName: string;
          result: NonNullable<typeof item.result>;
        } => Boolean(item.result),
      );
  }, [activeSession, latestTurn]);

  const citedSources =
    diagnostics?.citedSources ??
    (Array.isArray(latestAssistantMessage?.metadata?.citedSources)
      ? latestAssistantMessage.metadata.citedSources
      : []);
  const citationLabels =
    diagnostics?.citationLabels ??
    (Array.isArray(latestAssistantMessage?.metadata?.citationLabels)
      ? latestAssistantMessage.metadata.citationLabels
      : []);
  const runtimePolicy = diagnostics?.runtimePolicy ?? DEFAULT_AGENT_RUNTIME_POLICY;

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
          <MetricCard
            title={CHAT_COPY.runtimePolicySteps}
            value={String(runtimePolicy.maxPlanningIterations)}
          />
          <MetricCard
            title={CHAT_COPY.runtimePolicyToolLimit}
            value={String(runtimePolicy.maxToolCallsPerIteration)}
          />
          <MetricCard
            title={CHAT_COPY.runtimePolicyTimeout}
            value={`${runtimePolicy.toolExecutionTimeoutMs} ms`}
          />
          <MetricCard
            title={CHAT_COPY.runtimePolicyRetry}
            value={String(runtimePolicy.toolRetryLimit)}
            description={`${CHAT_COPY.runtimePolicyFallback}：${
              runtimePolicy.heuristicFallbackEnabled
                ? CHAT_COPY.runtimePolicyFallbackOn
                : CHAT_COPY.runtimePolicyFallbackOff
            }`}
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
          {CHAT_COPY.diagnosticsTitle}
        </p>
        {diagnostics ? (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MetricCard
              title={CHAT_COPY.diagnosticsProvider}
              value={getProviderDisplayLabel(diagnostics.provider, diagnostics.model)}
            />
            <MetricCard title={CHAT_COPY.diagnosticsModel} value={diagnostics.model} />
            <MetricCard
              title={CHAT_COPY.diagnosticsDuration}
              value={
                diagnostics.durationMs !== null
                  ? `${diagnostics.durationMs} ms`
                  : CHAT_COPY.diagnosticsUnavailable
              }
            />
            <MetricCard
              title={CHAT_COPY.diagnosticsFinishReason}
              value={diagnostics.finishReason ?? CHAT_COPY.diagnosticsUnavailable}
            />
            <MetricCard
              title={CHAT_COPY.diagnosticsTotalTokens}
              value={
                diagnostics.totalTokens !== null
                  ? String(diagnostics.totalTokens)
                  : CHAT_COPY.diagnosticsUnavailable
              }
              description={
                diagnostics.promptTokens !== null ||
                diagnostics.completionTokens !== null
                  ? `${CHAT_COPY.diagnosticsPromptTokens} ${
                      diagnostics.promptTokens ?? "-"
                    } / ${CHAT_COPY.diagnosticsCompletionTokens} ${
                      diagnostics.completionTokens ?? "-"
                    }`
                  : undefined
              }
            />
            <MetricCard
              title={CHAT_COPY.diagnosticsTraceId}
              value={diagnostics.traceId ?? CHAT_COPY.traceUnavailable}
            />
            <MetricCard
              title={CHAT_COPY.diagnosticsToolAttempts}
              value={
                diagnostics.toolAttemptCount !== null
                  ? String(diagnostics.toolAttemptCount)
                  : CHAT_COPY.diagnosticsUnavailable
              }
              description={
                diagnostics.latestToolName
                  ? `最近工具：${diagnostics.latestToolName}`
                  : undefined
              }
            />
            <MetricCard
              title={CHAT_COPY.diagnosticsToolLatency}
              value={
                diagnostics.maxToolDurationMs !== null
                  ? `${diagnostics.maxToolDurationMs} ms`
                  : CHAT_COPY.diagnosticsUnavailable
              }
            />
            <div className="col-span-2 rounded-[20px] bg-stone-50 px-4 py-3 text-stone-600">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {CHAT_COPY.diagnosticsContext}
              </p>
              <p className="mt-2 leading-7">
                当前纳入 {diagnostics.includedMessages ?? 0} /{" "}
                {diagnostics.totalMessages ?? 0} 条消息，其中工具消息{" "}
                {diagnostics.toolMessages ?? 0} 条，裁剪 {diagnostics.trimmedCount ?? 0} 条。
              </p>
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
          {CHAT_COPY.diagnosticsCitations}
        </p>
        {citationLabels.length > 0 ? (
          <p className="mt-4 text-xs leading-6 text-stone-500">
            {citationLabels.join("、")}
          </p>
        ) : null}
        <div className="mt-4">
          <CitationList
            sources={citedSources}
            emptyText={CHAT_COPY.citedSourcesEmpty}
          />
        </div>
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
                    {index === 0 ? CHAT_COPY.latestTurnLabel : formatTimestamp(turn.createdAt)}
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
          {(activeSession?.agentSteps ?? []).slice(-10).reverse().map((step) => {
            const payloadSummary = summarizeStepPayload(step);

            return (
              <div
                key={step.id}
                className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{step.label}</p>
                    {payloadSummary ? (
                      <p className="mt-1 text-xs leading-6 text-stone-500">{payloadSummary}</p>
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
          {CHAT_COPY.toolStructuredSummary}
        </p>
        <div className="mt-4 space-y-3">
          {latestToolResults.map(({ messageId, toolName, result }) => (
            <div
              key={messageId}
              className="rounded-[20px] border border-black/5 bg-stone-50 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{toolName}</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {result.summary ?? result.result}
                  </p>
                </div>
                {result.display?.layout ? (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                    {result.display.layout}
                  </span>
                ) : null}
              </div>
              {result.sources?.length ? (
                <div className="mt-2 text-xs leading-6 text-stone-500">
                  来源：{result.sources.map((source) => source.title).join("、")}
                </div>
              ) : null}
            </div>
          ))}
          {latestToolResults.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              {CHAT_COPY.toolDisplayFallback}
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
                {message.role} {CHAT_COPY.stepSeparator}{" "}
                {formatVisibilityLabel(getMessageVisibility(message.metadata))}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-700">{message.content}</p>
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
          {knowledgeError ? <p className="text-sm text-rose-600">{knowledgeError}</p> : null}
          <button
            type="button"
            onClick={() => {
              void handleCreateKnowledgeEntry();
            }}
            disabled={isSavingKnowledgeEntry}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isSavingKnowledgeEntry ? CHAT_COPY.knowledgeSaving : CHAT_COPY.knowledgeCreate}
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
