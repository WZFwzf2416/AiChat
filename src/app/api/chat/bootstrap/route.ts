import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/app/api/chat/route-utils";
import { getBootstrapData } from "@/lib/chat-service";

export async function GET() {
  try {
    const data = await getBootstrapData();
    return NextResponse.json(data);
  } catch (error) {
    return createApiErrorResponse(error, "加载聊天初始化数据失败。", 500);
  }
}
