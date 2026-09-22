import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { ensureCommunityTablesExist } from "./communities/init-db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath() {
  // In serverless platforms like Vercel/AWS Lambda, the root is read-only except /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = path.join("/tmp", "dev.db");
    
    // Candidate paths where Vercel file tracing might place dev.db
    const candidatePaths = [
      path.join(process.cwd(), "dev.db"),
      path.join(__dirname, "dev.db"),
      path.join(__dirname, "..", "dev.db"),
      path.join(__dirname, "..", "..", "dev.db"),
      path.join(__dirname, "..", "..", "..", "dev.db"),
      path.resolve("dev.db"),
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        try {
          const candidateStat = fs.statSync(candidate);
          const tmpExists = fs.existsSync(tmpDbPath);
          const tmpStat = tmpExists ? fs.statSync(tmpDbPath) : null;
          if (!tmpExists || (tmpStat && candidateStat.mtimeMs > tmpStat.mtimeMs)) {
            fs.copyFileSync(candidate, tmpDbPath);
          }
          break;
        } catch (e) {
          console.error(`Failed to sync candidate ${candidate} to /tmp:`, e);
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
  ensureCommunityTablesExist(resolvedPath);
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
