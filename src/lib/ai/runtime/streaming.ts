import OpenAI from "openai";

import {
  buildBaseMetadata,
  collectCitedSources,
  extractAssistantText,
  getPolicySnapshot,
  type AgentRuntimePolicy,
  type CompletedTurn,
  type GenerateTurnInput,
  type PersistedTurnMessage,
} from "@/lib/ai/runtime/shared";
import { chunkText } from "@/lib/utils";
import type { AgentStep } from "@/types/chat";

function createFinalizingStep(params: {
  input: GenerateTurnInput;
  finishReason: string | null;
  usage: Record<string, unknown> | null;
  policy: AgentRuntimePolicy;
  citationLabels: string[];
}) {
  return {
    id: `finalize_${params.input.turnId}`,
    status: "completed",
    kind: "finalize",
    label: "Agent 已完成最终答案整理。",
    payload: {
      turnId: params.input.turnId,
      traceId: params.input.traceId,
      finishReason: params.finishReason,
      usage: params.usage,
      citationLabels: params.citationLabels,
      policy: getPolicySnapshot(params.policy),
    },
    createdAt: new Date().toISOString(),
  } satisfies AgentStep;
}

export function createBufferedTextStream(text: string) {
  const encoder = new TextEncoder();
  const chunks = chunkText(text, 8);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [index, chunk] of chunks.entries()) {
        controller.enqueue(encoder.encode(chunk));
        if (index < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      controller.close();
    },
  });
}

export async function streamAssistantCompletion(params: {
  client: OpenAI;
  targetLabel: string;
  input: GenerateTurnInput;
  startedAt: number;
  policy: AgentRuntimePolicy;
  messages: Array<Record<string, unknown>>;
  persistedMessages: PersistedTurnMessage[];
  agentSteps: AgentStep[];
}) {
  const {
    client,
    targetLabel,
    input,
    startedAt,
    policy,
    messages,
    persistedMessages,
    agentSteps,
  } = params;

  const completionStream = await client.chat.completions.create({
    model: input.modelId,
    temperature: input.temperature,
    max_completion_tokens: input.maxOutputTokens,
    messages: messages as never,
    stream: true,
    stream_options: { include_usage: true },
  });

  const encoder = new TextEncoder();
  let resolveCompletion!: (value: CompletedTurn) => void;
  let rejectCompletion!: (reason?: unknown) => void;

  const completion = new Promise<CompletedTurn>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      let finishReason: string | null = null;
      let usage: Record<string, unknown> | null = null;

      try {
        for await (const chunk of completionStream) {
          const choice = chunk.choices[0];
          const delta = choice?.delta;
          const textDelta = extractAssistantText(delta?.content);

          if (textDelta) {
            assistantText += textDelta;
            controller.enqueue(encoder.encode(textDelta));
          }

          if (choice?.finish_reason) {
            finishReason = choice.finish_reason;
          }

          if (chunk.usage) {
            usage = chunk.usage as unknown as Record<string, unknown>;
          }
        }

        const safeAssistantText =
          assistantText.trim() || "本轮执行完成，但没有可展示的文本结果。";
        const citedSources = collectCitedSources(persistedMessages);
        const citationLabels = citedSources
          .map((source) => source.citationLabel)
          .filter((label): label is string => Boolean(label));
        const metadata = {
          ...buildBaseMetadata(input, Date.now() - startedAt),
          provider: targetLabel,
          finishReason,
          usage,
          runtimePolicy: getPolicySnapshot(policy),
          citedSources,
          citationLabels,
          visibility: "visible" as const,
        };

        resolveCompletion({
          assistantText: safeAssistantText,
          persistedMessages: [
            ...persistedMessages,
            {
              role: "assistant",
              content: safeAssistantText,
              metadata,
            },
          ],
          agentSteps: [
            ...agentSteps,
            createFinalizingStep({
              input,
              finishReason,
              usage,
              policy,
              citationLabels,
            }),
          ],
          metadata,
        });
        controller.close();
      } catch (error) {
        rejectCompletion(error);
        controller.error(error);
      }
    },
    cancel(reason) {
      rejectCompletion(reason);
    },
  });

  return { stream, completion };
}
