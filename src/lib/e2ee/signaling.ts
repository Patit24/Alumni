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
  EncryptedMessagePayload,
} from "./crypto";

type MessageReceivedCallback = (msg: VaultMessage) => void;
type StatusUpdatedCallback = (msgId: string, status: "DELIVERED" | "READ") => void;
type TypingCallback = (peerId: string, isTyping: boolean) => void;

class RealtimeSignalingService {
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private localPrivateKey: CryptoKey | null = null;
  private channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

  // Key Cache: peerId -> shared CryptoKey
  private sharedKeys = new Map<string, CryptoKey>();

  // Event Listeners
  private onMessageReceivedCbs = new Set<MessageReceivedCallback>();
  private onStatusUpdatedCbs = new Set<StatusUpdatedCallback>();
  private onTypingCbs = new Set<TypingCallback>();

  init(userId: string, userName: string, localPrivateKey: CryptoKey) {
    if (this.currentUserId === userId && this.channel) return;

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
        encryptedPayload,
        messageType,
        createdAt,
      } = event.payload as {
        queueId?: string;
        senderId: string;
        senderDeviceId: string;
        encryptedPayload: EncryptedMessagePayload;
        messageType: string;
        createdAt: string;
      };

      try {
        const decryptedText = await this.decryptFromPeer(senderId, encryptedPayload);
        let parsedData: { text: string; replyToId?: string; replySnippet?: string; disappearingSeconds?: number } = {
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

        const vaultMsg: VaultMessage = {
          id: queueId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          peerId: senderId,
          senderId,
          text: parsedData.text,
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

        // Acknowledge delivery to server & purge temporary encrypted queue entry
        if (queueId) {
          fetch("/api/messages/ack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messageIds: [queueId],
              senderId,
              status: "DELIVERED",
            }),
          }).catch(() => {});
        }

        this.onMessageReceivedCbs.forEach((cb) => cb(vaultMsg));
      } catch (err) {
        console.error("Failed to decrypt incoming realtime message:", err);
      }
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
            msg.callType || "VOICE"
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

    // Setup WebRTC manager outbound signaling callback
    webrtcManager.setCallbacks({
      onStateChange: (_state, _session) => {
        // Can be hooked by UI components
      },
      onRemoteStream: () => {
        // Handled by Video/Audio Call UI
      },
      onSendSignal: (msg) => {
        const session = webrtcManager.getCurrentSession();
        if (!session) return;
        msg.senderId = this.currentUserId || "";
        msg.senderName = this.currentUserName || "Alumni Contact";
        this.sendSignalToPeer(session.peerId, msg);
      },
    });

    this.channel.subscribe();
  }

  // Send WebRTC signal to peer's private channel
  async sendSignalToPeer(peerId: string, signalMsg: WebRTCSignalingMessage) {
    try {
      const supabase = createClient();
      const peerChannel = supabase.channel(`p2p-signal:${peerId}`);
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
      const supabase = createClient();
      const peerChannel = supabase.channel(`p2p-signal:${peerId}`);
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
      const supabase = createClient();
      const peerChannel = supabase.channel(`p2p-signal:${peerId}`);
      peerChannel.send({
        type: "broadcast",
        event: "message-status",
        payload: { messageIds, status, senderId: this.currentUserId },
      });
    } catch (e) {
      console.warn("Failed to broadcast message status:", e);
    }
  }

  // Decrypt incoming message from peer using cached or fetched public key
  private async decryptFromPeer(peerId: string, payload: EncryptedMessagePayload): Promise<string> {
    if (!this.localPrivateKey) throw new Error("Local private key not initialized");

    let sharedKey = this.sharedKeys.get(peerId);
    if (!sharedKey) {
      // Fetch peer public key from server directory
      const res = await fetch(`/api/messages/devices?userId=${peerId}`);
      const data = await res.json();
      if (!data.devices || data.devices.length === 0) {
        throw new Error("Peer has no registered cryptographic identity");
      }

      const peerPublicKeySpki = data.devices[0].publicKey;
      const peerPubKey = await importPeerPublicKey(peerPublicKeySpki);
      sharedKey = await deriveSharedSessionKey(this.localPrivateKey, peerPubKey);
      this.sharedKeys.set(peerId, sharedKey);
    }

    return await decryptE2EEMessage(sharedKey, payload);
  }

  // Drain offline queued messages from server and decrypt
  async drainPendingQueue() {
    try {
      const res = await fetch("/api/messages/relay");
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) return;

      const acknowledgedIds: string[] = [];

      for (const item of data.messages) {
        try {
          const payload = typeof item.encryptedPayload === "string"
            ? JSON.parse(item.encryptedPayload)
            : item.encryptedPayload;

          const decryptedText = await this.decryptFromPeer(item.senderId, payload);
          let parsedData: { text: string; replyToId?: string; replySnippet?: string; disappearingSeconds?: number } = {
            text: decryptedText,
          };

          try {
            parsedData = JSON.parse(decryptedText);
          } catch {
            // Plain text
          }

          const expiresAt = parsedData.disappearingSeconds && parsedData.disappearingSeconds > 0
            ? Date.now() + parsedData.disappearingSeconds * 1000
            : undefined;

          const vaultMsg: VaultMessage = {
            id: item.id,
            peerId: item.senderId,
            senderId: item.senderId,
            text: parsedData.text,
            type: item.messageType === "EMOJI" ? "EMOJI" : "TEXT",
            replyToId: parsedData.replyToId,
            replySnippet: parsedData.replySnippet,
            status: "DELIVERED",
            createdAt: new Date(item.createdAt).getTime() || Date.now(),
            expiresAt,
            disappearingSeconds: parsedData.disappearingSeconds,
          };

          await saveLocalMessage(vaultMsg);
          acknowledgedIds.push(item.id);
          this.onMessageReceivedCbs.forEach((cb) => cb(vaultMsg));
        } catch (e) {
          console.error("Failed to decrypt queued message:", e);
        }
      }

      // Purge delivered messages from server
      if (acknowledgedIds.length > 0) {
        await fetch("/api/messages/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: acknowledgedIds }),
        });
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
}

export const realtimeSignaling = new RealtimeSignalingService();
