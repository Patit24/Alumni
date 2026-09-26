import fs from "fs";
import path from "path";

export interface OAuthResult {
  ready: boolean;
  token?: string;
  mode?: "login" | "google-onboard";
  email?: string;
  name?: string;
  avatar?: string;
  signupToken?: string;
  error?: string;
  expiresAt: number;
}

// In-memory cache on the current process
const globalOAuthStore = globalThis as unknown as {
  __oauthSessions?: Map<string, OAuthResult>;
};

if (!globalOAuthStore.__oauthSessions) {
  globalOAuthStore.__oauthSessions = new Map<string, OAuthResult>();
}

const memoryStore = globalOAuthStore.__oauthSessions;
const TMP_FILE = path.join("/tmp", "alumni_oauth_sessions.json");

function readDiskCache(): Record<string, OAuthResult> {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

function writeDiskCache(data: Record<string, OAuthResult>) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data), "utf-8");
  } catch {}
}

export function saveOAuthResult(sessionId: string, result: Omit<OAuthResult, "expiresAt"> & { expiresAt?: number }) {
  if (!sessionId) return;
  const now = Date.now();
  const entry: OAuthResult = {
    ...result,
    expiresAt: result.expiresAt || now + 10 * 60 * 1000, // 10 minutes TTL
  };

  memoryStore.set(sessionId, entry);

  try {
    const disk = readDiskCache();
    // Prune expired
    for (const [k, v] of Object.entries(disk)) {
      if (v.expiresAt < now) delete disk[k];
    }
    disk[sessionId] = entry;
    writeDiskCache(disk);
  } catch {}
}

export function getOAuthResult(sessionId: string): OAuthResult | null {
  if (!sessionId) return null;
  const now = Date.now();

  // 1. Try memory
  const mem = memoryStore.get(sessionId);
  if (mem) {
    if (mem.expiresAt > now) {
      return mem;
    } else {
      memoryStore.delete(sessionId);
    }
  }

  // 2. Try disk cache
  try {
    const disk = readDiskCache();
    const diskEntry = disk[sessionId];
    if (diskEntry && diskEntry.expiresAt > now) {
      memoryStore.set(sessionId, diskEntry);
      return diskEntry;
    }
  } catch {}

  return null;
}
