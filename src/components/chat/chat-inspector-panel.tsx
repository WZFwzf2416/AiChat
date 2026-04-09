"use client";

import { useState } from "react";

import { CHAT_COPY, getProviderDisplayLabel } from "@/components/chat/chat-copy";
import type { AssistantDiagnostics } from "@/components/chat/message-content";
import type { ChatSession, KnowledgeEntry, KnowledgeEntryInput } from "@/types/chat";

type ChatInspectorPanelProps = {
  activeSession: ChatSession | null;
  diagnostics: AssistantDiagnostics | null;
  knowledgeEntries: KnowledgeEntry[];
  isSavingKnowledgeEntry: boolean;
  onCreateKnowledgeEntry: (input: KnowledgeEntryInput) => Promise<void>;
  onSystemPromptChange: (value: string) => void;
  onSystemPromptBlur: (value: string) => void;
  formatTimestamp: (value: string) => string;
};

export function ChatInspectorPanel({
  activeSession,
  diagnostics,
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

  async function handleCreateKnowledgeEntry() {
    const title = knowledgeTitle.trim();
    const content = knowledgeContent.trim();
    const tags = knowledgeTags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (title.length < 2 || content.length < 10) {
      setKnowledgeError("请至少填写 2 个字的标题和 10 个字的内容。");
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
        error instanceof Error ? error.message : "新增知识条目失败。",
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
                  ，{CHAT_COPY.diagnosticsCompletionTokens}：
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
          真实知识库
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          这里录入的内容会进入当前应用的知识库，并被知识库工具实时检索。
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={knowledgeTitle}
            onChange={(event) => setKnowledgeTitle(event.target.value)}
            placeholder="条目标题"
            className="w-full rounded-[18px] border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none"
          />
          <textarea
            value={knowledgeContent}
            onChange={(event) => setKnowledgeContent(event.target.value)}
            placeholder="条目内容"
            className="min-h-28 w-full rounded-[18px] border border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 outline-none"
          />
          <input
            value={knowledgeTags}
            onChange={(event) => setKnowledgeTags(event.target.value)}
            placeholder="标签，使用逗号分隔"
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
            {isSavingKnowledgeEntry ? "正在保存..." : "新增知识条目"}
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
                  标签：{entry.tags.join("、")}
                </p>
              ) : null}
            </div>
          ))}
          {knowledgeEntries.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
              还没有录入知识条目。你可以先在这里新增一条，然后再让助手搜索知识库。
            </p>
          ) : null}
        </div>
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
                {step.status} · {formatTimestamp(step.createdAt)}
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
