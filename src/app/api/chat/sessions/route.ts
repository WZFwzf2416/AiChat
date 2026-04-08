import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/app/api/chat/route-utils";
import { createChatSession } from "@/lib/chat-service";

export async function POST() {
  try {
    const session = await createChatSession();
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error, "创建会话失败。", 500);
  }
}
