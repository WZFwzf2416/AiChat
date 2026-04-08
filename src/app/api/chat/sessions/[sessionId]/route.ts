import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiErrorResponse } from "@/app/api/chat/route-utils";
import { getChatSession, patchChatSession } from "@/lib/chat-service";

const patchSchema = z.object({
  modelConfigId: z.string().optional(),
  modelProvider: z.enum(["OPENAI", "MOCK"]).optional(),
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(256).max(4096).optional(),
  systemPrompt: z.string().max(4000).optional(),
});

export async function GET(
  _request: Request,
  context: RouteContext<"/api/chat/sessions/[sessionId]">,
) {
  try {
    const { sessionId } = await context.params;
    const session = await getChatSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "未找到对应会话。" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return createApiErrorResponse(error, "加载会话失败。", 400);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/chat/sessions/[sessionId]">,
) {
  try {
    const payload = patchSchema.parse(await request.json());
    const { sessionId } = await context.params;
    const session = await patchChatSession(sessionId, payload);

    if (!session) {
      return NextResponse.json({ error: "未找到对应会话。" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return createApiErrorResponse(error, "更新会话失败。", 400);
  }
}
