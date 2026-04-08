import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const adapter =
  hasDatabaseUrl && process.env.DATABASE_URL
    ? new PrismaPg({ connectionString: process.env.DATABASE_URL })
    : null;

export const prisma =
  hasDatabaseUrl && adapter
    ? globalThis.prismaGlobal ??
      new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    : null;

if (prisma && process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
