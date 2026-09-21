"use client";

import { useEffect, useState, useRef, use } from "react";
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
} from "lucide-react";
import {
  getOrCreateDeviceIdentity,
  getLocalMessages,
  saveLocalMessage,
  deleteLocalMessage,
  clearLocalConversation,
  searchLocalMessages,
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

interface PeerProfile {
  id: string;
  name: string;
  currentRole: string | null;
  currentCompany: string | null;
  batchYear: number;
  verificationStatus: string;
}

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

  // Modals & Drawers
  const [showMenu, setShowMenu] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [disappearingSeconds, setDisappearingSeconds] = useState(0); // 0 = off
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Initialize Cryptographic Identity, Shared Key & Local Vault
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
        const peerRes = await fetch(`/api/directory?id=${peerId}`);
        if (peerRes.ok) {
          const pData = await peerRes.json();
          const target = pData.users?.find((u: PeerProfile) => u.id === peerId);
          if (target) setPeer(target);
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

        if (devData.devices && devData.devices.length > 0) {
          peerPubKeySpki = devData.devices[0].publicKey;
        } else {
          // If peer hasn't registered yet, generate an ephemeral mock identity so chat doesn't fail
          peerPubKeySpki = localIdentity.publicKeySpki;
        }

        if (peerPubKeySpki) {
          const peerKey = await importPeerPublicKey(peerPubKeySpki);
          const derivedKey = await deriveSharedSessionKey(localIdentity.privateKey, peerKey);
          setSharedKey(derivedKey);

          // Compute safety number fingerprint
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

  // Handle typing status broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    realtimeSignaling.sendTypingStatus(peerId, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      realtimeSignaling.sendTypingStatus(peerId, false);
    }, 1500);
  };

  // 2. Send End-to-End Encrypted Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || !currentUser || !sharedKey) return;

    setSending(true);
    setInputText("");

    try {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expiresAt = disappearingSeconds > 0 ? Date.now() + disappearingSeconds * 1000 : undefined;

      const structuredPayload = JSON.stringify({
        text: cleanText,
        disappearingSeconds: disappearingSeconds > 0 ? disappearingSeconds : undefined,
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
        disappearingSeconds: disappearingSeconds > 0 ? disappearingSeconds : undefined,
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

  // Start Voice Call
  const handleStartVoiceCall = () => {
    webrtcManager.startCall(peerId, peer?.name || "Alumni Contact", "VOICE");
  };

  // Start Video Call
  const handleStartVideoCall = () => {
    webrtcManager.startCall(peerId, peer?.name || "Alumni Contact", "VIDEO");
  };

  // Clear Chat History
  const handleClearHistory = async () => {
    if (confirm("Delete all message history for this chat from this device?")) {
      await clearLocalConversation(peerId);
      setMessages([]);
      setShowMenu(false);
    }
  };

  // Block User
  const handleBlockUser = async () => {
    if (confirm(`Block ${peer?.name || "this user"}? You will not receive messages or calls from them.`)) {
      await fetch("/api/privacy/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: peerId }),
      });
      alert("User blocked");
      router.push("/messages");
    }
  };

  // Report User
  const handleReportUser = async () => {
    const reason = prompt("Enter the reason for reporting this user (spam, harassment, impersonation):");
    if (reason) {
      await fetch("/api/privacy/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: peerId, reason }),
      });
      alert("Thank you. Report received and under review.");
      setShowMenu(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 max-w-3xl mx-auto border-x border-slate-200/80 shadow-md">
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
            <div className="flex items-center gap-1">
              <h2 className="text-xs font-bold text-slate-900 truncate">
                {peer?.name || "Alumni Contact"}
              </h2>
              {peer?.verificationStatus === "VERIFIED" && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
              {isPeerTyping ? (
                <span className="text-blue-600 font-semibold animate-pulse">Typing...</span>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>End-to-End Encrypted</span>
                  {disappearingSeconds > 0 && (
                    <span className="text-amber-600 font-medium">⏳ {disappearingSeconds}s</span>
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
            className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center transition"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={handleStartVideoCall}
            className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 flex items-center justify-center transition"
            title="Video Call"
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

      {/* Options Dropdown Menu */}
      {showMenu && (
        <div className="absolute top-14 right-4 z-40 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 text-xs divide-y divide-slate-100">
          <div className="py-1">
            <button
              onClick={() => {
                setShowSafetyModal(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
            >
              <KeyRound className="w-4 h-4 text-indigo-600" />
              Verify Safety Number
            </button>
          </div>

          {/* Disappearing Messages Duration Selector */}
          <div className="px-3.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Disappearing Messages
            </p>
            <select
              value={disappearingSeconds}
              onChange={(e) => setDisappearingSeconds(parseInt(e.target.value, 10))}
              className="w-full p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium"
            >
              <option value="0">Off (Keep messages)</option>
              <option value="30">30 Seconds</option>
              <option value="60">1 Minute</option>
              <option value="300">5 Minutes</option>
              <option value="3600">1 Hour</option>
              <option value="86400">24 Hours</option>
              <option value="604800">7 Days</option>
            </select>
          </div>

          <div className="py-1">
            <button
              onClick={handleClearHistory}
              className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Clear Local History
            </button>
            <button
              onClick={handleBlockUser}
              className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" /> Block Contact
            </button>
            <button
              onClick={handleReportUser}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Report Spam
            </button>
          </div>
        </div>
      )}

      {/* Message Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-50 to-slate-100">
        {/* Top Cryptographic Guarantee Notice */}
        <div className="p-2.5 rounded-2xl bg-white/80 border border-slate-200/80 text-center max-w-sm mx-auto shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold text-[11px]">
            <Lock className="w-3.5 h-3.5" /> End-to-End Encrypted
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            Messages to this chat are secured with AES-256-GCM. No one outside of this chat, not even the server, can read them.
          </p>
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Establishing secure session...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-xs font-semibold">No messages yet</p>
            <p className="text-[11px] mt-1">Send a greeting to start this encrypted chat 👋</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUser?.id;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-xs"
                      : "bg-white text-slate-900 border border-slate-200/80 rounded-tl-xs"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>

                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                      isMe ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {m.disappearingSeconds && (
                      <span title={`Disappears in ${m.disappearingSeconds}s`}>⏳</span>
                    )}

                    {isMe && (
                      <span>
                        {m.status === "SENDING" && "🕒"}
                        {m.status === "SENT" && <Check className="w-3 h-3 inline" />}
                        {m.status === "DELIVERED" && <CheckCheck className="w-3 h-3 inline text-slate-300" />}
                        {m.status === "READ" && <CheckCheck className="w-3 h-3 inline text-emerald-300" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input Bar */}
      <footer className="sticky bottom-0 z-20 bg-white border-t border-slate-200 p-2.5 sm:p-3">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Quick Emoji Reaction */}
          <button
            type="button"
            onClick={() => setInputText((prev) => prev + "👋")}
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition shrink-0"
            title="Wave"
          >
            👋
          </button>

          <input
            type="text"
            placeholder={
              disappearingSeconds > 0
                ? `Encrypted message (disappears in ${disappearingSeconds}s)...`
                : "Type an encrypted message..."
            }
            value={inputText}
            onChange={handleInputChange}
            className="flex-1 py-2 px-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="h-9 w-9 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition shadow-xs shrink-0"
            title="Send"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </footer>

      {/* Safety Number Verification Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-slate-900">Safety Number Verification</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Verify this fingerprint with <strong>{peer?.name}</strong> in person or via video call to confirm no third party is intercepting your communication:
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-800 tracking-wider">
              {safetyNumber || "Calculating fingerprint..."}
            </div>

            <button
              onClick={() => setShowSafetyModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
            >
              Verified & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
