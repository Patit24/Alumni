"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Plus, QrCode, Scan, Lock, ShieldCheck,
  MessageSquare, Phone, Users, CheckCircle2, Check, X,
  ChevronRight, Loader2, PhoneMissed, PhoneIncoming,
  PhoneOutgoing, Trash2, UserPlus, RefreshCw,
} from "lucide-react";
import {
  getCallLogs, clearCallLogs, VaultCallLog,
  getVaultConnectedPeerIds, getLocalConnectedPeerIds,
  addLocalConnectedPeer, getLatestMessagesPerPeer,
  setActiveVaultUser, VaultMessage,
} from "@/lib/e2ee/vault";
import QRCodeModal from "@/components/QRCodeModal";
import QRScannerModal from "@/components/QRScannerModal";
import { motion, AnimatePresence } from "framer-motion";
import FloatingBottomNav, { NavTab } from "@/components/motion/FloatingBottomNav";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

interface AlumniContact {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  batchYear: number;
  verificationStatus: string;
  department?: { name: string } | null;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({
  name, src, size = 48
}: { name: string; src?: string | null; size?: number }) {
  const initial = (name || "A").charAt(0).toUpperCase();
  return (
    <div
      className="rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : initial}
    </div>
  );
}

export default function MessagesHubPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>("CHATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<AlumniContact[]>([]);
  const [callLogs, setCallLogs] = useState<VaultCallLog[]>([]);
  const [connectedPeerIds, setConnectedPeerIds] = useState<Set<string>>(new Set());
  const [latestMessages, setLatestMessages] = useState<Map<string, VaultMessage>>(new Map());
  const [loading, setLoading] = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    id: string; name: string; username: string; batchYear: number; institutionName?: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const meRes = await fetch("/api/auth/me").catch(() => null);
      let currentUserId: string | null = null;

      if (meRes?.ok) {
        const meData = await meRes.json();
        if (meData?.user) {
          currentUserId = meData.user.id;
          setActiveVaultUser(currentUserId);
          setCurrentUserProfile({
            id: meData.user.id,
            name: meData.user.name || "Alumni Member",
            username: meData.user.username || `@${(meData.user.name || "alumni").toLowerCase().replace(/[^a-z0-9]/g, "")}`,
            batchYear: meData.user.batchYear || new Date().getFullYear(),
            institutionName: meData.user.institutionName || "Campus",
          });
        }
      }

      const [dirRes, calls, lockRes, vaultPeers, latestMap, reqsRes] = await Promise.all([
        fetch("/api/directory?limit=200&batchScope=all&institutionScope=all").catch(() => null),
        getCallLogs(currentUserId || undefined).catch(() => []),
        fetch("/api/privacy/lock").catch(() => null),
        getVaultConnectedPeerIds(currentUserId || undefined).catch(() => []),
        getLatestMessagesPerPeer(currentUserId || undefined).catch(() => new Map()),
        fetch("/api/contacts/requests").catch(() => null),
      ]);

      let loadedContacts: AlumniContact[] = [];
      if (dirRes?.ok) {
        const dirData = await dirRes.json();
        loadedContacts = dirData.alumni || dirData.users || [];
        setContacts(loadedContacts);
      }

      setCallLogs(calls);
      setLatestMessages(latestMap);

      // Build connected peer set from server (authoritative)
      const serverConnectedPeers = new Set<string>();
      if (reqsRes?.ok) {
        const reqsData = await reqsRes.json();
        if (reqsData.incoming) setIncomingRequests(reqsData.incoming);
        if (Array.isArray(reqsData.connectedPeerIds)) {
          for (const pid of reqsData.connectedPeerIds) {
            if (pid && pid !== currentUserId) {
              serverConnectedPeers.add(pid);
              addLocalConnectedPeer(pid, currentUserId || undefined);
            }
          }
        }
        if (Array.isArray(reqsData.connections)) {
          setContacts((prev) => {
            const map = new Map<string, AlumniContact>();
            prev.forEach((c) => map.set(c.id, c));
            reqsData.connections.forEach((c: any) => {
              if (c && c.id) map.set(c.id, { ...map.get(c.id), ...c });
            });
            return Array.from(map.values());
          });
        }
      }

      const localPeers = currentUserId ? getLocalConnectedPeerIds(currentUserId) : [];
      const merged = new Set<string>([
        ...serverConnectedPeers,
        ...vaultPeers.filter(p => p !== currentUserId),
        ...localPeers.filter(p => p !== currentUserId),
      ]);
      setConnectedPeerIds(merged);

      // Ensure any connected peer not in directory is dynamically resolved
      const loadedIds = new Set(loadedContacts.map((c) => c.id));
      const missingPeerIds = Array.from(merged).filter((id) => id && !loadedIds.has(id));
      if (missingPeerIds.length > 0) {
        try {
          const fetchedMissing = await Promise.all(
            missingPeerIds.map((id) =>
              fetch(`/api/directory?id=${encodeURIComponent(id)}&batchScope=all&institutionScope=all`)
                .then((r) => r.json())
                .then((d) => d.alumni?.[0])
                .catch(() => null)
            )
          );
          const validMissing: AlumniContact[] = fetchedMissing.filter(Boolean);
          if (validMissing.length > 0) {
            setContacts((prev) => {
              const prevIds = new Set(prev.map((c) => c.id));
              const newUnique = validMissing.filter((m) => !prevIds.has(m.id));
              return [...prev, ...newUnique];
            });
          }
        } catch {}
      }

      // Handle ?connect= query param from QR scan
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const connectTarget = params.get("connect");
        if (connectTarget) {
          const clean = connectTarget.trim().replace(/^@/, "");
          for (const endpoint of [
            `/api/directory?username=${encodeURIComponent(clean)}&batchScope=all&institutionScope=all`,
            `/api/directory?id=${encodeURIComponent(clean)}&batchScope=all&institutionScope=all`,
            `/api/directory?q=${encodeURIComponent(clean)}&batchScope=all&institutionScope=all`,
          ]) {
            const r = await fetch(endpoint).catch(() => null);
            if (r?.ok) {
              const data = await r.json();
              const peer = data.alumni?.[0];
              if (peer) {
                addLocalConnectedPeer(peer.id, currentUserId || undefined);
                setConnectedPeerIds(prev => new Set(prev).add(peer.id));
                router.push(`/messages/${peer.id}`);
                return;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Messages hub load error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Live sync on connection/vault updates
  useEffect(() => {
    const refresh = () => {
      const uid = currentUserProfile?.id;
      fetch("/api/contacts/requests").then(r => r.json()).then(data => {
        if (data.incoming) setIncomingRequests(data.incoming);
        if (Array.isArray(data.connectedPeerIds)) {
          const ids = new Set<string>(data.connectedPeerIds.filter((id: string) => id !== uid));
          if (uid) getLocalConnectedPeerIds(uid).forEach(id => { if (id !== uid) ids.add(id); });
          setConnectedPeerIds(ids);
        }
      }).catch(() => {});
      getLatestMessagesPerPeer(uid).then(map => setLatestMessages(map)).catch(() => {});
    };
    window.addEventListener("connection-requests-updated", refresh);
    window.addEventListener("vault-messages-updated", refresh);
    return () => {
      window.removeEventListener("connection-requests-updated", refresh);
      window.removeEventListener("vault-messages-updated", refresh);
    };
  }, [currentUserProfile?.id]);

  const handleAcceptRequest = async (userId: string) => {
    try {
      setRequestsLoading(true);
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, action: "ACCEPT" }),
      });
      if (res.ok) {
        addLocalConnectedPeer(userId, currentUserId || undefined);
        setConnectedPeerIds(prev => new Set(prev).add(userId));
        setIncomingRequests(prev => prev.filter(r => r.user.id !== userId));
        triggerHaptic("success");
      }
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleDeclineRequest = async (userId: string) => {
    try {
      setRequestsLoading(true);
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, action: "REJECT" }),
      });
      if (res.ok) {
        setIncomingRequests(prev => prev.filter(r => r.user.id !== userId));
        triggerHaptic("light");
      }
    } finally {
      setRequestsLoading(false);
    }
  };

  const currentUserId = currentUserProfile?.id;
  const cleanFilter = searchQuery.toLowerCase().replace(/^@/, "").trim();

  const handleQuickConnectAndChat = async (targetUserId: string) => {
    triggerHaptic("medium");
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "REQUEST" }),
      });
      const data = await res.json();
      if (data.isFriend || data.status === "CONNECTED") {
        addLocalConnectedPeer(targetUserId, currentUserId || undefined);
        setConnectedPeerIds((prev) => new Set(prev).add(targetUserId));
      }
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch {}
    router.push(`/messages/${targetUserId}`);
  };

  // ONLY show mutual connections in CHATS tab
  const connectedContacts = contacts
    .filter(c => c.id !== currentUserId && connectedPeerIds.has(c.id))
    .filter(c => {
      if (!cleanFilter) return true;
      return (
        c.name?.toLowerCase().includes(cleanFilter) ||
        c.username?.toLowerCase().includes(cleanFilter) ||
        c.currentRole?.toLowerCase().includes(cleanFilter) ||
        c.batchYear?.toString().includes(cleanFilter)
      );
    })
    .sort((a, b) => {
      if (pinnedIds.has(b.id) !== pinnedIds.has(a.id)) {
        return pinnedIds.has(b.id) ? 1 : -1;
      }
      const ta = latestMessages.get(a.id)?.createdAt || 0;
      const tb = latestMessages.get(b.id)?.createdAt || 0;
      return tb - ta;
    });

  const filteredCalls = callLogs.filter(log => {
    if (!cleanFilter) return true;
    return log.peerName?.toLowerCase().includes(cleanFilter);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/70 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Messages</h1>
              <p className="text-[10px] text-emerald-600 font-semibold">End-to-End Encrypted</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowQrModal(true)}
              className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 flex items-center justify-center transition active:scale-90"
              title="My QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowScannerModal(true)}
              className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 flex items-center justify-center transition active:scale-90"
              title="Scan QR Code"
            >
              <Scan className="w-4 h-4" />
            </button>
            <Link
              href="/directory"
              className="btn-saffron h-8 px-3 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={tab === "CALLS" ? "Search calls…" : "Search conversations…"}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-100 border border-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff9933]/30 focus:bg-white focus:border-orange-200 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl w-full mx-auto pb-32">

        {/* ── INCOMING CONNECTION REQUESTS ── */}
        <AnimatePresence>
          {incomingRequests.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={MOTION_SPRINGS.gentle}
              className="mx-4 mt-4 rounded-3xl bg-gradient-to-r from-[#000080] via-[#000066] to-blue-900 text-white shadow-xl shadow-indigo-950/15 overflow-hidden border border-blue-900/40"
            >
              <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-orange-500/20 text-[#ff9933]">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold">
                    {incomingRequests.length} Connection {incomingRequests.length === 1 ? "Request" : "Requests"}
                  </span>
                </div>
                <span className="text-xs text-orange-200 font-medium">Accept to connect</span>
              </div>
              <div className="divide-y divide-white/10">
                {incomingRequests.map(req => (
                  <motion.div
                    key={req.id}
                    layout
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <Avatar name={req.user.name} src={req.user.avatarUrl} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{req.user.name}</p>
                      <p className="text-[11px] text-blue-200 truncate">
                        {req.user.currentRole
                          ? `${req.user.currentRole}${req.user.currentCompany ? ` @ ${req.user.currentCompany}` : ""}`
                          : `Class of ${req.user.batchYear}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        disabled={requestsLoading}
                        onClick={() => handleAcceptRequest(req.user.id)}
                        className="btn-india-green h-8 px-3.5 rounded-xl text-xs font-bold transition active:scale-90 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        disabled={requestsLoading}
                        onClick={() => handleDeclineRequest(req.user.id)}
                        className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-90 disabled:opacity-50"
                        title="Decline"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── CHATS TAB ── */}
        {tab === "CHATS" && (
          <section className="mt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">Loading conversations…</p>
              </div>
            ) : connectedContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
                <div className="h-16 w-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">
                    {searchQuery ? "No matches found" : "No chats yet"}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                    {searchQuery
                      ? "Try a different name or username."
                      : "Connect with alumni to start encrypted conversations. Only mutual connections appear here."}
                  </p>
                </div>
                {!searchQuery && (
                  <Link
                    href="/directory"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm hover:bg-blue-700 transition active:scale-95"
                  >
                    <Users className="w-4 h-4" />
                    Find Alumni
                  </Link>
                )}

                {/* Quick Start Suggested Alumni */}
                {!searchQuery && contacts.filter((c) => c.id !== currentUserId).length > 0 && (
                  <div className="mt-6 w-full max-w-md text-left">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1">
                      Start Chatting With Alumni
                    </p>
                    <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-sm overflow-hidden">
                      {contacts
                        .filter((c) => c.id !== currentUserId)
                        .slice(0, 5)
                        .map((person) => (
                          <div
                            key={person.id}
                            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={person.name} src={person.avatarUrl} size={40} />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{person.name}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {person.currentRole || `Class of ${person.batchYear}`}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleQuickConnectAndChat(person.id)}
                              className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 transition active:scale-95 flex items-center gap-1.5 shadow-sm"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Chat</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white mx-4 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
                <AnimatePresence initial={false}>
                  {connectedContacts.map(contact => {
                    const lastMsg = latestMessages.get(contact.id);
                    const isOutgoing = lastMsg && lastMsg.senderId !== contact.id;
                    const isPinned = pinnedIds.has(contact.id);

                    return (
                      <motion.div
                        key={contact.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={MOTION_SPRINGS.gentle}
                        whileTap={{ scale: 0.985, backgroundColor: "#f8fafc" }}
                        className="relative flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                        onClick={() => {
                          triggerHaptic("light");
                          addLocalConnectedPeer(contact.id, currentUserId || undefined);
                          router.push(`/messages/${contact.id}`);
                        }}
                      >
                        {/* Avatar + online dot */}
                        <div className="relative shrink-0">
                          <Avatar name={contact.name} src={contact.avatarUrl} size={50} />
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {contact.name}
                              </p>
                              {isPinned && (
                                <span className="text-blue-500 shrink-0 text-[10px]">📌</span>
                              )}
                              {contact.verificationStatus === "VERIFIED" && (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              )}
                            </div>
                            {lastMsg && (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {formatTime(lastMsg.createdAt)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 mt-0.5 min-w-0">
                            {lastMsg ? (
                              <>
                                {isOutgoing && (
                                  <span className="text-[11px] shrink-0 leading-none">
                                    {lastMsg.status === "READ"
                                      ? <span className="text-blue-500 font-bold">✓✓</span>
                                      : lastMsg.status === "DELIVERED"
                                        ? <span className="text-slate-400 font-bold">✓✓</span>
                                        : <span className="text-slate-400">✓</span>}
                                  </span>
                                )}
                                <p className="text-sm text-slate-500 truncate">{lastMsg.text}</p>
                              </>
                            ) : (
                              <p className="text-sm text-slate-400 truncate">
                                {contact.currentRole
                                  ? `${contact.currentRole}${contact.currentCompany ? ` · ${contact.currentCompany}` : ""}`
                                  : `Class of ${contact.batchYear}`}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Chevron */}
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}

        {/* ── CALLS TAB ── */}
        {tab === "CALLS" && (
          <section className="mt-4 mx-4 space-y-3">
            {callLogs.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    if (confirm("Clear all call history from this device?")) {
                      await clearCallLogs();
                      setCallLogs([]);
                    }
                  }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-rose-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
              {filteredCalls.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center px-8">
                  <Phone className="w-10 h-10 text-slate-300" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">No call records</p>
                    <p className="text-xs text-slate-400 mt-1">Voice and video calls will appear here.</p>
                  </div>
                </div>
              ) : (
                filteredCalls.map(log => {
                  const CallIcon = log.status === "MISSED" ? PhoneMissed
                    : log.direction === "INCOMING" ? PhoneIncoming : PhoneOutgoing;
                  const iconColor = log.status === "MISSED" ? "text-rose-500" : "text-emerald-500";
                  return (
                    <motion.div
                      key={log.id}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => router.push(`/messages/${log.peerId}`)}
                    >
                      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${log.status === "MISSED" ? "bg-rose-50" : "bg-emerald-50"}`}>
                        <CallIcon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{log.peerName || "Unknown"}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {log.callType === "VIDEO" ? "Video" : "Voice"} · {log.status}
                          {log.durationSeconds ? ` · ${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {log.timestamp ? formatTime(log.timestamp) : ""}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ── CONTACTS TAB ── */}
        {tab === "CONTACTS" && (
          <section className="mt-4 mx-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3 px-1">
              All Connected Alumni
            </p>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
              {connectedContacts.length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-3 text-center px-8">
                  <Users className="w-10 h-10 text-slate-300" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">No connections yet</p>
                    <p className="text-xs text-slate-400 mt-1">Connect with alumni from the directory.</p>
                  </div>
                  <Link href="/directory" className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold transition hover:bg-blue-700">
                    <Users className="w-3.5 h-3.5" /> Browse Directory
                  </Link>
                </div>
              ) : (
                contacts
                  .filter(c => c.id !== currentUserId && connectedPeerIds.has(c.id))
                  .filter(c => {
                    if (!cleanFilter) return true;
                    return c.name?.toLowerCase().includes(cleanFilter) ||
                      c.username?.toLowerCase().includes(cleanFilter);
                  })
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(contact => (
                    <motion.div
                      key={contact.id}
                      whileTap={{ scale: 0.985 }}
                      className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
                      onClick={() => {
                        triggerHaptic("light");
                        router.push(`/messages/${contact.id}`);
                      }}
                    >
                      <Avatar name={contact.name} src={contact.avatarUrl} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{contact.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {contact.currentRole || `Class of ${contact.batchYear}`}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </motion.div>
                  ))
              )}
            </div>
          </section>
        )}

        {/* ── PRIVACY TAB ── */}
        {tab === "PRIVACY" && (
          <section className="mt-4 mx-4 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
              {[
                { label: "Privacy Settings", sub: "Receipts, typing, online status", href: "/settings/privacy", icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50" },
                { label: "Privacy Dashboard", sub: "Active sessions and threat log", href: "/settings/privacy/dashboard", icon: ShieldCheck, color: "text-blue-600 bg-blue-50" },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3.5 px-4 py-4 hover:bg-slate-50 transition"
                  >
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-500">{item.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Link>
                );
              })}
            </div>
            <p className="text-center text-[11px] text-slate-400 px-4">
              All messages are end-to-end encrypted using X25519 ECDH + AES-256-GCM. Zero plaintext stored on servers.
            </p>
          </section>
        )}
      </main>

      {/* ── BOTTOM FLOATING NAV ─────────────────────────────────── */}
      <FloatingBottomNav
        activeTab={tab}
        onTabChange={setTab}
        unreadCount={incomingRequests.length}
        missedCallsCount={callLogs.filter(c => c.status === "MISSED").length}
      />

      {/* ── MODALS ──────────────────────────────────────────────── */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        currentUser={currentUserProfile}
        onOpenScanner={() => setShowScannerModal(true)}
      />
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onOpenMyQr={() => { setShowScannerModal(false); setShowQrModal(true); }}
        currentUser={currentUserProfile}
      />
    </div>
  );
}
