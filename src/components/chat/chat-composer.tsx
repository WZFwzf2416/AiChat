"use client";

import { useRef } from "react";

import { CHAT_COPY } from "@/components/chat/chat-copy";
import type { SendingStage } from "@/components/chat/message-content";
import { getSendingStageLabel } from "@/components/chat/message-content";

type ChatComposerProps = {
  content: string;
  isSending: boolean;
  sendingStage: SendingStage;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
};

export function ChatComposer({
  content,
  isSending,
  sendingStage,
  disabled,
  onChange,
  onSubmit,
}: ChatComposerProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <div className="border-t border-black/5 bg-white/85 px-6 py-5 backdrop-blur">
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <textarea
          value={content}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          placeholder={CHAT_COPY.composerPlaceholder}
          className="min-h-28 w-full rounded-[28px] border border-black/10 bg-stone-50 px-5 py-4 text-sm leading-7 outline-none transition focus:border-stone-400 focus:bg-white"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-7 text-stone-600">
            {CHAT_COPY.composerHint}
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isSending
              ? getSendingStageLabel(sendingStage)
              : CHAT_COPY.sendMessage}
          </button>
        </div>
      </form>
    </div>
  );
}
