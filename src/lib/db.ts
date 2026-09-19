import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath() {
  // In serverless platforms like Vercel/AWS Lambda, the root is read-only except /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = path.join("/tmp", "dev.db");
    // If bundled dev.db exists in project root, copy it to /tmp on cold-start
    const bundledDbPath = path.join(process.cwd(), "dev.db");
    if (!fs.existsSync(tmpDbPath)) {
      if (fs.existsSync(bundledDbPath)) {
        try {
          fs.copyFileSync(bundledDbPath, tmpDbPath);
        } catch (e) {
          console.error("Failed to copy bundled dev.db to /tmp:", e);
        }
      }
    }
    return tmpDbPath;
  }

  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const rawPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
  return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
}

function createPrismaClient() {
  const resolvedPath = getDatabasePath();
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
