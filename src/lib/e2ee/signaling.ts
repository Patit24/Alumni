/**
 * Realtime WebSocket Signaling Channel for E2EE Messages & WebRTC Calls
 * Utilizes Supabase Realtime broadcast channels with secure user separation.
 */

import { createClient } from "@/utils/supabase/client";
import { webrtcManager, WebRTCSignalingMessage } from "@/lib/webrtc/call-manager";
import {
  saveLocalMessage,
  updateMessageStatus,
  saveCallLog,
  VaultMessage,
} from "./vault";
import {
  deriveSharedSessionKey,
  importPeerPublicKey,
  decryptE2EEMessage,
  derivePairwiseFallbackKey,
  EncryptedMessagePayload,
} from "./crypto";

type MessageReceivedCallback = (msg: VaultMessage) => void;
type StatusUpdatedCallback = (msgId: string, status: "DELIVERED" | "READ") => void;
type TypingCallback = (peerId: string, isTyping: boolean) => void;
export type ConnectionRequestCallback = (payload: {
  requestId: string;
  senderId: string;
  senderName: string;
  senderUsername?: string | null;
  createdAt: string;
}) => void;
export type ConnectionAcceptedCallback = (payload: {
  peerId: string;
  peerName: string;
  peerUsername?: string | null;
}) => void;

class RealtimeSignalingService {
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private localPrivateKey: CryptoKey | null = null;
  private channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
  private peerChannels = new Map<string, ReturnType<ReturnType<typeof createClient>["channel"]>>();

  // Key Cache: peerId -> shared CryptoKey
  private sharedKeys = new Map<string, CryptoKey>();

  // Event Listeners
  private onMessageReceivedCbs = new Set<MessageReceivedCallback>();
  private onStatusUpdatedCbs = new Set<StatusUpdatedCallback>();
  private onTypingCbs = new Set<TypingCallback>();
  private onConnectionRequestCbs = new Set<ConnectionRequestCallback>();
  private onConnectionAcceptedCbs = new Set<ConnectionAcceptedCallback>();

  private getPeerChannel(peerId: string) {
    if (!this.peerChannels.has(peerId)) {
      const supabase = createClient();
      const ch = supabase.channel(`p2p-signal:${peerId}`, {
        config: { broadcast: { ack: true } },
      });
      ch.subscribe();
      this.peerChannels.set(peerId, ch);
    }
    return this.peerChannels.get(peerId)!;
  }

  cleanup() {
    if (this.channel) {
      try {
        const supabase = createClient();
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
    for (const [, ch] of this.peerChannels) {
      try {
        const supabase = createClient();
        supabase.removeChannel(ch);
      } catch {}
    }
    this.peerChannels.clear();
    this.sharedKeys.clear();
    this.onMessageReceivedCbs.clear();
    this.onStatusUpdatedCbs.clear();
    this.onTypingCbs.clear();
    this.onConnectionRequestCbs.clear();
    this.onConnectionAcceptedCbs.clear();
    this.currentUserId = null;
    this.currentUserName = null;
    this.localPrivateKey = null;
  }

  init(userId: string, userName: string, localPrivateKey: CryptoKey) {
    if (this.currentUserId === userId && this.channel) return;

    if (this.channel || (this.currentUserId && this.currentUserId !== userId)) {
      this.cleanup();
    }

    this.currentUserId = userId;
    this.currentUserName = userName;
    this.localPrivateKey = localPrivateKey;

    const supabase = createClient();
    const channelName = `p2p-signal:${userId}`;

    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // 1. Incoming Encrypted Message via Realtime Broadcast
    this.channel.on("broadcast", { event: "encrypted-message" }, async (event) => {
      const {
        queueId,
        senderId,
        senderName,
        encryptedPayload,
        messageType,
        createdAt,
      } = event.payload as {
        queueId?: string;
        senderId: string;
        senderName?: string;
        senderDeviceId: string;
        encryptedPayload: EncryptedMessagePayload;
        messageType: string;
        createdAt: string;
      };

      try {
        const payloadObj = typeof encryptedPayload === "string" ? JSON.parse(encryptedPayload) : encryptedPayload;
        const decryptedText = await this.decryptFromPeer(senderId, payloadObj);
        let parsedData: { id?: string; text: string; senderName?: string; replyToId?: string; replySnippet?: string; disappearingSeconds?: number } = {
          text: decryptedText,
        };

        try {
          parsedData = JSON.parse(decryptedText);
        } catch {
          // Plain text fallback
        }

        const expiresAt = parsedData.disappearingSeconds && parsedData.disappearingSeconds > 0
          ? Date.now() + parsedData.disappearingSeconds * 1000
          : undefined;

        // Use parsedData.id as the stable message ID; queueId is the DB queue row ID
        const msgId = parsedData.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const vaultMsg: VaultMessage = {
          id: msgId,
          clientMsgId: parsedData.id || queueId,
          peerId: senderId,
          senderId,
          senderName: senderName || parsedData.senderName,
          text: parsedData.text || decryptedText,
          type: messageType === "EMOJI" ? "EMOJI" : "TEXT",
          replyToId: parsedData.replyToId,
          replySnippet: parsedData.replySnippet,
          status: "DELIVERED",
          createdAt: new Date(createdAt).getTime() || Date.now(),
          expiresAt,
          disappearingSeconds: parsedData.disappearingSeconds,
        };

        // Save to local vault
        await saveLocalMessage(vaultMsg);

        // ACK server: purge by the ACTUAL DB queue row ID (queueId), not the message ID
        // This correctly removes the persisted encrypted payload from the server queue
        fetch("/api/messages/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageIds: [msgId],
            // queueId is the actual database EncryptedMessageQueue.id row — use it to purge
            queueIds: queueId ? [queueId] : [],
            senderId,
            status: "DELIVERED",
          }),
        }).catch(() => {});

        // Direct peer channel delivery receipt
        this.sendMessageStatus(senderId, [msgId], "DELIVERED");

        this.onMessageReceivedCbs.forEach((cb) => cb(vaultMsg));
      } catch (err) {
        console.error("Failed to decrypt incoming realtime message:", err);
      }
    });

    // 1b. Incoming Direct Message via Realtime Broadcast
    this.channel.on("broadcast", { event: "direct-message" }, async (event) => {
      const { message } = event.payload as { message: any };
      if (!message || !message.id) return;
      console.log(`[REALTIME RECEIVE] Direct message received from ${message.senderId}:`, message.id);

      const vaultMsg: VaultMessage = {
        id: message.id,
        clientMsgId: message.clientMsgId,
        peerId: message.senderId,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.content,
        type: message.messageType === "EMOJI" ? "EMOJI" : "TEXT",
        replyToId: message.replyToId,
        replySnippet: message.replySnippet,
        status: message.status || "DELIVERED",
        createdAt: new Date(message.createdAt).getTime() || Date.now(),
        disappearingSeconds: message.disappearingSeconds,
      };

      try {
        await saveLocalMessage(vaultMsg);
      } catch {}

      // Notify all active listeners
      this.onMessageReceivedCbs.forEach((cb) => cb(vaultMsg));

      // Direct peer delivery receipt
      this.sendMessageStatus(message.senderId, [message.id], "DELIVERED");

      // Update delivery status on server
      fetch("/api/messages/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIds: [message.id],
          senderId: message.senderId,
          status: "DELIVERED",
        }),
      }).catch(() => {});
    });

    // 1c. Multi-Session Outbound Sync: Direct Message sent from another session/device of current user
    this.channel.on("broadcast", { event: "direct-message-sent" }, async (event) => {
      const { message } = event.payload as { message: any };
      if (!message || !message.id) return;
      console.log(`[REALTIME RECEIVE] Multi-session outbound message synced:`, message.id);

      const vaultMsg: VaultMessage = {
        id: message.id,
        clientMsgId: message.clientMsgId,
        peerId: message.recipientId,
        senderId: message.senderId,
        senderName: message.senderName || "You",
        text: message.content,
        type: message.messageType === "EMOJI" ? "EMOJI" : "TEXT",
        replyToId: message.replyToId,
        replySnippet: message.replySnippet,
        status: message.status || "SENT",
        createdAt: new Date(message.createdAt).getTime() || Date.now(),
        disappearingSeconds: message.disappearingSeconds,
      };

      try {
        await saveLocalMessage(vaultMsg);
      } catch {}

      // Notify all active listeners so Browser B renders immediately
      this.onMessageReceivedCbs.forEach((cb) => cb(vaultMsg));
    });

    // 2. Delivery & Read Receipts
    this.channel.on("broadcast", { event: "message-status" }, async (event) => {
      const { messageIds, status } = event.payload as {
        messageIds: string[];
        status: "DELIVERED" | "READ";
      };

      for (const id of messageIds) {
        await updateMessageStatus(id, status);
        this.onStatusUpdatedCbs.forEach((cb) => cb(id, status));
      }
    });

    // 3. Typing Indicator
    this.channel.on("broadcast", { event: "typing" }, (event) => {
      const { senderId, isTyping } = event.payload as { senderId: string; isTyping: boolean };
      this.onTypingCbs.forEach((cb) => cb(senderId, isTyping));
    });

    // 4. WebRTC Call Signaling
    this.channel.on("broadcast", { event: "webrtc-signal" }, async (event) => {
      const msg = event.payload as WebRTCSignalingMessage;
      switch (msg.type) {
        case "REQUEST":
          webrtcManager.handleIncomingCall(
            msg.callId,
            msg.senderId,
            msg.senderName || "Alumni Contact",
            msg.callType || "VOICE",
            msg.senderRole
          );
          break;
        case "ACCEPT":
          await webrtcManager.handlePeerAccepted();
          break;
        case "REJECT":
          webrtcManager.endCall(false);
          await saveCallLog({
            id: msg.callId,
            peerId: msg.senderId,
            peerName: msg.senderName || "Alumni Contact",
            callType: msg.callType || "VOICE",
            direction: "OUTGOING",
            status: msg.reason === "BUSY" ? "MISSED" : "DECLINED",
            durationSeconds: 0,
            timestamp: Date.now(),
          });
          break;
        case "OFFER":
          if (msg.sdp) await webrtcManager.handleOffer(msg.sdp);
          break;
        case "ANSWER":
          if (msg.sdp) await webrtcManager.handleAnswer(msg.sdp);
          break;
        case "ICE":
          if (msg.candidate) await webrtcManager.handleIceCandidate(msg.candidate);
          break;
        case "END":
          webrtcManager.endCall(false);
          break;
      }
    });

    // 5. Incoming Connection Request via Realtime Broadcast
    this.channel.on("broadcast", { event: "connection-request" }, (event) => {
      const payload = event.payload as {
        requestId: string;
        senderId: string;
        senderName: string;
        senderUsername?: string | null;
        createdAt: string;
      };
      this.onConnectionRequestCbs.forEach((cb) => cb(payload));
    });

    // 6. Incoming Connection Accepted Event
    this.channel.on("broadcast", { event: "connection-accepted" }, (event) => {
      const payload = event.payload as {
        peerId: string;
        peerName: string;
        peerUsername?: string | null;
      };
      this.onConnectionAcceptedCbs.forEach((cb) => cb(payload));
    });

    // Setup WebRTC manager outbound signaling sender
    webrtcManager.registerSignalSender((msg) => {
      const session = webrtcManager.getCurrentSession();
      if (!session) return;
      msg.senderId = this.currentUserId || "";
      msg.senderName = this.currentUserName || "Alumni Contact";
      this.sendSignalToPeer(session.peerId, msg);
    });

    this.channel.subscribe();

    // ── Visibility-based re-drain ────────────────────────────────────────────
    // When the user returns to the tab after being away (offline or backgrounded),
    // re-drain the server queue so messages sent while they were offline appear.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    }
  }

  // Bound visibility handler — re-drains queue when tab becomes visible
  private _onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      this.drainPendingQueue();
    }
  };

  // Send WebRTC signal to peer's private channel
  async sendSignalToPeer(peerId: string, signalMsg: WebRTCSignalingMessage) {
    try {
      const peerChannel = this.getPeerChannel(peerId);
      await peerChannel.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: signalMsg,
      });
    } catch (err) {
      console.warn("Failed to broadcast WebRTC signal:", err);
    }
  }

  // Broadcast typing status
  sendTypingStatus(peerId: string, isTyping: boolean) {
    if (!this.currentUserId) return;
    try {
      const peerChannel = this.getPeerChannel(peerId);
      peerChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { senderId: this.currentUserId, isTyping },
      });
    } catch {
      // Non-critical
    }
  }

  // Broadcast message delivery or read receipt (WhatsApp style double blue tick)
  sendMessageStatus(peerId: string, messageIds: string[], status: "DELIVERED" | "READ") {
    if (!this.currentUserId || !messageIds.length) return;
    try {
      const peerChannel = this.getPeerChannel(peerId);
      peerChannel.send({
        type: "broadcast",
        event: "message-status",
        payload: { messageIds, status, senderId: this.currentUserId },
      });
    } catch (e) {
      console.warn("Failed to broadcast message status:", e);
    }
  }

  // Broadcast encrypted message directly to peer's private channel (instant delivery via open WebSocket)
  async sendEncryptedMessage(peerId: string, payload: {
    queueId: string;
    encryptedPayload: EncryptedMessagePayload;
    messageType: string;
    createdAt: string;
  }) {
    if (!this.currentUserId) return;
    try {
      const peerChannel = this.getPeerChannel(peerId);
      await peerChannel.send({
        type: "broadcast",
        event: "encrypted-message",
        payload: {
          ...payload,
          senderId: this.currentUserId,
          senderName: this.currentUserName,
        },
      });
    } catch (err) {
      console.warn("Direct peer broadcast of encrypted message failed:", err);
    }
  }

  // Decrypt incoming message from peer using pairwise key or ECDH shared key
  private async decryptFromPeer(peerId: string, payload: EncryptedMessagePayload): Promise<string> {
    const errors: string[] = [];

    // Attempt 1: Pairwise deterministic key (fast, reliable, identical on both devices)
    if (this.currentUserId) {
      try {
        const fallbackKey = await derivePairwiseFallbackKey(this.currentUserId, peerId);
        return await decryptE2EEMessage(fallbackKey, payload);
      } catch (err: any) {
        errors.push(`Pairwise: ${err?.message || err}`);
      }
    }

    // Attempt 2: Standard ECDH device key derivation
    try {
      if (this.localPrivateKey) {
        let sharedKey = this.sharedKeys.get(peerId);
        if (!sharedKey) {
          // Fetch peer public key from server directory
          const res = await fetch(`/api/messages/devices?userId=${peerId}`);
          const data = await res.json();
          if (data.devices && data.devices.length > 0) {
            const peerPublicKeySpki = data.devices[0].publicKey;
            const peerPubKey = await importPeerPublicKey(peerPublicKeySpki);
            sharedKey = await deriveSharedSessionKey(this.localPrivateKey, peerPubKey);
            this.sharedKeys.set(peerId, sharedKey);
          }
        }

        if (sharedKey) {
          return await decryptE2EEMessage(sharedKey, payload);
        }
      }
    } catch (err: any) {
      errors.push(`ECDH: ${err?.message || err}`);
    }

    throw new Error(`Unable to decrypt message from peer ${peerId}: ${errors.join("; ")}`);
  }

  // Drain offline queued messages from server and decrypt
  async drainPendingQueue() {
    try {
      const res = await fetch("/api/messages/relay");
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) return;

      const acknowledgedQueueIds: string[] = [];
      const acknowledgedMsgIds: string[] = [];

      for (const item of data.messages) {
        try {
          const payload = typeof item.encryptedPayload === "string"
            ? JSON.parse(item.encryptedPayload)
            : item.encryptedPayload;

          const decryptedText = await this.decryptFromPeer(item.senderId, payload);
          let parsedData: any = { text: decryptedText };

          try {
            parsedData = JSON.parse(decryptedText);
          } catch {
            // Plain text
          }

          const expiresAt = parsedData.disappearingSeconds && parsedData.disappearingSeconds > 0
            ? Date.now() + parsedData.disappearingSeconds * 1000
            : undefined;

          // Use the stable message ID embedded in payload; item.id is the DB queue row
          const msgId = parsedData.id || item.id;

          // ── Deduplication: skip messages already in local vault ──────────
          // This prevents showing the same message twice when:
          // (a) it arrived via real-time broadcast, AND
          // (b) it still appears in the relay GET (because the ACK hasn't processed yet)
          const { getLocalMessages } = await import("./vault");
          const existingMsgs = await getLocalMessages(item.senderId);
          const alreadyStored = existingMsgs.some((m) => m.id === msgId);

          if (!alreadyStored) {
            const vaultMsg: VaultMessage = {
              id: msgId,
              clientMsgId: parsedData.id || item.id,
              peerId: item.senderId,
              senderId: item.senderId,
              senderName: item.senderName || parsedData.senderName,
              text: parsedData.text || decryptedText,
              type: item.messageType === "EMOJI" ? "EMOJI" : "TEXT",
              replyToId: parsedData.replyToId,
              replySnippet: parsedData.replySnippet,
              status: "DELIVERED",
              createdAt: new Date(item.createdAt).getTime() || Date.now(),
              expiresAt,
              disappearingSeconds: parsedData.disappearingSeconds,
            };

            await saveLocalMessage(vaultMsg);
            this.sendMessageStatus(item.senderId, [msgId], "DELIVERED");
            this.onMessageReceivedCbs.forEach((cb) => cb(vaultMsg));
          }

          // Always ACK and purge the DB queue row, whether new or duplicate
          acknowledgedQueueIds.push(item.id); // item.id = DB queue row UUID
          acknowledgedMsgIds.push(msgId);
        } catch (e) {
          console.error("Failed to decrypt queued message:", e);
        }
      }

      // Purge delivered messages from server (by DB queue row ID)
      if (acknowledgedQueueIds.length > 0) {
        await fetch("/api/messages/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageIds: acknowledgedMsgIds,
            queueIds: acknowledgedQueueIds, // ← these are the real DB row IDs
            status: "DELIVERED",
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Drain pending queue error:", err);
    }
  }

  onMessageReceived(cb: MessageReceivedCallback) {
    this.onMessageReceivedCbs.add(cb);
    return () => this.onMessageReceivedCbs.delete(cb);
  }

  onStatusUpdated(cb: StatusUpdatedCallback) {
    this.onStatusUpdatedCbs.add(cb);
    return () => this.onStatusUpdatedCbs.delete(cb);
  }

  onTyping(cb: TypingCallback) {
    this.onTypingCbs.add(cb);
    return () => this.onTypingCbs.delete(cb);
  }

  onConnectionRequest(cb: ConnectionRequestCallback) {
    this.onConnectionRequestCbs.add(cb);
    return () => this.onConnectionRequestCbs.delete(cb);
  }

  onConnectionAccepted(cb: ConnectionAcceptedCallback) {
    this.onConnectionAcceptedCbs.add(cb);
    return () => this.onConnectionAcceptedCbs.delete(cb);
  }
}

export const realtimeSignaling = new RealtimeSignalingService();
