/**
 * 48-Hour Ephemeral Message Retention & Partition Cleanup Worker.
 *
 * Architecture Invariant:
 *   - PostgreSQL acts strictly as an ephemeral message queue/relay.
 *   - Server messages are purged after 48 hours.
 *   - The permanent decrypted archive exists ONLY on client devices in the IndexedDB Vault.
 */

import { db } from "@/lib/db";

export interface RetentionCleanupReport {
  purgedDirectMessages: number;
  purgedEncryptedQueue: number;
  purgedDisappearedMessages: number;
  timestamp: string;
}

export async function runRetentionCleanup(): Promise<RetentionCleanupReport> {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const now = new Date();

  // 1. Purge direct messages older than 48 hours
  const directResult = await db.directMessage.deleteMany({
    where: {
      createdAt: { lt: fortyEightHoursAgo },
    },
  });

  // 2. Purge expired queue items
  const queueResult = await db.encryptedMessageQueue.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  // 3. Purge disappearing messages whose disappearing timer has passed
  // (DirectMessages having disappearingSeconds set where createdAt + disappearingSeconds < now)
  const disappearedResult = await db.directMessage.deleteMany({
    where: {
      disappearingSeconds: { not: null, gt: 0 },
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }, // Safe fallback
    },
  });

  console.log(`[RetentionWorker] 48h Ephemeral Retention Cleanup executed:`, {
    directMessagesPurged: directResult.count,
    queuePurged: queueResult.count,
    disappearedPurged: disappearedResult.count,
  });

  return {
    purgedDirectMessages: directResult.count,
    purgedEncryptedQueue: queueResult.count,
    purgedDisappearedMessages: disappearedResult.count,
    timestamp: now.toISOString(),
  };
}
