import { z } from "zod";

import { createApiErrorResponse } from "@/app/api/chat/route-utils";
import { handleChatTurn } from "@/lib/chat-service";

const messageSchema = z.object({
  content: z.string().trim().min(1).max(12000),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/chat/sessions/[sessionId]/messages">,
) {
  try {
    const { sessionId } = await context.params;
    const payload = messageSchema.parse(await request.json());
    const result = await handleChatTurn(sessionId, payload.content);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const sendEvent = (event: string, data: Record<string, unknown>) =>
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = result.stream.getReader();
        let hasSentFinalizing = false;

        try {
          controller.enqueue(
            sendEvent("stage", {
              type: "stage",
              stage: result.initialStage,
              traceId: result.traceId,
            }),
          );

          for (const event of result.preludeEvents) {
            controller.enqueue(sendEvent(event.type, event));
          }

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }

            if (!hasSentFinalizing) {
              controller.enqueue(
                sendEvent("stage", {
                  type: "stage",
                  stage: "finalizing",
                  traceId: result.traceId,
                }),
              );
              hasSentFinalizing = true;
            }

            controller.enqueue(
              sendEvent("delta", {
                type: "delta",
                text: decoder.decode(value),
              }),
            );
          }

          await result.finalize();
          controller.enqueue(
            sendEvent("complete", {
              type: "complete",
              traceId: result.traceId,
            }),
          );
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "处理聊天请求失败。";
          controller.enqueue(
            sendEvent("error", {
              type: "error",
              message,
              traceId: result.traceId,
            }),
          );
          controller.close();
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Agent-Trace-Id": result.traceId,
      },
    });
  } catch (error) {
    return createApiErrorResponse(error, "处理聊天请求失败。", 400);
  }
}
