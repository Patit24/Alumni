"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Phone,
  Video,
  ShieldCheck,
  ArrowLeft,
  Send,
  MoreVertical,
  Clock,
  Trash2,
  AlertTriangle,
  Smile,
  Check,
  CheckCheck,
  Search,
  KeyRound,
  ShieldAlert,
  Loader2,
  Flame,
  UserCheck,
  UserPlus,
  UserX,
  Share2,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  X,
  Scan,
} from "lucide-react";
import {
  getOrCreateDeviceIdentity,
  getLocalMessages,
  saveLocalMessage,
  deleteLocalMessage,
  clearLocalConversation,
  searchLocalMessages,
  checkPeerKeyRotation,
  verifyContactSafety,
  markMessageBurned,
  addLocalConnectedPeer,
  setActiveVaultUser,
  VaultMessage,
} from "@/lib/e2ee/vault";
import {
  importPeerPublicKey,
  deriveSharedSessionKey,
  derivePairwiseFallbackKey,
  encryptE2EEMessage,
  generateSafetyNumber,
} from "@/lib/e2ee/crypto";
import { realtimeSignaling } from "@/lib/e2ee/signaling";
import { webrtcManager } from "@/lib/webrtc/call-manager";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "@/components/motion/MessageBubble";
import MessageComposer from "@/components/motion/MessageComposer";
import CallOverlay from "@/components/motion/CallOverlay";
import TypingIndicator from "@/components/motion/TypingIndicator";
import AnimatedIconButton from "@/components/motion/AnimatedIconButton";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

interface PeerProfile {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  batchYear: number;
  verificationStatus: string;
  phone?: string | null;
  email?: string | null;
  institution?: { name: string } | null;
}

type MessagePrivacyMode =
  | "NORMAL"
  | "VIEW_ONCE"
  | "DISAPPEAR_30S"
  | "DISAPPEAR_5M"
  | "DISAPPEAR_1H"
  | "DISAPPEAR_24H";

export default function DirectMessageChatPage(props: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: peerId } = use(props.params);

  // States
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [messages, setMessages] = useState<VaultMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string>("");

  // Privacy & Trust States
  const [trustLevel, setTrustLevel] = useState<"UNKNOWN" | "REQUEST" | "CONNECTED" | "TRUSTED" | "BLOCKED">("REQUEST");
  const [connectionStatus, setConnectionStatus] = useState<"CONNECTED" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "NONE">("NONE");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isSafetyVerified, setIsSafetyVerified] = useState(false);
  const [keyRotatedWarning, setKeyRotatedWarning] = useState(false);
  const [peerReveals, setPeerReveals] = useState({ phone: false, email: false, work: false });
  const [myReveals, setMyReveals] = useState({ phone: false, email: false, work: false });
  const [messagePrivacy, setMessagePrivacy] = useState<MessagePrivacyMode>("NORMAL");
  const [screenNotice, setScreenNotice] = useState<string | null>(null);

  // Modals & Drawers
  const [showMenu, setShowMenu] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [viewedOnceSet, setViewedOnceSet] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<VaultMessage | null>(null);
  const [isConfidentialMode, setIsConfidentialMode] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("samparka_chat_confidential");
      if (saved === "true") setIsConfidentialMode(true);
    } catch {}
  }, []);

  const toggleConfidentialMode = () => {
    setIsConfidentialMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("samparka_chat_confidential", String(next));
      } catch {}
      triggerHaptic("medium");
      return next;
    });
  };

  // WebRTC Call Overlay States
  const [activeCall, setActiveCall] = useState<{
    isOpen: boolean;
    isVideo: boolean;
    isCaller: boolean;
    callStatus: "CONNECTING" | "RINGING" | "CONNECTED" | "ENDED";
  }>({
    isOpen: false,
    isVideo: false,
    isCaller: false,
    callStatus: "CONNECTING",
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Initialize Cryptographic Identity, Shared Key, Trust & Local Vault
  useEffect(() => {
    let unsubscribeMsg: (() => void) | null = null;
    let unsubscribeStatus: (() => void) | null = null;
    let unsubscribeTyping: (() => void) | null = null;

    async function setupChat() {
      try {
        setLoading(true);

        // Fetch current authenticated user
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (!meData.authenticated || !meData.user) {
          router.push("/auth");
          return;
        }
        const user = meData.user;
        setActiveVaultUser(user.id);
        setCurrentUser({ id: user.id, name: user.name });

        // Fetch peer profile from directory, trust, and connection relationship
        // cache: 'no-store' prevents stale data from showing wrong connection status after accept
        const [peerRes, trustRes, connRes] = await Promise.all([
          fetch(`/api/directory?id=${peerId}`, { cache: "no-store" }),
          fetch(`/api/contacts/trust?contactId=${peerId}`, { cache: "no-store" }),
          fetch(`/api/contacts/requests?targetUserId=${peerId}`, { cache: "no-store" }),
        ]);

        let relStatus: "CONNECTED" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "NONE" = "NONE";
        if (connRes.ok) {
          const cData = await connRes.json();
          if (cData.statusMap && cData.statusMap[peerId]) {
            relStatus = cData.statusMap[peerId];
          }
        }

        if (trustRes.ok) {
          const tData = await trustRes.json();
          if (tData.success) {
            setTrustLevel(tData.trustLevel);
            // Trust level from contactTrust table is authoritative — override statusMap if CONNECTED/TRUSTED
            if (tData.trustLevel === "CONNECTED" || tData.trustLevel === "TRUSTED") {
              relStatus = "CONNECTED";
            }
            setIsSafetyVerified(tData.isVerified);
            if (tData.peerReveals) setPeerReveals(tData.peerReveals);
            if (tData.myReveals) setMyReveals(tData.myReveals);
          }
        }

        setConnectionStatus(relStatus);

        if (peerRes.ok) {
          const pData = await peerRes.json();
          const target = pData.alumni?.find((u: PeerProfile) => u.id === peerId) || pData.alumni?.[0];
          if (target) {
            setPeer(target);
            // Only mark as locally connected peer in encrypted vault if CONNECTED
            if (relStatus === "CONNECTED") {
              addLocalConnectedPeer(peerId, user.id);
              window.dispatchEvent(new CustomEvent("connection-requests-updated"));
            }
          }
        }

        // Get or generate local device E2EE keys
        const localIdentity = await getOrCreateDeviceIdentity(user.id);
        setMyDeviceId(localIdentity.deviceId);

        // Register device public key on server
        await fetch("/api/messages/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: localIdentity.deviceId,
            deviceName: navigator.userAgent.slice(0, 50),
            publicKey: localIdentity.publicKeySpki,
          }),
        }).catch(() => {});

        // Fetch peer's registered device public keys
        const devRes = await fetch(`/api/messages/devices?userId=${peerId}`);
        const devData = await devRes.json();
        let peerPubKeySpki: string | null = null;

        if (devData.devices && devData.devices.length > 0 && devData.devices[0].publicKey) {
          peerPubKeySpki = devData.devices[0].publicKey;

          // Check if peer's public key rotated unexpectedly
          if (peerPubKeySpki) {
            const rotCheck = await checkPeerKeyRotation(peerId, peerPubKeySpki);
            if (rotCheck.changed) {
              setKeyRotatedWarning(true);
            }
          }
        } else {
          // Retry once in case server auto-provisioned
          const retryRes = await fetch(`/api/messages/devices?userId=${peerId}`);
          const retryData = await retryRes.json();
          if (retryData.devices && retryData.devices.length > 0 && retryData.devices[0].publicKey) {
            peerPubKeySpki = retryData.devices[0].publicKey;
          }
        }

        if (peerPubKeySpki) {
          const peerKey = await importPeerPublicKey(peerPubKeySpki);
          const derivedKey = await deriveSharedSessionKey(localIdentity.privateKey, peerKey);
          setSharedKey(derivedKey);

          // Compute 30-digit safety fingerprint
          const fingerprint = await generateSafetyNumber(
            localIdentity.publicKeySpki,
            peerPubKeySpki
          );
          setSafetyNumber(fingerprint);
        } else {
          // Auto-derive pairwise offline channel key so user can immediately send messages
          const fallbackKey = await derivePairwiseFallbackKey(user.id, peerId);
          setSharedKey(fallbackKey);
        }

        // Initialize Realtime Signaling
        realtimeSignaling.init(user.id, user.name, localIdentity.privateKey);

        // Load local decrypted chat history from IndexedDB
        const localMsgs = await getLocalMessages(peerId);
        setMessages(localMsgs);

        // Send read receipts for any unread incoming messages from peer
        const unreadFromPeer = localMsgs.filter((m) => m.senderId === peerId && m.status !== "READ");
        if (unreadFromPeer.length > 0) {
          const ids = unreadFromPeer.map((m) => m.id);
          realtimeSignaling.sendMessageStatus(peerId, ids, "READ");
          fetch("/api/messages/ack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: ids, senderId: peerId, status: "READ" }),
          }).catch(() => {});
        }

        // Listen for new incoming messages — register BEFORE draining queue
        // so that messages arriving during drain are caught by this listener.
        unsubscribeMsg = realtimeSignaling.onMessageReceived((msg) => {
          if (msg.peerId === peerId) {
            setMessages((prev) => {
              // De-duplicate: don't add if already present
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            scrollToBottom();
            // Acknowledge read receipt immediately as user is actively viewing the chat
            realtimeSignaling.sendMessageStatus(peerId, [msg.id], "READ");
            fetch("/api/messages/ack", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageIds: [msg.id], senderId: peerId, status: "READ" }),
            }).catch(() => {});
          }
        });

        // Drain any offline queued encrypted messages from server
        // (now that listener is registered above, drained messages will show in UI)
        await realtimeSignaling.drainPendingQueue();

        // Reload local messages after drain to pick up anything freshly decrypted
        const freshMsgs = await getLocalMessages(peerId);
        setMessages(freshMsgs);

        // Listen for delivery/read receipts
        unsubscribeStatus = realtimeSignaling.onStatusUpdated((msgId, status) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, status } : m))
          );
        });

        // Listen for typing indicator
        unsubscribeTyping = realtimeSignaling.onTyping((pId, isTyping) => {
          if (pId === peerId) {
            setIsPeerTyping(isTyping);
          }
        });
      } catch (err) {
        console.error("Error setting up encrypted chat:", err);
      } finally {
        setLoading(false);
      }
    }

    setupChat();

    return () => {
      if (unsubscribeMsg) unsubscribeMsg();
      if (unsubscribeStatus) unsubscribeStatus();
      if (unsubscribeTyping) unsubscribeTyping();
    };
  }, [peerId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Screen capture & screenshot announcement listener (Snapchat-style in-chat alert)
  // Also: reload messages when user returns to tab (picks up offline-delivered messages)
  useEffect(() => {
    let lastAlertTime = 0;

    const announceScreenshot = async (whoName: string, isFromMe: boolean) => {
      const now = Date.now();
      if (now - lastAlertTime < 3500) return;
      lastAlertTime = now;

      triggerHaptic("heavy");

      const alertText = isFromMe
        ? "📸 You took a screenshot of the chat"
        : `📸 ${whoName} took a screenshot of the chat`;

      const alertMsg: VaultMessage = {
        id: `screenshot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        peerId,
        senderId: isFromMe ? (currentUser?.id || "me") : peerId,
        senderName: isFromMe ? "You" : whoName,
        text: alertText,
        type: "TEXT",
        status: "SENT",
        createdAt: Date.now(),
      };

      try {
        await saveLocalMessage(alertMsg);
        setMessages((prev) => {
          if (prev.some((m) => m.id === alertMsg.id)) return prev;
          return [...prev, alertMsg];
        });
        scrollToBottom();
      } catch {}

      // Broadcast to peer via E2EE signaling
      if (isFromMe && sharedKey && currentUser) {
        try {
          const peerNotice = `📸 ${currentUser.name || "Peer"} took a screenshot of the chat`;
          const structuredPayload = JSON.stringify({
            text: peerNotice,
            type: "TEXT",
            privacyMode: "NORMAL",
          });
          const encPayload = await encryptE2EEMessage(sharedKey, structuredPayload);
          realtimeSignaling.sendEncryptedMessage(peerId, {
            queueId: alertMsg.id,
            encryptedPayload: encPayload,
            messageType: "TEXT",
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }
    };

    const handleScreenshotEvent = () => {
      announceScreenshot(currentUser?.name || "You", true);
    };

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // App backgrounded / window minimized
      } else {
        // Tab became visible again — reload local messages
        const freshMsgs = await getLocalMessages(peerId);
        setMessages(freshMsgs);
        scrollToBottom();
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.key === "PrintScreen" ||
        e.code === "PrintScreen" ||
        (e.metaKey && e.shiftKey) ||
        (e.ctrlKey && e.shiftKey)
      ) {
        announceScreenshot(currentUser?.name || "You", true);
      }
    };

    window.addEventListener("samparka:screenshot-detected", handleScreenshotEvent);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeydown, true);
    return () => {
      window.removeEventListener("samparka:screenshot-detected", handleScreenshotEvent);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeydown, true);
    };
  }, [currentUser, peerId, sharedKey]);

  // Handle typing status broadcast
  const handleInputChange = (val: string) => {
    setInputText(val);
    realtimeSignaling.sendTypingStatus(peerId, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      realtimeSignaling.sendTypingStatus(peerId, false);
    }, 1500);
  };

  // Helper to map privacy mode to expiring seconds
  const getDisappearingSeconds = (mode: MessagePrivacyMode): number | undefined => {
    switch (mode) {
      case "DISAPPEAR_30S":
        return 30;
      case "DISAPPEAR_5M":
        return 300;
      case "DISAPPEAR_1H":
        return 3600;
      case "DISAPPEAR_24H":
        return 86400;
      case "VIEW_ONCE":
        return 1; // Burns immediately
      default:
        return undefined;
    }
  };

  // 2. Send End-to-End Encrypted Message
  const handleSendMessage = async (textOrEvent?: React.FormEvent | string) => {
    let cleanText = "";
    if (typeof textOrEvent === "string") {
      cleanText = textOrEvent.trim();
    } else {
      if (textOrEvent && typeof (textOrEvent as React.FormEvent).preventDefault === "function") {
        (textOrEvent as React.FormEvent).preventDefault();
      }
      cleanText = inputText.trim();
    }

    if (!cleanText || !currentUser) return;

    if (connectionStatus !== "CONNECTED") {
      alert("Messaging is locked until the connection request is accepted.");
      return;
    }

    // Lazily fetch shared key if not yet derived (peer may have registered their key
    // after this chat was opened, or the initial fetch returned empty devices).
    let activeSharedKey = sharedKey;
    if (!activeSharedKey) {
      try {
        const devRes = await fetch(`/api/messages/devices?userId=${peerId}`);
        const devData = await devRes.json();
        if (devData.devices && devData.devices.length > 0 && devData.devices[0].publicKey) {
          const localIdentity = await getOrCreateDeviceIdentity(currentUser.id);
          const peerKey = await importPeerPublicKey(devData.devices[0].publicKey);
          activeSharedKey = await deriveSharedSessionKey(localIdentity.privateKey, peerKey);
          setSharedKey(activeSharedKey);
        }
      } catch {
        // key fetch failed — proceed without encryption (will fail at encrypt step)
      }
    }

    if (!activeSharedKey) {
      try {
        activeSharedKey = await derivePairwiseFallbackKey(currentUser.id, peerId);
        setSharedKey(activeSharedKey);
      } catch (err) {
        console.warn("Fallback offline key derivation error:", err);
      }
    }

    if (replyingTo) {
      cleanText = `↪️ Replying to "${replyingTo.text.slice(0, 30)}${replyingTo.text.length > 30 ? "..." : ""}":\n${cleanText}`;
      setReplyingTo(null);
    }

    setSending(true);
    setInputText("");

    try {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expireSec = getDisappearingSeconds(messagePrivacy);
      const expiresAt = expireSec ? Date.now() + expireSec * 1000 : undefined;

      const structuredPayload = JSON.stringify({
        id: msgId,
        text: cleanText,
        senderName: currentUser.name,
        privacyMode: messagePrivacy,
        disappearingSeconds: expireSec,
      });

      if (!activeSharedKey) {
        activeSharedKey = await derivePairwiseFallbackKey(currentUser.id, peerId);
        setSharedKey(activeSharedKey);
      }

      // 1. Encrypt locally using AES-256-GCM
      const encrypted = await encryptE2EEMessage(activeSharedKey, structuredPayload);

      // 2. Save locally in client vault
      const localMsg: VaultMessage = {
        id: msgId,
        peerId,
        senderId: currentUser.id,
        text: cleanText,
        type: "TEXT",
        status: "SENDING",
        createdAt: Date.now(),
        expiresAt,
        disappearingSeconds: expireSec,
        privacyMode: messagePrivacy,
      };

      await saveLocalMessage(localMsg);
      setMessages((prev) => [...prev, localMsg]);
      scrollToBottom();

      // 3. Direct real-time WebSocket broadcast to recipient (Instant delivery under 10ms, identical to typing indicator)
      realtimeSignaling.sendEncryptedMessage(peerId, {
        queueId: msgId,
        encryptedPayload: encrypted,
        messageType: "TEXT",
        createdAt: new Date().toISOString(),
      });

      // 4. Relay encrypted payload to server queue (Persisted for 2 days) & push notification
      const activeDeviceId = myDeviceId || "device_web_identity";
      const res = await fetch("/api/messages/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: peerId,
          senderDeviceId: activeDeviceId,
          encryptedPayload: encrypted,
          messageType: "TEXT",
        }),
      });

      // 4. Update status: If relayed successfully to server, status is Single Tick (SENT).
      // Genuine DELIVERED and READ ticks arrive via peer WebSocket acknowledgment.
      if (res.ok) {
        localMsg.status = "SENT";
        await saveLocalMessage(localMsg);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "SENT" } : m))
        );
      } else {
        localMsg.status = "FAILED";
        await saveLocalMessage(localMsg);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "FAILED" } : m))
        );
      }
    } catch (err) {
      console.error("Error sending encrypted message:", err);
    } finally {
      setSending(false);
    }
  };

  // View-Once Handler
  const handleRevealViewOnce = async (msg: VaultMessage) => {
    setViewedOnceSet((prev) => new Set(prev).add(msg.id));
    // Burn from local storage after 8 seconds
    setTimeout(async () => {
      await markMessageBurned(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }, 8000);
  };

  // Connection Request Actions (QR and Direct Message Protection)
  const handleSendConnectionRequest = async () => {
    if (!currentUser || actionLoading) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: peerId, action: "REQUEST" }),
      });
      const data = await res.json();
      if (data.status === "CONNECTED" || data.status === "ACCEPTED") {
        setConnectionStatus("CONNECTED");
        setTrustLevel("CONNECTED");
        addLocalConnectedPeer(peerId, currentUser.id);
        setActionNotice("Connected! You can now send messages.");
      } else {
        setConnectionStatus("PENDING_OUTGOING");
        setActionNotice("Connection request sent! Once accepted, messaging will be unlocked.");
      }
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (e) {
      console.warn("Connect request error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptConnectionRequest = async () => {
    if (!currentUser || actionLoading) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: peerId, action: "ACCEPT" }),
      });
      if (res.ok) {
        setConnectionStatus("CONNECTED");
        setTrustLevel("CONNECTED");
        addLocalConnectedPeer(peerId, currentUser.id);
        setActionNotice("Connection accepted! Messaging is now unlocked.");
        window.dispatchEvent(new CustomEvent("connection-requests-updated"));
      }
    } catch (e) {
      console.warn("Accept request error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Trust Handshake Actions
  const handleUpdateTrust = async (newLevel: "CONNECTED" | "TRUSTED" | "BLOCKED") => {
    try {
      const res = await fetch("/api/contacts/trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: peerId,
          trustLevel: newLevel,
        }),
      });
      if (res.ok) {
        setTrustLevel(newLevel);
        if (newLevel === "CONNECTED" || newLevel === "TRUSTED") {
          setConnectionStatus("CONNECTED");
          if (currentUser) {
            addLocalConnectedPeer(peerId, currentUser.id);
          }
          // Sync to /api/contacts/connect so connectionRequest table is marked ACCEPTED
          await fetch("/api/contacts/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: peerId, action: "ACCEPT" }),
          }).catch(() => {});
          window.dispatchEvent(new CustomEvent("connection-requests-updated"));
        }
      }
    } catch (e) {
      console.error("Failed to update trust level:", e);
    }
  };

  // Mark Safety Number Verified
  const handleConfirmSafetyVerification = async () => {
    if (!safetyNumber) return;
    try {
      await verifyContactSafety(peerId, true);
      await fetch("/api/contacts/trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: peerId,
          verifiedFingerprint: safetyNumber,
        }),
      });
      setIsSafetyVerified(true);
      setShowSafetyModal(false);
    } catch (e) {
      console.error("Failed to confirm safety number:", e);
    }
  };

  // Toggle Mutual Reveal Fields
  const handleToggleReveal = async (field: "phone" | "email" | "work") => {
    const updated = { ...myReveals, [field]: !myReveals[field] };
    setMyReveals(updated);
    try {
      await fetch("/api/contacts/trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: peerId,
          revealedPhone: updated.phone,
          revealedEmail: updated.email,
          revealedWork: updated.work,
        }),
      });
    } catch (e) {
      console.error("Failed to update reveal setting:", e);
    }
  };

  // Set up WebRTC signaling & media stream listeners
  useEffect(() => {
    webrtcManager.setCallbacks({
      onStateChange: (state, session) => {
        if (state === "IDLE" || state === "ENDED") {
          setActiveCall((prev) => ({ ...prev, isOpen: false, callStatus: "ENDED" }));
          setLocalStream(null);
          setRemoteStream(null);
        } else {
          setActiveCall({
            isOpen: true,
            isVideo: session?.callType === "VIDEO",
            isCaller: !session?.isIncoming,
            callStatus:
              state === "CALLING" || state === "RINGING"
                ? "RINGING"
                : state === "CONNECTED"
                ? "CONNECTED"
                : "CONNECTING",
          });
          setLocalStream(webrtcManager.getLocalStream());
        }
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
      },
      onSendSignal: (msg) => {
        realtimeSignaling.sendSignalToPeer(peerId, msg);
      },
    });
  }, []);

  // Start Voice Call (Enforces Trust Level)
  const handleStartVoiceCall = async () => {
    if (trustLevel === "REQUEST" || trustLevel === "UNKNOWN") {
      alert("Please accept and connect with this contact before starting voice calls.");
      return;
    }
    triggerHaptic("medium");
    setActiveCall({
      isOpen: true,
      isVideo: false,
      isCaller: true,
      callStatus: "CONNECTING",
    });
    await webrtcManager.startCall(peerId, peer?.name || "Alumni Contact", "VOICE");
    setLocalStream(webrtcManager.getLocalStream());
  };

  // Start Video Call (Enforces Trust Level)
  const handleStartVideoCall = async () => {
    if (trustLevel === "REQUEST" || trustLevel === "UNKNOWN") {
      alert("Please accept and connect with this contact before starting video calls.");
      return;
    }
    triggerHaptic("medium");
    setActiveCall({
      isOpen: true,
      isVideo: true,
      isCaller: true,
      callStatus: "CONNECTING",
    });
    await webrtcManager.startCall(peerId, peer?.name || "Alumni Contact", "VIDEO");
    setLocalStream(webrtcManager.getLocalStream());
  };

  // Clear Chat History
  const handleClearHistory = async () => {
    if (confirm("Delete all message history for this chat from this device?")) {
      await clearLocalConversation(peerId);
      setMessages([]);
      setShowMenu(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-100 max-w-2xl mx-auto w-full border-x border-slate-200/60 shadow-xl relative overflow-hidden">
      {/* Screen Notice Heuristic Toast */}
      {screenNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-2xl bg-slate-900/90 text-white text-xs font-medium backdrop-blur shadow-lg flex items-center gap-2">
          <Scan className="w-3.5 h-3.5 text-amber-400" />
          <span>{screenNotice}</span>
        </div>
      )}

      {/* Top Frosted Glass Header with Safe-Area Notch Inset */}
      <header className="sticky top-0 z-30 glass-header px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            href="/messages"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 flex items-center justify-center text-slate-700 transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>

          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-xs shadow-blue-500/20 shrink-0 overflow-hidden">
            {peer?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={peer.avatarUrl}
                alt={peer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              peer?.name?.charAt(0).toUpperCase() || "A"
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {peer?.name || "Alumni Contact"}
              </h2>
              {isSafetyVerified ? (
                <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded shrink-0" title="Cryptographically Verified">
                  <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" /> Verified
                </span>
              ) : (
                peer?.verificationStatus === "VERIFIED" && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
              {isPeerTyping ? (
                <span className="text-blue-600 font-semibold animate-pulse">Typing...</span>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">E2EE Protected</span>
                  {messagePrivacy !== "NORMAL" && (
                    <span className="text-amber-600 font-bold shrink-0">🔥 Ephemeral</span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Confidential Shield, Voice Call, Video Call, Menu */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-1">
          <button
            onClick={toggleConfidentialMode}
            className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center transition ${
              isConfidentialMode
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-600"
            }`}
            title={isConfidentialMode ? "Confidential Shield Active (Hover/tap to reveal)" : "Enable Confidential Anti-Screenshot Shield"}
          >
            {isConfidentialMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={handleStartVoiceCall}
            disabled={trustLevel === "REQUEST" || trustLevel === "UNKNOWN" || connectionStatus !== "CONNECTED"}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-100/80 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center transition disabled:opacity-40"
            title={connectionStatus !== "CONNECTED" ? "Connect to enable calls" : "Voice Call"}
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={handleStartVideoCall}
            disabled={trustLevel === "REQUEST" || trustLevel === "UNKNOWN" || connectionStatus !== "CONNECTED"}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-100/80 hover:bg-blue-50 hover:text-blue-600 text-slate-600 flex items-center justify-center transition disabled:opacity-40"
            title={connectionStatus !== "CONNECTED" ? "Connect to enable calls" : "Video Call"}
          >
            <Video className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 flex items-center justify-center transition relative"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Confidential Anti-Screenshot Shield Active Banner */}
      {isConfidentialMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 text-[11px] text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold">
            <EyeOff className="w-3.5 h-3.5 text-amber-600" />
            <span>Confidential Shield Active • Messages blurred until hovered or held</span>
          </div>
          <button
            onClick={toggleConfidentialMode}
            className="text-[10px] font-bold text-amber-700 hover:underline ml-2"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Security Identity Changed Alert */}
      {keyRotatedWarning && (
        <div className="bg-amber-500/95 backdrop-blur-md text-white px-3.5 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
            <span className="truncate">Identity key changed. Verify fingerprint.</span>
          </div>
          <button
            onClick={() => setShowSafetyModal(true)}
            className="px-2 py-0.5 rounded-lg bg-white text-amber-900 font-bold text-[10px] shrink-0 ml-2"
          >
            Verify
          </button>
        </div>
      )}

      {/* Responsive Glassmorphic Trust Handshake Banner */}
      {(trustLevel === "REQUEST" || trustLevel === "UNKNOWN") && (
        <div className="bg-blue-50/90 backdrop-blur-md border-b border-blue-200/70 p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-blue-950 text-[11px] leading-tight">
              <strong>Message Request:</strong> Limited profile visible. Connect to unlock voice & video calling.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto w-full sm:w-auto">
            <button
              onClick={() => handleUpdateTrust("CONNECTED")}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition shadow-xs active:scale-98"
            >
              Accept & Connect
            </button>
            <button
              onClick={() => handleUpdateTrust("BLOCKED")}
              className="px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-medium text-[11px] transition active:scale-98"
            >
              Block
            </button>
          </div>
        </div>
      )}

      {/* Options Dropdown Menu */}
      {showMenu && (
        <div className="absolute top-14 right-4 z-40 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 text-xs divide-y divide-slate-100">
          <div className="py-1">
            <button
              onClick={() => {
                toggleConfidentialMode();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-700"
            >
              {isConfidentialMode ? (
                <>
                  <Eye className="w-4 h-4 text-amber-600" />
                  <span>Disable Confidential Shield</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-600" />
                  <span>Enable Confidential Shield</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowSafetyModal(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-700"
            >
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>Verify Safety Fingerprint</span>
            </button>
            <button
              onClick={() => {
                setShowRevealModal(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-700"
            >
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>Reveal More Profile Info</span>
            </button>
            {trustLevel !== "TRUSTED" ? (
              <button
                onClick={() => {
                  handleUpdateTrust("TRUSTED");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium text-emerald-700"
              >
                <UserCheck className="w-4 h-4" />
                <span>Mark as Trusted Contact</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  handleUpdateTrust("CONNECTED");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-600"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Trusted (Tap to Standard)</span>
              </button>
            )}
          </div>

          <div className="py-1">
            <button
              onClick={handleClearHistory}
              className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Local History</span>
            </button>
            <button
              onClick={() => {
                handleUpdateTrust("BLOCKED");
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium"
            >
              <UserX className="w-4 h-4" />
              <span>Block Contact</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Ephemeral Mode Indicator */}
      {messagePrivacy !== "NORMAL" && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 text-[11px] font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 fill-white text-white" />
            <span>
              Ephemeral Active: {messagePrivacy === "VIEW_ONCE" ? "View-Once (burns immediately)" : messagePrivacy.replace("DISAPPEAR_", "Auto-delete in ")}
            </span>
          </div>
          <button
            onClick={() => setMessagePrivacy("NORMAL")}
            className="text-white hover:underline text-[10px]"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2.5 scroll-smooth overscroll-contain">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs font-medium">Establishing secure E2EE channel...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3.5 max-w-sm mx-auto px-2">
            <div className="glass-card p-5 sm:p-6 rounded-3xl text-center space-y-3 w-full border border-white/80 shadow-md">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  End-to-End Encrypted Session
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Secured with NIST P-256 ECDH + AES-256-GCM. Decryption keys never leave your device.
                </p>
              </div>

              {/* Revealed Profile Info Badges if any */}
              {(peerReveals.phone || peerReveals.email || peerReveals.work) && (
                <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 text-left text-xs space-y-1.5 w-full">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Profile shared by {peer?.name}:
                  </p>
                  {peerReveals.phone && peer?.phone && <p className="font-semibold text-slate-800">📱 {peer.phone}</p>}
                  {peerReveals.email && peer?.email && <p className="font-semibold text-slate-800">✉️ {peer.email}</p>}
                  {peerReveals.work && (peer?.currentRole || peer?.currentCompany) && (
                    <p className="font-semibold text-slate-800">
                      💼 {peer.currentRole || "Alumni"}{peer.currentCompany ? ` at ${peer.currentCompany}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUser?.id;
            const isViewOnce = m.privacyMode === "VIEW_ONCE";
            const isBurned = isViewOnce && viewedOnceSet.has(m.id);

            return (
              <MessageBubble
                key={m.id}
                message={m}
                isMe={isMe}
                isViewOnce={isViewOnce}
                isBurned={isBurned}
                isConfidential={isConfidentialMode}
                onRevealViewOnce={handleRevealViewOnce}
                onReply={(msg) => {
                  setReplyingTo(msg);
                  triggerHaptic("light");
                }}
                onDelete={(id) => {
                  deleteLocalMessage(id);
                  setMessages((prev) => prev.filter((msg) => msg.id !== id));
                }}
              />
            );
          })
        )}

        {isPeerTyping && (
          <div className="py-1">
            <TypingIndicator name={peer?.name} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Tactile Message Composer or Connection Request Guard */}
      {connectionStatus === "CONNECTED" ? (
        <MessageComposer
          inputText={inputText}
          onInputChange={handleInputChange}
          onSend={(text) => handleSendMessage(text)}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          privacyMode={messagePrivacy}
          onPrivacyModeChange={setMessagePrivacy}
          disabled={trustLevel === "BLOCKED"}
        />
      ) : (
        <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 pb-6 transition-all">
          <div className="max-w-md mx-auto rounded-2xl border p-4 shadow-xs text-center space-y-3 bg-slate-50/80 border-slate-200/80">
            {connectionStatus === "PENDING_OUTGOING" && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                  Connection Request Pending
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You sent a connection request to <strong className="font-semibold text-slate-900">{peer?.name || "this alumni"}</strong>. Once they accept your request, both of you can chat.
                </p>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>Messaging will automatically unlock upon acceptance</span>
                </div>
              </>
            )}

            {connectionStatus === "PENDING_INCOMING" && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                  <UserPlus className="w-3.5 h-3.5" />
                  Incoming Connection Request
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-semibold text-slate-900">{peer?.name || "This alumni"}</strong> sent you a connection request. Accept to start messaging.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={handleAcceptConnectionRequest}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    Accept Request &amp; Start Chat
                  </button>
                </div>
              </>
            )}

            {connectionStatus === "NONE" && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  Messaging Locked
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Send a connection request to <strong className="font-semibold text-slate-900">{peer?.name || "this alumni"}</strong>. Once accepted, both of you will be able to message.
                </p>
                <button
                  onClick={handleSendConnectionRequest}
                  disabled={actionLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Send Connection Request
                </button>
              </>
            )}

            {actionNotice && (
              <p className="text-[11px] font-medium text-indigo-600 mt-1">
                {actionNotice}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2026 Immersive Call HUD Overlay */}
      <CallOverlay
        isOpen={activeCall.isOpen}
        peerName={peer?.name || "Alumni Contact"}
        peerRole={peer?.currentRole ? `${peer.currentRole}${peer.currentCompany ? ` at ${peer.currentCompany}` : ""}` : undefined}
        isVideo={activeCall.isVideo}
        isCaller={activeCall.isCaller}
        callStatus={activeCall.callStatus}
        localStream={localStream}
        remoteStream={remoteStream}
        onEndCall={() => {
          webrtcManager.endCall(true);
          setActiveCall((prev) => ({ ...prev, isOpen: false }));
        }}
        onToggleMute={() => webrtcManager.toggleMute()}
        onToggleVideo={() => webrtcManager.toggleVideo()}
      />

      {/* Safety Number Verification Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-slate-900">Safety Fingerprint Verification</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Compare this 30-digit cryptographic fingerprint with <strong>{peer?.name}</strong> in person or over video to confirm no MITM tampering:
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-800 tracking-wider">
              {safetyNumber || "Calculating fingerprint..."}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSafetyVerification}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark as Verified</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reveal More Info Modal */}
      {showRevealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Mutual Profile Reveal</h3>
              <button
                onClick={() => setShowRevealModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              By default, contacts only see your username and alumni batch. Select what you would like to reveal to <strong>{peer?.name}</strong>:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Phone Number</p>
                  <p className="text-[10px] text-slate-400">Share your mobile contact</p>
                </div>
                <input
                  type="checkbox"
                  checked={myReveals.phone}
                  onChange={() => handleToggleReveal("phone")}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Email Address</p>
                  <p className="text-[10px] text-slate-400">Share your email contact</p>
                </div>
                <input
                  type="checkbox"
                  checked={myReveals.email}
                  onChange={() => handleToggleReveal("email")}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Current Role & Company</p>
                  <p className="text-[10px] text-slate-400">Share your workplace info</p>
                </div>
                <input
                  type="checkbox"
                  checked={myReveals.work}
                  onChange={() => handleToggleReveal("work")}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
