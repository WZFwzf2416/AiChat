import { NextResponse } from "next/server";

import { hasDatabaseUrl, prisma } from "@/lib/db";

export async function GET() {
  const payload = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {
      app: "ok",
      database: "ok",
    },
  };

  if (!hasDatabaseUrl || !prisma) {
    return NextResponse.json(
      {
        ...payload,
        status: "degraded",
        checks: {
          ...payload.checks,
          database: "missing_database_url",
        },
      },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ...payload,
        status: "degraded",
        checks: {
          ...payload.checks,
          database: "unreachable",
        },
        error: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 503 },
    );
  }
}
