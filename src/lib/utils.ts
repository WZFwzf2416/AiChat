import type { ChatMessage } from "@/types/chat";

export function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "新会话";
  }

  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

export function buildContextWindow(messages: ChatMessage[], maxMessages = 14) {
  const safeMaxMessages = Math.max(4, maxMessages);
  const trimmedMessages = messages.slice(
    Math.max(0, messages.length - safeMaxMessages),
  );

  return {
    messages: trimmedMessages,
    totalMessages: messages.length,
    includedMessages: trimmedMessages.length,
    trimmedCount: Math.max(0, messages.length - trimmedMessages.length),
    toolMessages: trimmedMessages.filter((message) => message.role === "tool")
      .length,
  };
}

export function chunkText(text: string, chunkSize = 36) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}
