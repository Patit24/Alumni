import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const rawPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
  const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);

  const adapter = new PrismaBetterSqlite3({ url: resolvedPath });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
