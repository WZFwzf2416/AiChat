import { NextResponse } from "next/server";

export function createApiErrorResponse(
  error: unknown,
  fallbackMessage: string,
  status: number,
) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status });
}
