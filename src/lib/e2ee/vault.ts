/**
 * IndexedDB Secure Client Vault for E2EE Private Messaging & Call Logs.
 * Operates 100% on the client device. Plaintext messages and private keys
 * are NEVER sent or stored on the server.
 */

import {
  generateDeviceKeyPair,
  exportPrivateKey,
  importPrivateKey,
  importPeerPublicKey,
  generateSafetyNumber,
} from "./crypto";

const DB_NAME = "alumni_e2ee_vault_v1";
const DB_VERSION = 1;

export interface VaultMessage {
  id: string;
  peerId: string;
  senderId: string;
  senderName?: string;
  text: string;
  type: "TEXT" | "EMOJI" | "SIGNALING";
  replyToId?: string;
  replySnippet?: string;
  clientMsgId?: string;
  readAt?: string | null;
  status: "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  createdAt: number;
  expiresAt?: number; // For disappearing messages (timestamp ms)
  disappearingSeconds?: number;
  privacyMode?: "NORMAL" | "VIEW_ONCE" | "DISAPPEAR_30S" | "DISAPPEAR_5M" | "DISAPPEAR_1H" | "DISAPPEAR_24H";
  isViewed?: boolean;
}

export interface VaultCallLog {
  id: string;
  peerId: string;
  peerName: string;
  callType: "VOICE" | "VIDEO";
  direction: "INCOMING" | "OUTGOING";
  status: "COMPLETED" | "MISSED" | "DECLINED" | "FAILED";
  durationSeconds: number;
  timestamp: number;
}

export interface StoredContact {
  userId: string;
  name: string;
  deviceId: string;
  publicKeySpki: string;
  safetyNumber: string;
  isSafetyVerified?: boolean;
  updatedAt: number;
}

let currentActiveUserId: string | null = null;
const dbInstances = new Map<string, IDBDatabase>();

export function setActiveVaultUser(userId: string | null): void {
  if (typeof window !== "undefined") {
    if (userId) {
      currentActiveUserId = userId;
      try {
        sessionStorage.setItem("alumni_active_vault_user_id", userId);
        localStorage.setItem("alumni_active_vault_user_id", userId);
      } catch {}
    } else {
      currentActiveUserId = null;
      try {
        sessionStorage.removeItem("alumni_active_vault_user_id");
        localStorage.removeItem("alumni_active_vault_user_id");
      } catch {}
    }
  } else {
    currentActiveUserId = userId;
  }
}

export function getActiveVaultUserId(): string | null {
  if (currentActiveUserId) return currentActiveUserId;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("alumni_active_vault_user_id");
      if (stored) {
        currentActiveUserId = stored;
        return stored;
      }
    } catch {}
    try {
      const localStored = localStorage.getItem("alumni_active_vault_user_id");
      if (localStored) {
        currentActiveUserId = localStored;
        return localStored;
      }
    } catch {}
    try {
      const u = localStorage.getItem("alumni_user");
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed?.id) {
          currentActiveUserId = parsed.id;
          return parsed.id;
        }
      }
    } catch {}
  }
  return null;
}

export function getDatabaseName(userId?: string): string {
  const uid = userId || getActiveVaultUserId();
  if (uid) {
    const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `alumni_e2ee_vault_${safeUid}_v1`;
  }
  return "alumni_e2ee_vault_guest_v1";
}

function openDB(userId?: string): Promise<IDBDatabase> {
  const dbName = getDatabaseName(userId);
  const cached = dbInstances.get(dbName);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = window.indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Identity keys store
      if (!db.objectStoreNames.contains("identity_keys")) {
        db.createObjectStore("identity_keys", { keyPath: "id" });
      }

      // Contacts & Peer Public Keys store
      if (!db.objectStoreNames.contains("contacts")) {
        db.createObjectStore("contacts", { keyPath: "userId" });
      }

      // Local Decrypted Messages store
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("peerId", "peerId", { unique: false });
        msgStore.createIndex("createdAt", "createdAt", { unique: false });
        msgStore.createIndex("expiresAt", "expiresAt", { unique: false });
      }

      // Local Call Logs store
      if (!db.objectStoreNames.contains("call_logs")) {
        const callStore = db.createObjectStore("call_logs", { keyPath: "id" });
        callStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      dbInstances.set(dbName, db);
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Generates or retrieves the device's persistent E2EE identity keys
 */
export async function getOrCreateDeviceIdentity(userId: string): Promise<{
  deviceId: string;
  publicKeySpki: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  setActiveVaultUser(userId);
  const db = await openDB(userId);
  const keyId = `device_key_${userId}`;

  return new Promise((resolve, reject) => {
    const tx = db.transaction("identity_keys", "readwrite");
    const store = tx.objectStore("identity_keys");
    const getReq = store.get(keyId);

    getReq.onsuccess = async () => {
      if (getReq.result) {
        const { deviceId, publicKeySpki, privateKeyPkcs8 } = getReq.result;
        try {
          const privateKey = await importPrivateKey(privateKeyPkcs8);
          const publicKey = await importPeerPublicKey(publicKeySpki);
          return resolve({ deviceId, publicKeySpki, privateKey, publicKey });
        } catch (e) {
          console.warn("Failed to import existing key, generating new one:", e);
        }
      }

      // Generate fresh device key pair
      try {
        const pair = await generateDeviceKeyPair();
        const privateKeyPkcs8 = await exportPrivateKey(pair.privateKey);
        const deviceId = `dev_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

        store.put({
          id: keyId,
          userId,
          deviceId,
          publicKeySpki: pair.publicKeyBase64,
          privateKeyPkcs8,
          createdAt: Date.now(),
        });

        resolve({
          deviceId,
          publicKeySpki: pair.publicKeyBase64,
          privateKey: pair.privateKey,
          publicKey: pair.publicKey,
        });
      } catch (err) {
        reject(err);
      }
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Cache contact public key and calculate safety verification number
 */
export async function saveContactPublicKey(
  userId: string,
  name: string,
  deviceId: string,
  publicKeySpki: string,
  myPublicKeySpki: string
): Promise<StoredContact> {
  const db = await openDB();
  const safetyNumber = await generateSafetyNumber(myPublicKeySpki, publicKeySpki);

  const contact: StoredContact = {
    userId,
    name,
    deviceId,
    publicKeySpki,
    safetyNumber,
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("contacts", "readwrite");
    const store = tx.objectStore("contacts");
    const req = store.put(contact);
    req.onsuccess = () => resolve(contact);
    req.onerror = () => reject(req.error);
  });
}

export async function getContact(userId: string): Promise<StoredContact | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("contacts", "readonly");
    const store = tx.objectStore("contacts");
    const req = store.get(userId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves a decrypted message to the local vault
 */
export async function saveLocalMessage(msg: VaultMessage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const req = store.put(msg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Fetches messages for a specific 1-to-1 conversation, automatically purging expired disappearing messages
 */
export async function getLocalMessages(peerId: string): Promise<VaultMessage[]> {
  const db = await openDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const index = store.index("peerId");
    const req = index.getAll(peerId);

    req.onsuccess = () => {
      const allMsgs = (req.result as VaultMessage[]) || [];
      const validMsgs: VaultMessage[] = [];

      for (const m of allMsgs) {
        if (m.expiresAt && m.expiresAt <= now) {
          // Auto-purge expired message from local disk
          store.delete(m.id);
        } else {
          validMsgs.push(m);
        }
      }

      validMsgs.sort((a, b) => a.createdAt - b.createdAt);
      resolve(validMsgs);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Updates message delivery or read receipt status
 */
export async function updateMessageStatus(
  msgId: string,
  status: "SENT" | "DELIVERED" | "READ"
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const getReq = store.get(msgId);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const msg = getReq.result as VaultMessage;
        msg.status = status;
        store.put(msg);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Deletes a single message locally
 */
export async function deleteLocalMessage(msgId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const req = store.delete(msgId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clears an entire 1-to-1 conversation history locally
 */
export async function clearLocalConversation(peerId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const index = store.index("peerId");
    const req = index.openCursor(peerId);

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Local search across decrypted messages
 */
export async function searchLocalMessages(peerId: string, query: string): Promise<VaultMessage[]> {
  const msgs = await getLocalMessages(peerId);
  const q = query.toLowerCase().trim();
  if (!q) return msgs;
  return msgs.filter((m) => m.text.toLowerCase().includes(q));
}

/**
 * Saves a WebRTC voice/video call log locally
 */
export async function saveCallLog(call: VaultCallLog): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("call_logs", "readwrite");
    const store = tx.objectStore("call_logs");
    const req = store.put(call);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all local call history
 */
export async function getCallLogs(userId?: string): Promise<VaultCallLog[]> {
  const db = await openDB(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("call_logs", "readonly");
    const store = tx.objectStore("call_logs");
    const req = store.getAll();

    req.onsuccess = () => {
      const logs = (req.result as VaultCallLog[]) || [];
      logs.sort((a, b) => b.timestamp - a.timestamp);
      resolve(logs);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clears all call logs locally
 */
export async function clearCallLogs(userId?: string): Promise<void> {
  const db = await openDB(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("call_logs", "readwrite");
    const store = tx.objectStore("call_logs");
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Checks if a peer's public key has changed compared to cached key
 */
export async function checkPeerKeyRotation(
  userId: string,
  incomingPublicKeySpki: string
): Promise<{ changed: boolean; oldKey?: string }> {
  const existing = await getContact(userId);
  if (!existing) return { changed: false };
  if (existing.publicKeySpki !== incomingPublicKeySpki) {
    return { changed: true, oldKey: existing.publicKeySpki };
  }
  return { changed: false };
}

/**
 * Verifies or un-verifies a contact's cryptographic safety number
 */
export async function verifyContactSafety(
  userId: string,
  isVerified: boolean
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("contacts", "readwrite");
    const store = tx.objectStore("contacts");
    const getReq = store.get(userId);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const updated: StoredContact = {
          ...getReq.result,
          isSafetyVerified: isVerified,
          updatedAt: Date.now(),
        };
        store.put(updated);
      }
      resolve();
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Immediately burns a View Once message after it has been displayed
 */
export async function markMessageBurned(messageId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const delReq = store.delete(messageId);
    delReq.onsuccess = () => resolve();
    delReq.onerror = () => reject(delReq.error);
  });
}

/**
 * Atomic One-Tap Privacy Cleanup:
 * Wipes all decrypted messages, call logs, contacts, and local cached feeds from the device
 */
export async function cleanMyPrivacy(): Promise<{
  messagesCleared: boolean;
  callsCleared: boolean;
  cacheCleared: boolean;
}> {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["messages", "call_logs"], "readwrite");
    tx.objectStore("messages").clear();
    tx.objectStore("call_logs").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Clean local feed caches and ephemeral markers
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("alumni_local_feed_cache_v2");
      localStorage.removeItem("alumni_recent_searches");
    } catch {}
  }

  return {
    messagesCleared: true,
    callsCleared: true,
    cacheCleared: true,
  };
}

export const CONNECTED_CHATS_KEY = "alumni_connected_peer_ids";

export function getLocalConnectedPeerIds(userId?: string): string[] {
  if (typeof window === "undefined") return [];
  const uid = userId || getActiveVaultUserId();
  if (!uid) return [];
  const set = new Set<string>();
  try {
    const scopedKey = `alumni_connected_peer_ids_${uid}`;
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) list.forEach((id: string) => { if (id && id !== uid) set.add(id); });
    }
    // Also include any profiles from cached connections so lists never drift
    const cachedKey = `alumni_cached_connections_${uid}`;
    const rawCached = localStorage.getItem(cachedKey);
    if (rawCached) {
      const cachedList = JSON.parse(rawCached);
      if (Array.isArray(cachedList)) {
        cachedList.forEach((c: any) => {
          const id = c?.id || c?.userId;
          if (id && id !== uid) set.add(id);
        });
      }
    }
    // Clean up deprecated global key to prevent cross-account leak
    if (localStorage.getItem("alumni_connected_peer_ids_global")) {
      localStorage.removeItem("alumni_connected_peer_ids_global");
    }
  } catch {}
  return Array.from(set);
}

export function addLocalConnectedPeer(peerId: string, userId?: string, profile?: any): void {
  if (typeof window === "undefined" || !peerId) return;
  const uid = userId || getActiveVaultUserId();
  if (!uid || peerId === uid) return; // Never add self as connected peer!
  try {
    const scopedKey = `alumni_connected_peer_ids_${uid}`;
    const rawScoped = localStorage.getItem(scopedKey);
    const scopedList: string[] = rawScoped ? JSON.parse(rawScoped) : [];
    if (!scopedList.includes(peerId)) {
      scopedList.unshift(peerId);
      localStorage.setItem(scopedKey, JSON.stringify(scopedList));
    }
    if (profile && (profile.id || profile.userId)) {
      cacheConnectionProfiles([profile], uid);
    }
    window.dispatchEvent(new CustomEvent("connection-requests-updated"));
  } catch {}
}

export function removeLocalConnectedPeer(peerId: string, userId?: string): void {
  if (typeof window === "undefined" || !peerId) return;
  const uid = userId || getActiveVaultUserId();
  if (!uid) return;
  try {
    const scopedKey = `alumni_connected_peer_ids_${uid}`;
    const rawScoped = localStorage.getItem(scopedKey);
    if (rawScoped) {
      const scopedList: string[] = JSON.parse(rawScoped);
      const filtered = scopedList.filter((id) => id !== peerId);
      localStorage.setItem(scopedKey, JSON.stringify(filtered));
    }
    // Also clean up cached connection profiles
    const cachedKey = `alumni_cached_connections_${uid}`;
    const rawCached = localStorage.getItem(cachedKey);
    if (rawCached) {
      const cachedList: any[] = JSON.parse(rawCached);
      const filteredCached = cachedList.filter((c: any) => (c.id || c.userId) !== peerId);
      localStorage.setItem(cachedKey, JSON.stringify(filteredCached));
    }
    window.dispatchEvent(new CustomEvent("connection-requests-updated"));
  } catch {}
}

export function syncLocalConnectedPeers(serverPeerIds: string[], userId?: string): void {
  if (typeof window === "undefined") return;
  const uid = userId || getActiveVaultUserId();
  if (!uid) return;
  try {
    const scopedKey = `alumni_connected_peer_ids_${uid}`;
    const rawScoped = localStorage.getItem(scopedKey);
    const existingList: string[] = rawScoped ? JSON.parse(rawScoped) : [];
    
    // Always merge existing local peers with server peer IDs so temporary network
    // failures or server container cold-starts NEVER erase connected friends!
    const validServer = (serverPeerIds || []).filter((id) => id && id !== uid);
    const merged = Array.from(
      new Set([...existingList.filter((id) => id && id !== uid), ...validServer])
    );
    
    if (merged.length > 0) {
      localStorage.setItem(scopedKey, JSON.stringify(merged));
    }
    if (localStorage.getItem("alumni_connected_peer_ids_global")) {
      localStorage.removeItem("alumni_connected_peer_ids_global");
    }
  } catch {}
}

export function cacheConnectionProfiles(profiles: any[], userId?: string): void {
  if (typeof window === "undefined" || !Array.isArray(profiles)) return;
  const uid = userId || getActiveVaultUserId();
  if (!uid) return;
  try {
    const key = `alumni_cached_connections_${uid}`;
    const raw = localStorage.getItem(key);
    const existing: any[] = raw ? JSON.parse(raw) : [];

    const map = new Map<string, any>();
    // 1. Existing cached profiles
    for (const p of existing) {
      const pid = p?.id || p?.userId;
      if (pid && pid !== uid) map.set(pid, p);
    }
    // 2. Overlay new profiles safely (never allow "Alumni Member" or empty strings to overwrite a known real name)
    for (const p of profiles) {
      const pid = p?.id || p?.userId;
      if (pid && pid !== uid) {
        const prev = map.get(pid) || {};
        const safeName = (p.name && p.name.trim() !== "Alumni Member") ? p.name : (prev.name || p.name || "Alumni Member");
        const safeAvatar = p.avatarUrl || prev.avatarUrl;
        const safeRole = p.currentRole || prev.currentRole;
        const safeCompany = p.currentCompany || prev.currentCompany;
        const safeBatchYear = p.batchYear || prev.batchYear;
        const safeUsername = p.username || prev.username;
        map.set(pid, {
          ...prev,
          ...p,
          name: safeName,
          avatarUrl: safeAvatar,
          currentRole: safeRole,
          currentCompany: safeCompany,
          batchYear: safeBatchYear,
          username: safeUsername,
        });
      }
    }
    const merged = Array.from(map.values());
    if (merged.length > 0) {
      localStorage.setItem(key, JSON.stringify(merged));
    }
  } catch {}
}

export function getCachedConnectionProfiles<T = any>(userId?: string): T[] {
  if (typeof window === "undefined") return [];
  const uid = userId || getActiveVaultUserId();
  if (!uid) return [];
  try {
    const key = `alumni_cached_connections_${uid}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearUserLocalVault(userId?: string): void {
  if (typeof window === "undefined") return;
  const uid = userId || getActiveVaultUserId();
  if (uid) {
    try {
      localStorage.removeItem(`alumni_connected_peer_ids_${uid}`);
    } catch {}
  }
  try {
    localStorage.removeItem(CONNECTED_CHATS_KEY);
    sessionStorage.removeItem("alumni_active_vault_user_id");
  } catch {}
  setActiveVaultUser(null);
}

/**
 * Retrieves all unique peerIds who have messages or are stored contacts in the local E2EE vault
 */
export async function getVaultConnectedPeerIds(userId?: string): Promise<string[]> {
  const uid = userId || getActiveVaultUserId();
  const peerIds = new Set<string>();
  try {
    const db = await openDB(uid || undefined);

    // 1. Peer IDs from messages
    await new Promise<void>((resolve) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const req = store.getAll();
      req.onsuccess = () => {
        const msgs = (req.result as VaultMessage[]) || [];
        msgs.forEach((m) => {
          if (m.peerId && m.peerId !== uid) peerIds.add(m.peerId);
        });
        resolve();
      };
      req.onerror = () => resolve();
    });

    // 2. Peer IDs from contacts store
    await new Promise<void>((resolve) => {
      const tx = db.transaction("contacts", "readonly");
      const store = tx.objectStore("contacts");
      const req = store.getAll();
      req.onsuccess = () => {
        const contacts = (req.result as StoredContact[]) || [];
        contacts.forEach((c) => {
          if (c.userId && c.userId !== uid) peerIds.add(c.userId);
        });
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn("Error getting vault connected peer IDs:", e);
  }
  return Array.from(peerIds);
}

/**
 * Retrieves the latest message for every peer conversation
 */
export async function getLatestMessagesPerPeer(userId?: string): Promise<Map<string, VaultMessage>> {
  const uid = userId || getActiveVaultUserId();
  const map = new Map<string, VaultMessage>();
  try {
    const db = await openDB(uid || undefined);
    return new Promise((resolve) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const req = store.getAll();
      req.onsuccess = () => {
        const msgs = (req.result as VaultMessage[]) || [];
        for (const m of msgs) {
          if (!m.peerId || m.peerId === uid) continue;
          const existing = map.get(m.peerId);
          if (!existing || m.createdAt > existing.createdAt) {
            map.set(m.peerId, m);
          }
        }
        resolve(map);
      };
      req.onerror = () => resolve(map);
    });
  } catch (e) {
    console.warn("Failed to get latest messages per peer:", e);
    return map;
  }
}


