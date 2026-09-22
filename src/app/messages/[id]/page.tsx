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
  VaultMessage,
} from "@/lib/e2ee/vault";
import {
  importPeerPublicKey,
  deriveSharedSessionKey,
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
        setCurrentUser({ id: user.id, name: user.name });

        // Fetch peer profile from directory
        const [peerRes, trustRes] = await Promise.all([
          fetch(`/api/directory?id=${peerId}`),
          fetch(`/api/contacts/trust?contactId=${peerId}`),
        ]);

        if (peerRes.ok) {
          const pData = await peerRes.json();
          const target = pData.alumni?.find((u: PeerProfile) => u.id === peerId) || pData.alumni?.[0];
          if (target) setPeer(target);
        }

        if (trustRes.ok) {
          const tData = await trustRes.json();
          if (tData.success) {
            setTrustLevel(tData.trustLevel);
            setIsSafetyVerified(tData.isVerified);
            if (tData.peerReveals) setPeerReveals(tData.peerReveals);
            if (tData.myReveals) setMyReveals(tData.myReveals);
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
          peerPubKeySpki = localIdentity.publicKeySpki;
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
        }

        // Initialize Realtime Signaling
        realtimeSignaling.init(user.id, user.name, localIdentity.privateKey);

        // Load local decrypted chat history from IndexedDB
        const localMsgs = await getLocalMessages(peerId);
        setMessages(localMsgs);

        // Drain any offline queued encrypted messages from server
        await realtimeSignaling.drainPendingQueue();

        // Listen for new incoming messages
        unsubscribeMsg = realtimeSignaling.onMessageReceived((msg) => {
          if (msg.peerId === peerId) {
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
          }
        });

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

  // Screen capture & window blur heuristic awareness listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App backgrounded / window minimized
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4"))) {
        setScreenNotice("Privacy Notice: Screen capture or focus change heuristic detected.");
        setTimeout(() => setScreenNotice(null), 4000);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

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

    if (!cleanText || !currentUser || !sharedKey) return;

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
        text: cleanText,
        privacyMode: messagePrivacy,
        disappearingSeconds: expireSec,
      });

      // 1. Encrypt locally using AES-256-GCM
      const encrypted = await encryptE2EEMessage(sharedKey, structuredPayload);

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

      // 3. Relay encrypted payload to recipient
      const res = await fetch("/api/messages/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: peerId,
          senderDeviceId: myDeviceId,
          encryptedPayload: encrypted,
          messageType: "TEXT",
        }),
      });

      if (res.ok) {
        localMsg.status = "SENT";
        await saveLocalMessage(localMsg);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "SENT" } : m))
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
    <div className="flex flex-col h-screen bg-slate-100 max-w-3xl mx-auto border-x border-slate-200/80 shadow-md relative">
      {/* Screen Notice Heuristic Toast */}
      {screenNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-2xl bg-slate-900/90 text-white text-xs font-medium backdrop-blur shadow-lg flex items-center gap-2">
          <Scan className="w-3.5 h-3.5 text-amber-400" />
          <span>{screenNotice}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/messages"
            className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-blue-500/20 shrink-0">
            {peer?.name?.charAt(0).toUpperCase() || "A"}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-slate-900 truncate">
                {peer?.name || "Alumni Contact"}
              </h2>
              {isSafetyVerified ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded" title="Cryptographically Verified">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                </span>
              ) : (
                peer?.verificationStatus === "VERIFIED" && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
              {isPeerTyping ? (
                <span className="text-blue-600 font-semibold animate-pulse">Typing...</span>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>End-to-End Encrypted</span>
                  {messagePrivacy !== "NORMAL" && (
                    <span className="text-amber-600 font-bold">🔥 Ephemeral</span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Voice Call, Video Call, Menu */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={handleStartVoiceCall}
            disabled={trustLevel === "REQUEST" || trustLevel === "UNKNOWN"}
            className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center transition disabled:opacity-40"
            title={trustLevel === "REQUEST" ? "Connect to enable calls" : "Voice Call"}
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={handleStartVideoCall}
            disabled={trustLevel === "REQUEST" || trustLevel === "UNKNOWN"}
            className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 flex items-center justify-center transition disabled:opacity-40"
            title={trustLevel === "REQUEST" ? "Connect to enable calls" : "Video Call"}
          >
            <Video className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition relative"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Security Identity Changed Alert */}
      {keyRotatedWarning && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>⚠️ Security identity changed. Verify safety number before sending sensitive data.</span>
          </div>
          <button
            onClick={() => setShowSafetyModal(true)}
            className="px-2 py-0.5 rounded bg-white text-amber-900 font-bold text-[10px]"
          >
            Verify Fingerprint
          </button>
        </div>
      )}

      {/* Trust Level Handshake Bar (For UNKNOWN / REQUEST Contacts) */}
      {(trustLevel === "REQUEST" || trustLevel === "UNKNOWN") && (
        <div className="bg-blue-50 border-b border-blue-200/80 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-blue-900 truncate">
              <strong>Message Request:</strong> Limited profile visible. Connect to unlock voice/video calls.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleUpdateTrust("CONNECTED")}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-2xs"
            >
              Accept & Connect
            </button>
            <button
              onClick={() => handleUpdateTrust("BLOCKED")}
              className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-semibold text-[11px] transition"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs">Establishing end-to-end encrypted session...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 max-w-sm mx-auto">
            <div className="h-12 w-12 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                End-to-End Encrypted Session Established
              </p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Messages and calls are secured with NIST P-256 ECDH + AES-256-GCM. Plaintext is never stored on our servers.
              </p>
            </div>

            {/* Revealed Profile Info Badges if any */}
            {(peerReveals.phone || peerReveals.email || peerReveals.work) && (
              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-left text-xs space-y-1 w-full">
                <p className="text-[10px] uppercase font-bold text-slate-400">Revealed by {peer?.name}:</p>
                {peerReveals.phone && peer?.phone && <p>📱 {peer.phone}</p>}
                {peerReveals.email && peer?.email && <p>✉️ {peer.email}</p>}
                {peerReveals.work && peer?.currentRole && <p>💼 {peer.currentRole} at {peer.currentCompany || "N/A"}</p>}
              </div>
            )}
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

      {/* Tactile Message Composer */}
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
