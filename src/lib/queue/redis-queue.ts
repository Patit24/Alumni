/**
 * Redis Streams & Offline Queue Engine for Samparka.
 * Matches Target Architecture:
 *   - Client sends Ciphertext Only to Gateway.
 *   - Gateway pushes to Redis Streams (stream:inbox:{userId}).
 *   - Offline workers queue background push notifications.
 *   - Client uses cursor sync to pull deltas on reconnect.
 */

import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/push-service";

export interface StreamMessagePacket {
  id: string;
  clientMsgId?: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  encryptedPayload: string;
  messageType: string;
  createdAt: string;
}

// In-memory stream buffer for ultra-fast delta sync (last 500 packets per user)
const memoryStreamBuffers = new Map<string, StreamMessagePacket[]>();
const MAX_BUFFER_PER_USER = 500;

/**
 * Publishes an encrypted message packet to the recipient's Redis / in-memory stream.
 */
export async function publishToUserStream(
  recipientId: string,
  packet: StreamMessagePacket
): Promise<void> {
  // 1. Maintain in-memory stream buffer
  let userBuffer = memoryStreamBuffers.get(recipientId);
  if (!userBuffer) {
    userBuffer = [];
    memoryStreamBuffers.set(recipientId, userBuffer);
  }

  userBuffer.push(packet);
  if (userBuffer.length > MAX_BUFFER_PER_USER) {
    userBuffer.shift();
  }

  // 2. If Redis / Upstash is configured in environment, dispatch to Redis Stream
  const redisRestUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisRestUrl && redisRestToken) {
    try {
      await fetch(`${redisRestUrl}/xadd/stream:inbox:${recipientId}/*/payload/${encodeURIComponent(JSON.stringify(packet))}`, {
        headers: { Authorization: `Bearer ${redisRestToken}` },
      });
    } catch (err) {
      console.warn("[RedisQueue] Upstash XADD failed, using local stream buffer:", err);
    }
  }
}

/**
 * Enqueues an offline delivery job. If recipient is disconnected, dispatches Ghost Push.
 */
export async function enqueueOfflinePushJob(
  recipientId: string,
  conversationId: string,
  senderName: string
): Promise<void> {
  try {
    await sendPushToUser(recipientId, {
      type: "MESSAGE",
      conversationId,
      senderName,
      tag: `samparka-wakeup-${conversationId}`,
    });
  } catch (err) {
    console.error("[RedisQueue] Failed to enqueue offline push job:", err);
  }
}

/**
 * Cursor-based stream delta fetcher.
 * Retrieves all encrypted messages created after `cursor` timestamp.
 */
export async function fetchUserStreamDeltas(
  userId: string,
  cursor?: string | null,
  limit = 100
): Promise<{ items: StreamMessagePacket[]; nextCursor: string }> {
  const sinceDate = cursor ? new Date(cursor) : new Date(Date.now() - 48 * 60 * 60 * 1000);

  // 1. Check in-memory stream buffer first for recent packets
  const userBuffer = memoryStreamBuffers.get(userId) || [];
  const buffered = userBuffer.filter(
    (p) => new Date(p.createdAt).getTime() > sinceDate.getTime()
  );

  if (buffered.length >= limit) {
    const items = buffered.slice(0, limit);
    const nextCursor = items[items.length - 1].createdAt;
    return { items, nextCursor };
  }

  // 2. Query Authoritative PostgreSQL for encrypted messages since cursor
  const dbMessages = await db.directMessage.findMany({
    where: {
      recipientId: userId,
      createdAt: { gt: sinceDate },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      clientMsgId: true,
      conversationId: true,
      senderId: true,
      recipientId: true,
      content: true,
      messageType: true,
      createdAt: true,
    },
  });

  const items: StreamMessagePacket[] = dbMessages.map((m) => ({
    id: m.id,
    clientMsgId: m.clientMsgId || undefined,
    conversationId: m.conversationId,
    senderId: m.senderId,
    recipientId: m.recipientId,
    encryptedPayload: m.content,
    messageType: m.messageType,
    createdAt: m.createdAt.toISOString(),
  }));

  const nextCursor =
    items.length > 0 ? items[items.length - 1].createdAt : new Date().toISOString();

  return { items, nextCursor };
}
