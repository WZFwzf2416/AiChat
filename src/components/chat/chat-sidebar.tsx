"use client";

import {
  CHAT_COPY,
  getProviderDisplayLabel,
  getRuntimeBackendLabel,
} from "@/components/chat/chat-copy";
import { cn } from "@/lib/utils";
import type { ChatSession, RuntimeStatus } from "@/types/chat";

type ChatSidebarProps = {
  runtime: RuntimeStatus | null;
  sessionFilter: string;
  filteredSessions: ChatSession[];
  activeSessionId: string | null;
  onCreateSession: () => void;
  onFilterChange: (value: string) => void;
  onSelectSession: (sessionId: string) => void;
  formatTimestamp: (value: string) => string;
};

function getRuntimeDescription(runtime: RuntimeStatus | null) {
  if (!runtime) {
    return CHAT_COPY.runtimeMock;
  }

  if (runtime.experienceMode === "demo") {
    return runtime.demoModeReason ?? CHAT_COPY.runtimeMock;
  }

  return `已配置兼容接口 API Key，当前优先走 ${getRuntimeBackendLabel(
    runtime.preferredBackend,
  )} 真实联调。`;
}

function getSessionMeta(session: ChatSession) {
  return `${getProviderDisplayLabel(session.modelProvider, session.modelId)} ${CHAT_COPY.sessionMetaSeparator} ${session.modelId}`;
}

export function ChatSidebar({
  runtime,
  sessionFilter,
  filteredSessions,
  activeSessionId,
  onCreateSession,
  onFilterChange,
  onSelectSession,
  formatTimestamp,
}: ChatSidebarProps) {
  return (
    <aside className="w-full rounded-[32px] border border-black/5 bg-white/75 p-5 shadow-[0_20px_80px_rgba(48,34,10,0.08)] backdrop-blur lg:flex lg:h-full lg:min-h-0 lg:w-[320px] lg:flex-col lg:overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
            {CHAT_COPY.appEyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-semibold">{CHAT_COPY.appTitle}</h1>
        </div>
        <button
          type="button"
          onClick={onCreateSession}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
        >
          {CHAT_COPY.newSession}
        </button>
      </div>

      <div className="mt-5 rounded-[24px] bg-stone-950 p-4 text-stone-100">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-300">
          {CHAT_COPY.runtimeTitle}
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          {runtime?.storageMode === "prisma"
            ? CHAT_COPY.runtimePrisma
            : CHAT_COPY.runtimeMemory}
        </p>
        <p className="mt-2 text-sm leading-7 text-stone-300">
          {runtime?.experienceMode === "real"
            ? CHAT_COPY.experienceModeReal
            : CHAT_COPY.experienceModeDemo}
        </p>
        <p className="mt-2 text-sm leading-7 text-stone-300">
          {getRuntimeDescription(runtime)}
        </p>
      </div>

      <div className="mt-5">
        <input
          value={sessionFilter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={CHAT_COPY.searchPlaceholder}
          className="w-full rounded-[22px] border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
        />
      </div>

      <div className="mt-5 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
        {filteredSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelectSession(session.id)}
            className={cn(
              "w-full rounded-[22px] border px-4 py-4 text-left transition",
              activeSessionId === session.id
                ? "border-stone-900 bg-stone-900 text-white shadow-[0_16px_40px_rgba(28,25,23,0.24)]"
                : "border-black/5 bg-stone-50/70 text-stone-800 hover:border-stone-300 hover:bg-white",
            )}
          >
            <p className="text-sm font-semibold">{session.title}</p>
            <p
              className={cn(
                "mt-2 text-xs",
                activeSessionId === session.id
                  ? "text-stone-300"
                  : "text-stone-500",
              )}
            >
              {getSessionMeta(session)}
            </p>
            <p className="mt-2 text-xs text-stone-400">
              {formatTimestamp(session.updatedAt)}
            </p>
          </button>
        ))}
        {filteredSessions.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-black/10 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-600">
            {CHAT_COPY.noSessionMatch}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
