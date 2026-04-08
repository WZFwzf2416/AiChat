"use client";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import type { ChatSession, ModelConfig } from "@/types/chat";

type ChatSessionHeaderProps = {
  activeSession: ChatSession | null;
  modelConfigs: ModelConfig[];
  onModelConfigChange: (modelConfigId: string) => void;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
};

export function ChatSessionHeader({
  activeSession,
  modelConfigs,
  onModelConfigChange,
  onTemperatureChange,
  onMaxTokensChange,
}: ChatSessionHeaderProps) {
  const selectedModelConfigId =
    activeSession
      ? modelConfigs.find(
          (config) =>
            config.provider === activeSession.modelProvider &&
            config.modelId === activeSession.modelId &&
            config.temperature === activeSession.temperature,
        )?.id ?? ""
      : "";

  return (
    <div className="border-b border-black/5 px-6 py-5">
      <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
        {CHAT_COPY.currentSession}
      </p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">
            {activeSession?.title ?? CHAT_COPY.noActiveSession}
          </h2>
          <p className="mt-2 text-sm leading-7 text-stone-600">
            {CHAT_COPY.workspaceDescription}
          </p>
        </div>
        {activeSession ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-500">
                {CHAT_COPY.modelPreset}
              </span>
              <select
                value={selectedModelConfigId}
                onChange={(event) => {
                  const modelConfigId = event.target.value;
                  if (!modelConfigId) {
                    return;
                  }

                  onModelConfigChange(modelConfigId);
                }}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              >
                {modelConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-500">
                {CHAT_COPY.temperature}
              </span>
              <input
                value={activeSession.temperature}
                min={0}
                max={2}
                step={0.1}
                type="number"
                onChange={(event) =>
                  onTemperatureChange(Number(event.target.value))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-500">
                {CHAT_COPY.maxTokens}
              </span>
              <input
                value={activeSession.maxOutputTokens}
                min={256}
                max={4096}
                step={64}
                type="number"
                onChange={(event) =>
                  onMaxTokensChange(Number(event.target.value))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
