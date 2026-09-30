/**
 * Resilient Client-Side Message Outbox
 * Implements a WhatsApp-grade offline queue that stores pending messages locally,
 * attempts immediate background transmission, and automatically retries with
 * exponential backoff when connectivity restores.
 */

export interface OutboxItem {
  id: string;
  clientMsgId: string;
  recipientId: string;
  content: string;
  messageType?: string;
  replyToId?: string;
  replySnippet?: string;
  disappearingSeconds?: number;
  privacyMode?: string;
  createdAt: number;
  retries: number;
  lastAttemptAt?: number;
}

const OUTBOX_STORAGE_KEY_PREFIX = "samparka_chat_outbox_";

function getOutboxStorageKey(userId: string): string {
  return `${OUTBOX_STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Retrieves all pending outbox items for a user.
 */
export function getPendingOutboxItems(userId: string, recipientId?: string): OutboxItem[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(getOutboxStorageKey(userId));
    if (!raw) return [];
    const items: OutboxItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    if (recipientId) {
      return items.filter((item) => item.recipientId === recipientId);
    }
    return items;
  } catch (e) {
    console.warn("[Outbox] Failed to read outbox items:", e);
    return [];
  }
}

/**
 * Saves outbox items to persistent storage.
 */
function persistOutbox(userId: string, items: OutboxItem[]): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(getOutboxStorageKey(userId), JSON.stringify(items));
  } catch (e) {
    console.warn("[Outbox] Failed to persist outbox:", e);
  }
}

/**
 * Enqueues a message into the local outbox.
 */
export function enqueueOutboxItem(userId: string, item: OutboxItem): void {
  if (typeof window === "undefined" || !userId) return;
  const current = getPendingOutboxItems(userId);
  const exists = current.some((i) => i.clientMsgId === item.clientMsgId);
  if (!exists) {
    const updated = [...current, item];
    persistOutbox(userId, updated);
  }
}

/**
 * Removes an acknowledged message from the outbox.
 */
export function removeOutboxItem(userId: string, clientMsgId: string): void {
  if (typeof window === "undefined" || !userId) return;
  const current = getPendingOutboxItems(userId);
  const updated = current.filter((i) => i.clientMsgId !== clientMsgId);
  persistOutbox(userId, updated);
}

/**
 * Updates retry metadata for a failed item.
 */
export function markOutboxItemFailed(userId: string, clientMsgId: string): void {
  if (typeof window === "undefined" || !userId) return;
  const current = getPendingOutboxItems(userId);
  const updated = current.map((i) => {
    if (i.clientMsgId === clientMsgId) {
      return {
        ...i,
        retries: i.retries + 1,
        lastAttemptAt: Date.now(),
      };
    }
    return i;
  });
  persistOutbox(userId, updated);
}

let isDraining = false;

/**
 * Drains the outbox by sending all pending items to the server.
 * Uses exponential backoff to avoid hammering during network transitions.
 */
export async function drainOutbox(
  userId: string,
  onMessageSent?: (clientMsgId: string, serverMsg: any) => void
): Promise<void> {
  if (typeof window === "undefined" || !userId || isDraining) return;
  if (!navigator.onLine) return;

  const items = getPendingOutboxItems(userId);
  if (items.length === 0) return;

  isDraining = true;
  try {
    for (const item of items) {
      // Exponential backoff check: retry interval = min(30s, 1s * 2^retries)
      if (item.retries > 0 && item.lastAttemptAt) {
        const backoffMs = Math.min(30000, 1000 * Math.pow(2, item.retries));
        if (Date.now() - item.lastAttemptAt < backoffMs) {
          continue; // Skip this item until backoff period passes
        }
      }

      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: item.recipientId,
            content: item.content,
            clientMsgId: item.clientMsgId,
            replyToId: item.replyToId,
            replySnippet: item.replySnippet,
            disappearingSeconds: item.disappearingSeconds,
            messageType: item.messageType || "TEXT",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          removeOutboxItem(userId, item.clientMsgId);
          if (onMessageSent && data.message) {
            onMessageSent(item.clientMsgId, data.message);
          }
        } else if (res.status >= 400 && res.status < 500) {
          // Client/Policy error (e.g. blocked, not connected) -> remove to prevent infinite loop
          console.warn(`[Outbox] Non-retryable error (${res.status}) for ${item.clientMsgId}`);
          removeOutboxItem(userId, item.clientMsgId);
        } else {
          markOutboxItemFailed(userId, item.clientMsgId);
        }
      } catch (networkErr) {
        console.warn(`[Outbox] Transmission error for ${item.clientMsgId}:`, networkErr);
        markOutboxItemFailed(userId, item.clientMsgId);
        break; // Stop draining if offline/network dropped
      }
    }
  } finally {
    isDraining = false;
  }
}

/**
 * Initializes automatic background listeners for network restoration.
 */
export function initOutboxNetworkListener(
  userId: string,
  onMessageSent?: (clientMsgId: string, serverMsg: any) => void
): () => void {
  if (typeof window === "undefined" || !userId) return () => {};

  const handleOnline = () => {
    drainOutbox(userId, onMessageSent).catch(() => {});
  };

  window.addEventListener("online", handleOnline);

  // Trigger initial drain on mount
  drainOutbox(userId, onMessageSent).catch(() => {});

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
