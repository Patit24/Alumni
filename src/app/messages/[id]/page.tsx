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
  UserX,
  UserMinus,
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
  removeLocalConnectedPeer,
  getLocalConnectedPeerIds,
  setActiveVaultUser,
  getActiveVaultUserId,
  getCachedConnectionProfiles,
  cacheConnectionProfiles,
  VaultMessage,
} from "@/lib/e2ee/vault";
import { authFetch } from "@/lib/auth-fetch";
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

function reconcileMessages(
  existing: VaultMessage[],
  incoming: VaultMessage[]
): VaultMessage[] {
  const map = new Map<string, VaultMessage>();

  // 1. Populate map with existing messages
  for (const m of existing) {
    map.set(m.id, m);
  }

  // 2. Process incoming messages
  for (const inc of incoming) {
    // Exact ID match
    if (map.has(inc.id)) {
      const current = map.get(inc.id)!;
      map.set(inc.id, { ...current, ...inc });
      continue;
    }

    // Match optimistic in-flight message by clientMsgId or matching IDs
    let matchedId: string | null = null;
    for (const [id, m] of map.entries()) {
      if (
        (inc.clientMsgId && (m.clientMsgId === inc.clientMsgId || id === inc.clientMsgId)) ||
        (m.clientMsgId && (m.clientMsgId === inc.id || id === inc.id))
      ) {
        matchedId = id;
        break;
      }
    }

    if (matchedId) {
      console.log(`[RECONCILE] Optimistic ${matchedId} reconciled with server ${inc.id}`);
      const prev = map.get(matchedId)!;
      map.delete(matchedId);
      map.set(inc.id, { ...prev, ...inc });
    } else {
      map.set(inc.id, inc);
    }
  }

  // 3. Return strictly sorted by chronological timestamp
  return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
}

export default function DirectMessageChatPage(props: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: peerId } = use(props.params);

  // States: synchronously read cached identity to prevent layout/alignment flash
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("alumni_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) return { id: parsed.id, name: parsed.name || "" };
        }
        const activeId = getActiveVaultUserId();
        if (activeId) return { id: activeId, name: "" };
      } catch {}
    }
    return null;
  });

  const [peer, setPeer] = useState<PeerProfile | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const activeId = getActiveVaultUserId();
        const cached = getCachedConnectionProfiles(activeId || undefined);
        const found = cached.find((p: any) => p?.id === peerId);
        if (found && found.name && found.name.trim() !== "Alumni Member") {
          return {
            id: found.id,
            name: found.name,
            username: found.username,
            avatarUrl: found.avatarUrl,
            batchYear: found.batchYear,
            currentRole: found.currentRole,
            currentCompany: found.currentCompany,
            city: found.city,
            verificationStatus: found.verificationStatus || "VERIFIED",
            institution: found.institution,
          };
        }
      } catch {}
    }
    return null;
  });
  const [messages, setMessages] = useState<VaultMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const oldestTimestampRef = useRef<number | null>(null);
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



  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore || !oldestTimestampRef.current) return;
    setLoadingMore(true);
    try {
      const res = await authFetch(
        `/api/messages?peerId=${peerId}&limit=40&before=${new Date(oldestTimestampRef.current).toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const olderMsgs: VaultMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            clientMsgId: m.clientMsgId,
            peerId,
            senderId: m.senderId,
            senderName: m.senderName,
            text: m.content,
            type: m.messageType === "EMOJI" ? "EMOJI" : "TEXT",
            replyToId: m.replyToId,
            replySnippet: m.replySnippet,
            status: m.status || "SENT",
            createdAt: new Date(m.createdAt).getTime() || Date.now(),
            disappearingSeconds: m.disappearingSeconds,
          }));
          oldestTimestampRef.current = olderMsgs[0]?.createdAt || null;
          setHasMore(Boolean(data.hasMore));
          setMessages((prev) => reconcileMessages(prev, olderMsgs));
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.warn("Failed to load older messages:", err);
    } finally {
      setLoadingMore(false);
    }
  };

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
        const meRes = await authFetch("/api/auth/me");
        const meData = await meRes.json();
        if (!meData.authenticated || !meData.user) {
          router.push("/auth");
          return;
        }
        const user = meData.user;
        setActiveVaultUser(user.id);
        setCurrentUser({ id: user.id, name: user.name });

        // Check local peer vault first
        const localPeers = getLocalConnectedPeerIds(user.id);
        const isLocallyConnected = localPeers.includes(peerId);

        // Fetch peer profile from directory, trust, and canonical connection relationship
        const [peerRes, trustRes, connRes] = await Promise.all([
          authFetch(`/api/directory?id=${peerId}`, { cache: "no-store" }),
          authFetch(`/api/contacts/trust?contactId=${peerId}`, { cache: "no-store" }),
          authFetch(`/api/connections?targetUserId=${peerId}`, { cache: "no-store" }),
        ]);

        let relStatus: "CONNECTED" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "NONE" = isLocallyConnected ? "CONNECTED" : "NONE";
        if (connRes.ok) {
          const cData = await connRes.json();
          const rel = cData.relationship;
          if (rel) {
            if (rel.status === "CONNECTED" || rel.isConnection) {
              relStatus = "CONNECTED";
            } else if (rel.status === "PENDING_OUTGOING") {
              relStatus = "PENDING_OUTGOING";
            } else if (rel.status === "PENDING_INCOMING") {
              relStatus = "PENDING_INCOMING";
            }
          }
        }

        if (trustRes.ok) {
          const tData = await trustRes.json();
          if (tData.success) {
            if (relStatus === "CONNECTED") {
              setTrustLevel(tData.trustLevel === "TRUSTED" ? "TRUSTED" : "CONNECTED");
            } else {
              setTrustLevel("REQUEST");
            }
            setIsSafetyVerified(tData.isVerified);
            if (tData.peerReveals) setPeerReveals(tData.peerReveals);
            if (tData.myReveals) setMyReveals(tData.myReveals);
          }
        }

        setConnectionStatus(relStatus);

        const cachedProfiles = getCachedConnectionProfiles(user.id);
        const cachedPeer = cachedProfiles.find((p: any) => p?.id === peerId);

        if (peerRes.ok) {
          const pData = await peerRes.json();
          // Never fall back to pData.alumni[0] which could belong to another user!
          const target = pData.alumni?.find((u: PeerProfile) => u.id === peerId);
          if (target) {
            const safeName = (target.name && target.name.trim() !== "Alumni Member")
              ? target.name
              : (cachedPeer?.name || target.name || "Alumni Member");
            const safeAvatar = target.avatarUrl || cachedPeer?.avatarUrl;
            const fullPeer: PeerProfile = {
              ...target,
              name: safeName,
              avatarUrl: safeAvatar,
            };
            setPeer(fullPeer);
            cacheConnectionProfiles([fullPeer], user.id);

            // Only mark as locally connected peer in encrypted vault if CONNECTED
            if (relStatus === "CONNECTED") {
              addLocalConnectedPeer(peerId, user.id);
              window.dispatchEvent(new CustomEvent("connection-requests-updated"));
            }
          } else if (cachedPeer) {
            setPeer(cachedPeer);
          }
        } else if (cachedPeer) {
          setPeer(cachedPeer);
        }

        // Get or generate local device E2EE keys
        const localIdentity = await getOrCreateDeviceIdentity(user.id);
        setMyDeviceId(localIdentity.deviceId);

        // Register device public key on server
        await authFetch("/api/messages/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: localIdentity.deviceId,
            deviceName: navigator.userAgent.slice(0, 50),
            publicKey: localIdentity.publicKeySpki,
          }),
        }).catch(() => {});

        // Fetch peer's registered device public keys
        const devRes = await authFetch(`/api/messages/devices?userId=${peerId}`);
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
          const retryRes = await authFetch(`/api/messages/devices?userId=${peerId}`);
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

        // 1. Fast cache load from local vault
        const localMsgs = await getLocalMessages(peerId);
        if (localMsgs.length > 0) {
          setMessages(localMsgs);
        }

        // 2. Fetch authoritative messages from server
        try {
          const res = await authFetch(`/api/messages?peerId=${peerId}&limit=50`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.messages)) {
              const serverMsgs: VaultMessage[] = data.messages.map((m: any) => ({
                id: m.id,
                clientMsgId: m.clientMsgId,
                peerId,
                senderId: m.senderId,
                senderName: m.senderName,
                text: m.content,
                type: m.messageType === "EMOJI" ? "EMOJI" : "TEXT",
                replyToId: m.replyToId,
                replySnippet: m.replySnippet,
                status: m.status || "SENT",
                createdAt: new Date(m.createdAt).getTime() || Date.now(),
                disappearingSeconds: m.disappearingSeconds,
              }));

              // Sync to local cache
              for (const sm of serverMsgs) {
                saveLocalMessage(sm).catch(() => {});
              }

              setMessages((prev) => reconcileMessages(prev, serverMsgs));
              if (data.oldestTimestamp) {
                oldestTimestampRef.current = new Date(data.oldestTimestamp).getTime();
              }
              setHasMore(Boolean(data.hasMore));
            }
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch authoritative messages:", fetchErr);
        }

        // Listen for new incoming messages & multi-session outbound messages
        unsubscribeMsg = realtimeSignaling.onMessageReceived((msg) => {
          if (msg.peerId === peerId) {
            console.log(`[REALTIME RECEIVE] Chat received message:`, msg.id);
            setMessages((prev) => reconcileMessages(prev, [msg]));
            scrollToBottom();

            // Acknowledge read receipt immediately if from peer
            if (msg.senderId === peerId && msg.status !== "READ") {
              realtimeSignaling.sendMessageStatus(peerId, [msg.id], "READ");
              fetch("/api/messages/status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageIds: [msg.id], senderId: peerId, status: "READ" }),
              }).catch(() => {});
            }
          }
        });

        // Background drain of legacy offline encrypted messages
        realtimeSignaling.drainPendingQueue().catch(() => {});

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
      if (!document.hidden) {
        // Tab became visible again — sync incremental messages from server
        try {
          const res = await authFetch(`/api/messages?peerId=${peerId}&limit=40`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.messages)) {
              const freshServerMsgs: VaultMessage[] = data.messages.map((m: any) => ({
                id: m.id,
                clientMsgId: m.clientMsgId,
                peerId,
                senderId: m.senderId,
                senderName: m.senderName,
                text: m.content,
                type: m.messageType === "EMOJI" ? "EMOJI" : "TEXT",
                replyToId: m.replyToId,
                replySnippet: m.replySnippet,
                status: m.status || "SENT",
                createdAt: new Date(m.createdAt).getTime() || Date.now(),
                disappearingSeconds: m.disappearingSeconds,
              }));
              setMessages((prev) => reconcileMessages(prev, freshServerMsgs));
            }
          }
        } catch {}
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
      alert("You cannot send messages until your connection request is accepted.");
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
      const clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expireSec = getDisappearingSeconds(messagePrivacy);
      const expiresAt = expireSec ? Date.now() + expireSec * 1000 : undefined;

      // 1. Instant optimistic UI render (0ms latency)
      const optimisticMsg: VaultMessage = {
        id: clientMsgId,
        clientMsgId,
        peerId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: cleanText,
        type: "TEXT",
        status: "SENDING",
        createdAt: Date.now(),
        expiresAt,
        disappearingSeconds: expireSec,
        privacyMode: messagePrivacy,
        replyToId: replyingTo?.id,
        replySnippet: replyingTo?.text ? replyingTo.text.slice(0, 40) : undefined,
      };

      console.log(`[MESSAGE SEND] Sending optimistic message:`, clientMsgId);
      setMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();
      saveLocalMessage(optimisticMsg).catch(() => {});

      // 2. Authoritative server POST (Persisted in SQLite database & broadcast to both recipient & sender)
      const res = await authFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: peerId,
          content: cleanText,
          clientMsgId,
          replyToId: replyingTo?.id,
          replySnippet: replyingTo?.text ? replyingTo.text.slice(0, 40) : undefined,
          disappearingSeconds: expireSec,
          messageType: "TEXT",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const serverMsg = data.message;
        const confirmedMsg: VaultMessage = {
          id: serverMsg.id,
          clientMsgId: serverMsg.clientMsgId || clientMsgId,
          peerId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          text: serverMsg.content,
          type: "TEXT",
          status: "SENT",
          createdAt: new Date(serverMsg.createdAt).getTime(),
          expiresAt,
          disappearingSeconds: expireSec,
          privacyMode: messagePrivacy,
          replyToId: serverMsg.replyToId,
          replySnippet: serverMsg.replySnippet,
        };

        console.log(`[MESSAGE SERVER CONFIRMED] Server confirmed message ${serverMsg.id} (clientMsgId: ${clientMsgId})`);
        await saveLocalMessage(confirmedMsg);
        setMessages((prev) => reconcileMessages(prev, [confirmedMsg]));
      } else {
        console.warn(`[MESSAGE SEND] Server POST failed with status ${res.status}`);
        setMessages((prev) =>
          prev.map((m) => (m.id === clientMsgId ? { ...m, status: "FAILED" } : m))
        );
      }
    } catch (err) {
      console.error("Error sending direct message:", err);
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

  // Trust Handshake Actions
  const handleUpdateTrust = async (newLevel: "CONNECTED" | "TRUSTED" | "BLOCKED") => {
    try {
      const res = await authFetch("/api/contacts/trust", {
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
          // Sync to /api/connections so connectionRequest is marked ACCEPTED
          await authFetch("/api/connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: peerId, action: "ACCEPT" }),
          }).catch(() => {});
          window.dispatchEvent(new CustomEvent("connection-requests-updated"));
        } else if (newLevel === "BLOCKED") {
          setConnectionStatus("NONE");
          if (currentUser) {
            removeLocalConnectedPeer(peerId, currentUser.id);
          }
          await authFetch("/api/connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: peerId, action: "REMOVE" }),
          }).catch(() => {});
          window.dispatchEvent(new CustomEvent("connection-requests-updated"));
        }
      }
    } catch (e) {
      console.error("Failed to update trust level:", e);
    }
  };

  const handleUnfriend = async () => {
    if (!confirm(`Are you sure you want to remove ${peer?.name || "this user"} from your friends?`)) {
      return;
    }
    try {
      await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: peerId, action: "REMOVE" }),
      });
      if (currentUser) {
        removeLocalConnectedPeer(peerId, currentUser.id);
      }
      setConnectionStatus("NONE");
      setTrustLevel("REQUEST");
      setShowMenu(false);
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
      setScreenNotice(`Removed ${peer?.name || "contact"} from friends.`);
      setTimeout(() => setScreenNotice(null), 4000);
    } catch (e) {
      console.error("Failed to unfriend:", e);
    }
  };

  // Mark Safety Number Verified
  const handleConfirmSafetyVerification = async () => {
    if (!safetyNumber) return;
    try {
      await verifyContactSafety(peerId, true);
      await authFetch("/api/contacts/trust", {
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
      await authFetch("/api/contacts/trust", {
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

  // Start Voice Call (Enforces Connected + Trusted Contact)
  const handleStartVoiceCall = async () => {
    if (connectionStatus !== "CONNECTED") {
      alert("You must be connected friends before you can start voice calls.");
      return;
    }
    if (trustLevel !== "TRUSTED") {
      alert("Please mark this contact as Trusted before starting voice calls.");
      return;
    }
    triggerHaptic("medium");
    const peerRole = peer?.currentRole
      ? `${peer.currentRole}${peer.currentCompany ? ` at ${peer.currentCompany}` : ""}`
      : undefined;
    await webrtcManager.startCall(peerId, peer?.name || "Alumni Contact", "VOICE", peerRole);
  };

  // Start Video Call (Enforces Connected + Trusted Contact)
  const handleStartVideoCall = async () => {
    if (connectionStatus !== "CONNECTED") {
      alert("You must be connected friends before you can start video calls.");
      return;
    }
    if (trustLevel !== "TRUSTED") {
      alert("Please mark this contact as Trusted before starting video calls.");
      return;
    }
    triggerHaptic("medium");
    const peerRole = peer?.currentRole
      ? `${peer.currentRole}${peer.currentCompany ? ` at ${peer.currentCompany}` : ""}`
      : undefined;
    await webrtcManager.startCall(peerId, peer?.name || "Alumni Contact", "VIDEO", peerRole);
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
    <div className="flex flex-col h-[100dvh] bg-[#080811] text-white max-w-3xl mx-auto w-full border-x border-white/10 shadow-2xl relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-[#FF9933]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-[#138808]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Screen Notice Heuristic Toast */}
      {screenNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-2xl bg-[#0d1326]/95 border border-white/15 text-white text-xs font-medium backdrop-blur shadow-2xl flex items-center gap-2">
          <Scan className="w-3.5 h-3.5 text-amber-400" />
          <span>{screenNotice}</span>
        </div>
      )}

      {/* Top Frosted Glass Header with Safe-Area Notch Inset */}
      <header className="sticky top-0 z-30 bg-[#0a0f1d]/90 backdrop-blur-2xl px-3 sm:px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between border-b border-white/10 shadow-lg shadow-black/40">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Link
            href="/messages"
            prefetch={true}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>

          <div className="relative shrink-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 p-[1px] shadow-md shadow-blue-900/30 overflow-hidden">
              {peer?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={peer.avatarUrl}
                  alt={peer.name}
                  className="w-full h-full object-cover rounded-[15px]"
                />
              ) : (
                <div className="w-full h-full bg-[#0d1326] rounded-[15px] flex items-center justify-center text-xs sm:text-sm font-bold text-indigo-200">
                  {peer?.name?.charAt(0).toUpperCase() || "A"}
                </div>
              )}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0a0f1d] ${connectionStatus === "CONNECTED" ? "bg-[#138808] shadow-[0_0_6px_#138808]" : "bg-slate-500"}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate tracking-tight">
                {peer?.name || "Alumni Contact"}
              </h2>
              {connectionStatus === "CONNECTED" && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 shrink-0">
                  1st
                </span>
              )}
              {isSafetyVerified ? (
                <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded shrink-0" title="Cryptographically Verified">
                  <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" /> Verified
                </span>
              ) : (
                peer?.verificationStatus === "VERIFIED" && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
              {isPeerTyping ? (
                <span className="text-[#FF9933] font-bold animate-pulse">Typing...</span>
              ) : (
                <>
                  <span className="truncate font-medium text-slate-300">
                    {connectionStatus === "CONNECTED" ? "Connected" : "Not connected"}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="truncate text-emerald-400/90 font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 inline" /> E2EE
                  </span>
                  {messagePrivacy !== "NORMAL" && (
                    <span className="text-amber-400 font-bold shrink-0">🔥 Ephemeral</span>
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
            className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center transition active:scale-95 ${
              isConfidentialMode
                ? "bg-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                : "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            }`}
            title={isConfidentialMode ? "Confidential Shield Active" : "Enable Confidential Anti-Screenshot Shield"}
          >
            {isConfidentialMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={handleStartVoiceCall}
            disabled={connectionStatus !== "CONNECTED"}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 border border-white/10 text-slate-300 flex items-center justify-center transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            title={
              connectionStatus !== "CONNECTED"
                ? "Connect with user to enable voice call"
                : "Voice Call"
            }
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={handleStartVideoCall}
            disabled={connectionStatus !== "CONNECTED"}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30 border border-white/10 text-slate-300 flex items-center justify-center transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            title={
              connectionStatus !== "CONNECTED"
                ? "Connect with user to enable video call"
                : "Video Call"
            }
          >
            <Video className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95 relative"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Confidential Anti-Screenshot Shield Active Banner */}
      {isConfidentialMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3.5 py-1.5 text-[11px] text-amber-200 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-semibold">
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Confidential Shield Active • Messages blurred until hovered or held</span>
          </div>
          <button
            onClick={toggleConfidentialMode}
            className="text-[10px] font-bold text-amber-400 hover:underline ml-2"
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

      {/* Relationship Banner: Only shown when NOT yet connected */}
      {connectionStatus !== "CONNECTED" && (
        <div className="bg-[#141b2e]/90 backdrop-blur-md border-b border-white/10 p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-[#FF9933]/15 border border-[#FF9933]/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-[#FF9933]" />
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {connectionStatus === "PENDING_INCOMING" ? (
                <><strong>Connection Request:</strong> {peer?.name || "This user"} wants to connect with you. Accept to start chatting.</>
              ) : connectionStatus === "PENDING_OUTGOING" ? (
                <><strong>Request Sent:</strong> Waiting for {peer?.name || "user"} to accept your connection request before you can chat.</>
              ) : (
                <>You must be connected friends with {peer?.name || "this alumnus"} before you can send messages or start calls.</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto w-full sm:w-auto">
            {connectionStatus === "PENDING_INCOMING" ? (
              <>
                <button
                  onClick={() => handleUpdateTrust("CONNECTED")}
                  className="btn-india-green flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer shadow-md active:scale-95 transition"
                >
                  Accept Connection
                </button>
                <button
                  onClick={() => handleUpdateTrust("BLOCKED")}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/10 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                >
                  Decline
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Options Dropdown Menu */}
      {showMenu && (
        <div className="absolute top-16 right-4 z-40 w-60 rounded-2xl bg-[#0d1326]/95 backdrop-blur-2xl border border-white/15 shadow-2xl py-2 text-xs divide-y divide-white/10">
          <div className="py-1">
            <button
              onClick={() => {
                toggleConfidentialMode();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2.5 font-medium text-slate-200 transition"
            >
              {isConfidentialMode ? (
                <>
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Disable Confidential Shield</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span>Enable Confidential Shield</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowSafetyModal(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2.5 font-medium text-slate-200 transition"
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Verify Safety Fingerprint</span>
            </button>
            <button
              onClick={() => {
                setShowRevealModal(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2.5 font-medium text-slate-200 transition"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Reveal More Profile Info</span>
            </button>
            {trustLevel !== "TRUSTED" ? (
              <button
                onClick={() => {
                  handleUpdateTrust("TRUSTED");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2.5 font-medium text-emerald-400 transition"
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
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2.5 font-medium text-slate-300 transition"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Trusted (Tap to Standard)</span>
              </button>
            )}
          </div>

          <div className="py-1">
            <button
              onClick={handleClearHistory}
              className="w-full text-left px-4 py-2.5 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2.5 font-medium transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Local History</span>
            </button>
            {connectionStatus === "CONNECTED" && (
              <button
                onClick={handleUnfriend}
                className="w-full text-left px-4 py-2.5 hover:bg-amber-500/10 text-amber-400 flex items-center gap-2.5 font-medium transition"
              >
                <UserMinus className="w-4 h-4" />
                <span>Remove Connection (1st Degree)</span>
              </button>
            )}
            <button
              onClick={() => {
                handleUpdateTrust("BLOCKED");
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2.5 font-medium transition"
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
            <Loader2 className="w-6 h-6 animate-spin text-[#FF9933]" />
            <p className="text-xs font-medium">Establishing secure E2EE channel...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3.5 max-w-sm mx-auto px-2">
            <div className="bg-[#0f172a]/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl text-center space-y-3 w-full border border-white/10 shadow-2xl">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-xs mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-white">
                  End-to-End Encrypted Session
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Secured with NIST P-256 ECDH + AES-256-GCM. Decryption keys never leave your device.
                </p>
              </div>

              {/* Revealed Profile Info Badges if any */}
              {(peerReveals.phone || peerReveals.email || peerReveals.work) && (
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-left text-xs space-y-1.5 w-full">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Profile shared by {peer?.name}:
                  </p>
                  {peerReveals.phone && peer?.phone && <p className="font-semibold text-slate-200">📱 {peer.phone}</p>}
                  {peerReveals.email && peer?.email && <p className="font-semibold text-slate-200">✉️ {peer.email}</p>}
                  {peerReveals.work && (peer?.currentRole || peer?.currentCompany) && (
                    <p className="font-semibold text-slate-200">
                      💼 {peer.currentRole || "Alumni"}{peer.currentCompany ? ` at ${peer.currentCompany}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center my-3 w-full">
                <button
                  onClick={loadOlderMessages}
                  disabled={loadingMore}
                  className="px-4 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-300 transition flex items-center gap-1.5 border border-white/10 shadow-xs cursor-pointer active:scale-95"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>Loading earlier messages...</span>
                    </>
                  ) : (
                    <span>Load earlier messages</span>
                  )}
                </button>
              </div>
            )}
            {messages.map((m) => {
              const myId = currentUser?.id || (typeof window !== "undefined" ? getActiveVaultUserId() : null);
              const isMe = Boolean(myId && m.senderId === myId);
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
            })}
          </>
        )}

        {isPeerTyping && (
          <div className="py-1">
            <TypingIndicator name={peer?.name} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Tactile Message Composer */}
      <MessageComposer
        inputText={inputText}
        onInputChange={handleInputChange}
        onSend={(text) => handleSendMessage(text)}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        privacyMode={messagePrivacy}
        onPrivacyModeChange={setMessagePrivacy}
        disabled={connectionStatus !== "CONNECTED" || trustLevel === "BLOCKED"}
      />


      {/* Safety Number Verification Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[#0d1326] border border-white/15 p-6 shadow-2xl text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-white">Safety Fingerprint Verification</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compare this 30-digit cryptographic fingerprint with <strong>{peer?.name}</strong> in person or over video to confirm no MITM tampering:
            </p>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 font-mono text-xs font-bold text-[#FF9933] tracking-wider">
              {safetyNumber || "Calculating fingerprint..."}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSafetyVerification}
                className="flex-1 py-2.5 rounded-xl btn-india-green text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[#0d1326] border border-white/15 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Mutual Profile Reveal</h3>
              <button
                onClick={() => setShowRevealModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              By default, contacts only see your username and alumni batch. Select what you would like to reveal to <strong>{peer?.name}</strong>:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Phone Number</p>
                  <p className="text-[10px] text-slate-400">Share your mobile contact</p>
                </div>
                <input
                  type="checkbox"
                  checked={myReveals.phone}
                  onChange={() => handleToggleReveal("phone")}
                  className="h-4 w-4 text-[#FF9933] rounded accent-[#FF9933]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Email Address</p>
                  <p className="text-[10px] text-slate-400">Share your email contact</p>
                </div>
                <input
                  type="checkbox"
                  checked={myReveals.email}
                  onChange={() => handleToggleReveal("email")}
                  className="h-4 w-4 text-[#FF9933] rounded accent-[#FF9933]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Current Role & Company</p>
                  <p className="text-[10px] text-slate-400">Share your workplace info</p>
                </div>
                <input
                  type="checkbox"
                  checked={myReveals.work}
                  onChange={() => handleToggleReveal("work")}
                  className="h-4 w-4 text-[#FF9933] rounded accent-[#FF9933]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="w-full py-2.5 rounded-xl btn-saffron text-white text-xs font-bold transition shadow-md shadow-[#FF9933]/25 active:scale-95 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
