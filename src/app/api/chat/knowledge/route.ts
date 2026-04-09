import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiErrorResponse } from "@/app/api/chat/route-utils";
import { addKnowledgeEntry, getKnowledgeEntries } from "@/lib/chat-service";

const knowledgeEntrySchema = z.object({
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(10).max(12000),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
});

export async function GET() {
  try {
    const entries = await getKnowledgeEntries();
    return NextResponse.json(entries);
  } catch (error) {
    return createApiErrorResponse(error, "加载知识库失败。", 500);
  }
}

export async function POST(request: Request) {
  try {
    const payload = knowledgeEntrySchema.parse(await request.json());
    const entry = await addKnowledgeEntry(payload);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error, "新增知识条目失败。", 400);
  }
}
