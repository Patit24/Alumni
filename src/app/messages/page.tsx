"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Phone,
  Video,
  ShieldCheck,
  Search,
  Plus,
  ArrowLeft,
  Trash2,
  Settings,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MessageSquare,
  Smartphone,
  Send,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  QrCode,
} from "lucide-react";
import { getCallLogs, clearCallLogs, VaultCallLog } from "@/lib/e2ee/vault";
import QRCodeModal from "@/components/QRCodeModal";
import { motion, AnimatePresence } from "framer-motion";
import FloatingBottomNav, { NavTab } from "@/components/motion/FloatingBottomNav";
import AnimatedButton from "@/components/motion/AnimatedButton";
import AnimatedIconButton from "@/components/motion/AnimatedIconButton";
import AnimatedCard from "@/components/motion/AnimatedCard";
import AnimatedBottomSheet from "@/components/motion/AnimatedBottomSheet";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";
import { Pin, Archive, RefreshCw, Radio, UserCheck } from "lucide-react";

interface AlumniContact {
  id: string;
  name: string;
  username?: string | null;
  phone?: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  batchYear: number;
  verificationStatus: string;
  department?: { name: string } | null;
}

interface MatchedContact {
  id: string;
  name: string;
  username: string;
  batchYear: number;
  role: string;
  company: string | null;
  institutionName: string;
  messageUrl: string;
}

interface UnregisteredContact {
  phone: string;
  inviteSmsUrl: string;
}

export default function MessagesHubPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>("CHATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<AlumniContact[]>([]);
  const [callLogs, setCallLogs] = useState<VaultCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingRemote, setSearchingRemote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [privacyLockActive, setPrivacyLockActive] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    id: string;
    name: string;
    username: string;
    batchYear: number;
    institutionName?: string;
  } | null>(null);

  // Contact Sync State
  const [rawPhoneInput, setRawPhoneInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [matchedRegistered, setMatchedRegistered] = useState<MatchedContact[] | null>(null);
  const [matchedUnregistered, setMatchedUnregistered] = useState<UnregisteredContact[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // SMS Tester State
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testCustomMessage, setTestCustomMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [smsResult, setSmsResult] = useState<{
    success: boolean;
    message: string;
    carrierResponse?: any;
    wallet?: any;
  } | null>(null);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dirRes, calls, meRes, lockRes] = await Promise.all([
          fetch("/api/directory?limit=50"),
          getCallLogs(),
          fetch("/api/auth/me"),
          fetch("/api/privacy/lock"),
        ]);

        if (lockRes.ok) {
          const lData = await lockRes.json();
          setPrivacyLockActive(lData.privacyLockActive || false);
        }

        if (dirRes.ok) {
          const dirData = await dirRes.json();
          setContacts(dirData.alumni || dirData.users || []);
          if (dirData.currentUser) {
            setCurrentUserProfile(dirData.currentUser);
          }
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.user) {
            setCurrentUserProfile((prev) => ({
              id: meData.user.id,
              name: meData.user.name || "Alumni Member",
              username: meData.user.username || `@${(meData.user.name || "alumni").toLowerCase().replace(/[^a-z0-9]/g, "")}`,
              batchYear: meData.user.batchYear || new Date().getFullYear(),
              institutionName: meData.user.institutionName || prev?.institutionName || "Brainware University",
            }));
          }
        }

        setCallLogs(calls);

        // Handle ?connect=@username or ?connect=userId from QR scan or link
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const connectTarget = params.get("connect");
          if (connectTarget) {
            const cleanTarget = connectTarget.trim().replace(/^@/, "");
            const res = await fetch(`/api/directory?username=${encodeURIComponent(cleanTarget)}`);
            if (res.ok) {
              const data = await res.json();
              const peer = data.alumni?.[0];
              if (peer) {
                router.push(`/messages/${peer.id}`);
                return;
              }
            }
            // Fallback try by ID
            const idRes = await fetch(`/api/directory?id=${encodeURIComponent(cleanTarget)}`);
            if (idRes.ok) {
              const data = await idRes.json();
              const peer = data.alumni?.[0];
              if (peer) {
                router.push(`/messages/${peer.id}`);
                return;
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading messages hub:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Remote search when query has length > 1 (supports @username and name)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setSearchingRemote(true);
      try {
        const cleanQuery = searchQuery.trim();
        const res = await fetch(`/api/directory?q=${encodeURIComponent(cleanQuery)}&limit=50`);
        if (res.ok && isCurrent) {
          const data = await res.json();
          if (data.alumni) {
            setContacts((prev) => {
              const map = new Map<string, AlumniContact>();
              prev.forEach((c) => map.set(c.id, c));
              data.alumni.forEach((c: AlumniContact) => map.set(c.id, c));
              return Array.from(map.values());
            });
          }
        }
      } catch (e) {
        console.error("Remote search error:", e);
      } finally {
        if (isCurrent) setSearchingRemote(false);
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const cleanFilter = searchQuery.toLowerCase().replace(/^@/, "").trim();
  const filteredContacts = contacts.filter((c) => {
    if (!cleanFilter) return true;
    return (
      c.name.toLowerCase().includes(cleanFilter) ||
      (c.username && c.username.toLowerCase().includes(cleanFilter)) ||
      c.currentCompany?.toLowerCase().includes(cleanFilter) ||
      c.currentRole?.toLowerCase().includes(cleanFilter) ||
      c.batchYear.toString().includes(cleanFilter)
    );
  });

  const handleClearCallLogs = async () => {
    if (confirm("Clear your entire call history from this device?")) {
      await clearCallLogs();
      setCallLogs([]);
    }
  };

  // Signal-style client-side phone number hashing
  const hashPhoneNumberLocally = async (phone: string): Promise<string | null> => {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10) return null;
    const last10 = digits.slice(-10);
    const data = new TextEncoder().encode("alumni_disc_v1:" + last10);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  // Sync Phone Contacts Action via Privacy-Preserving Discovery
  const handleSyncContacts = async (numbersToSync?: string[]) => {
    setSyncError(null);
    const list =
      numbersToSync ||
      rawPhoneInput
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (list.length === 0) {
      setSyncError("Please enter at least one phone number to search.");
      return;
    }

    setSyncing(true);
    try {
      // 1. Compute SHA-256 hashes locally on the client device
      const hashes = (
        await Promise.all(list.map((num) => hashPhoneNumberLocally(num)))
      ).filter((h): h is string => Boolean(h));

      if (hashes.length === 0) {
        throw new Error("Please enter valid 10-digit mobile numbers.");
      }

      // 2. Dispatch ONLY hashes to private discovery endpoint (server never receives raw phone numbers)
      const res = await fetch("/api/contacts/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneHashes: hashes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to discover contacts");
      }

      const matches = data.matches || [];
      setMatchedRegistered(matches);

      // 3. Compute unregistered list locally for optional SMS invites
      const matchedUsernames = new Set(matches.map((m: any) => m.name.toLowerCase()));
      const unreg: UnregisteredContact[] = [];
      for (const num of list) {
        const clean = num.replace(/[^0-9]/g, "");
        if (clean.length >= 10) {
          const last10 = clean.slice(-10);
          unreg.push({
            phone: last10,
            inviteSmsUrl: `/api/test-sms?phone=${last10}`,
          });
        }
      }
      setMatchedUnregistered(unreg);
    } catch (err: any) {
      setSyncError(err.message || "Failed to discover contacts");
    } finally {
      setSyncing(false);
    }
  };

  // Modern Web Contact Picker API (if supported on mobile browsers)
  const handlePickPhoneContacts = async () => {
    if ("contacts" in navigator && "ContactsManager" in window) {
      try {
        const props = ["name", "tel"];
        const opts = { multiple: true };
        const contactsPicked = await (navigator as any).contacts.select(props, opts);
        const phones: string[] = [];
        for (const c of contactsPicked) {
          if (c.tel && Array.isArray(c.tel)) {
            phones.push(...c.tel);
          }
        }
        if (phones.length > 0) {
          setRawPhoneInput(phones.join("\n"));
          await handleSyncContacts(phones);
        }
      } catch (e) {
        console.warn("Contacts picker dismissed or not permitted:", e);
      }
    } else {
      alert("Direct address-book picker is available on supported mobile Chrome/Android browsers. You can paste or type phone numbers in the box below!");
    }
  };

  // Dispatch Test SMS via Fast2SMS
  const handleSendTestSms = async () => {
    if (!testPhoneNumber.trim()) {
      alert("Please enter a 10-digit mobile number");
      return;
    }

    setSendingSms(true);
    setSmsResult(null);

    try {
      const res = await fetch("/api/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhoneNumber.trim(),
          message: testCustomMessage.trim() || undefined,
        }),
      });

      const data = await res.json();
      setSmsResult(data);
    } catch (err: any) {
      setSmsResult({
        success: false,
        message: err.message || "Network request failed",
      });
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 leading-tight">Private Messages</h1>
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-slate-400">Signal-grade E2EE & Direct Calling</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* My QR Code Button */}
            <button
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/70 transition"
              title="My Connect QR Code & Key Exchange"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">My QR</span>
            </button>

            {/* Find Contacts Button */}
            <button
              onClick={() => setShowSyncModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              title="Find contacts from your phone"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Sync Contacts</span>
            </button>

            {/* Test SMS Button */}
            <button
              onClick={() => setShowSmsModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200/80 transition"
              title="Test SMS Dispatch (Fast2SMS)"
            >
              <Send className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Test SMS</span>
            </button>

            <Link
              href="/settings/privacy/dashboard"
              className="h-9 w-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-700 transition"
              title="My Privacy Dashboard"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </Link>

            <Link
              href="/settings/privacy"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              title="Privacy & Keys"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              onClick={() => setShowNewChatModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Emergency Privacy Lock Active Banner */}
        {privacyLockActive && (
          <div className="p-3.5 rounded-2xl bg-rose-600 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-white shrink-0" />
              <div>
                <p className="text-xs font-bold">🔒 PRIVACY LOCK ACTIVE</p>
                <p className="text-[11px] text-rose-100">Identity hidden, incoming calls auto-blocked, ghost mode active.</p>
              </div>
            </div>
            <Link
              href="/settings/privacy/dashboard"
              className="px-3 py-1 rounded-xl bg-white text-rose-900 text-xs font-bold hover:bg-rose-50 transition shrink-0 shadow-2xs"
            >
              Unlock
            </Link>
          </div>
        )}

        {/* E2EE Info Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-900 leading-relaxed">
            <strong>Signal/Telegram-grade E2EE:</strong> Messages and calls are encrypted on your device.
            Our servers never receive plaintext content. Search directly by name or <strong>@username</strong> below.
          </p>
        </div>

        {/* Search & Pull-to-Refresh Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={
                tab === "CHATS"
                  ? "Search by @username, name, or batch..."
                  : tab === "CALLS"
                  ? "Search call records..."
                  : "Search alumni directory..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            />
            {searchingRemote && (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3.5 top-3" />
            )}
          </div>

          {/* Pull to refresh / spring refresh button */}
          <motion.button
            whileTap={{ scale: 0.9, rotate: 180 }}
            transition={MOTION_SPRINGS.snappy}
            onClick={async () => {
              setRefreshing(true);
              triggerHaptic("medium");
              try {
                const [dirRes, calls] = await Promise.all([
                  fetch("/api/directory?limit=50"),
                  getCallLogs(),
                ]);
                if (dirRes.ok) {
                  const dirData = await dirRes.json();
                  setContacts(dirData.alumni || dirData.users || []);
                }
                setCallLogs(calls);
                triggerHaptic("success");
              } catch (e) {
                console.error(e);
              } finally {
                setRefreshing(false);
              }
            }}
            className="h-10 w-10 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 flex items-center justify-center shadow-2xs transition shrink-0"
            title="Refresh E2EE Sessions"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </motion.button>
        </div>

        {/* TAB 1: CHATS (Swipeable conversation cards) */}
        {tab === "CHATS" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs">Loading encrypted conversations...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-3">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">No matching contacts found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Search by another name/username or sync your phone contacts
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <AnimatedButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setTab("CONTACTS")}
                  >
                    Find Contacts
                  </AnimatedButton>
                  <AnimatedButton
                    size="sm"
                    variant="primary"
                    onClick={() => setShowNewChatModal(true)}
                  >
                    View All Alumni
                  </AnimatedButton>
                </div>
              </div>
            ) : (
              filteredContacts
                .filter((c) => !archivedIds.has(c.id))
                .sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0))
                .map((contact) => {
                  const isPinned = pinnedIds.has(contact.id);
                  return (
                    <div key={contact.id} className="relative overflow-hidden group">
                      {/* Swipe reveal actions behind card */}
                      <div className="absolute inset-y-0 left-0 w-24 bg-blue-500 text-white flex items-center justify-center gap-1 font-bold text-xs px-3">
                        <Pin className="w-3.5 h-3.5" />
                        <span>{isPinned ? "Unpin" : "Pin"}</span>
                      </div>
                      <div className="absolute inset-y-0 right-0 w-24 bg-slate-700 text-white flex items-center justify-center gap-1 font-bold text-xs px-3">
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive</span>
                      </div>

                      {/* Foreground swipeable card */}
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -70, right: 70 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                          if (info.offset.x > 45) {
                            triggerHaptic("medium");
                            setPinnedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(contact.id)) next.delete(contact.id);
                              else next.add(contact.id);
                              return next;
                            });
                          } else if (info.offset.x < -45) {
                            triggerHaptic("medium");
                            setArchivedIds((prev) => new Set(prev).add(contact.id));
                          }
                        }}
                        whileTap={{ scale: 0.985 }}
                        className="relative z-10 bg-white p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition cursor-pointer select-none"
                        onClick={() => router.push(`/messages/${contact.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-base font-bold shadow-sm shadow-blue-500/20 shrink-0">
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-400/40" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                                {contact.name}
                              </p>
                              {isPinned && (
                                <span className="p-0.5 rounded-md bg-blue-100 text-blue-700">
                                  <Pin className="w-3 h-3" />
                                </span>
                              )}
                              {contact.username && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                  @{contact.username}
                                </span>
                              )}
                              {contact.verificationStatus === "VERIFIED" && (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {contact.currentRole || "Alumni Member"}{" "}
                              {contact.currentCompany ? `at ${contact.currentCompany}` : ""}
                            </p>
                            <p className="text-[10px] text-slate-400">Class of {contact.batchYear}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="h-8 px-3 rounded-xl bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-[11px] font-bold text-slate-600 flex items-center transition">
                            Chat →
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* TAB 2: CALLS */}
        {tab === "CALLS" && (
          <div className="space-y-3">
            {callLogs.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleClearCallLogs}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold px-3 py-1 rounded-lg hover:bg-rose-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear History
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {callLogs.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  <Phone className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No call records yet</p>
                  <p className="text-[11px] mt-1">Direct voice and video calls will appear here</p>
                </div>
              ) : (
                callLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    whileTap={{ scale: 0.99 }}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
                          log.status === "MISSED"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {log.status === "MISSED" ? (
                          <PhoneMissed className="w-5 h-5" />
                        ) : log.direction === "INCOMING" ? (
                          <PhoneIncoming className="w-5 h-5" />
                        ) : (
                          <PhoneOutgoing className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{log.peerName}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span>{log.callType === "VIDEO" ? "Video Call" : "Voice Call"}</span>
                          <span>•</span>
                          <span>
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {log.durationSeconds > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/messages/${log.peerId}`)}
                      className="h-9 w-9 rounded-2xl bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition"
                      title="Call back"
                    >
                      {log.callType === "VIDEO" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CONTACTS (Privacy-Preserving Contact Hub & QR) */}
        {tab === "CONTACTS" && (
          <div className="space-y-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Privacy-Preserving Contact Discovery</h3>
                  <p className="text-[11px] text-slate-500">
                    Client-side SHA-256 phone hashing. Your address book is never uploaded in plaintext.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <AnimatedButton
                  variant="primary"
                  size="sm"
                  onClick={() => setShowSyncModal(true)}
                >
                  <Smartphone className="w-4 h-4" /> Sync Phone Numbers
                </AnimatedButton>
                <AnimatedButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowQrModal(true)}
                >
                  <QrCode className="w-4 h-4 text-indigo-600" /> Share My QR Code
                </AnimatedButton>
              </div>
            </div>

            {/* Registered Alumni Quick Connect Directory */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Alumni Directory</span>
                <span className="text-[11px] text-slate-400 font-semibold">{contacts.length} verified members</span>
              </div>
              {contacts.slice(0, 15).map((contact) => (
                <div key={contact.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {contact.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{contact.name}</p>
                      {contact.username && (
                        <p className="text-[10px] text-slate-400 font-mono">@{contact.username}</p>
                      )}
                    </div>
                  </div>
                  <AnimatedButton
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/messages/${contact.id}`)}
                  >
                    Connect →
                  </AnimatedButton>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PRIVACY */}
        {tab === "PRIVACY" && (
          <div className="space-y-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Privacy & Security Controls</h3>
                    <p className="text-[11px] text-slate-500">
                      Manage cryptographic device identity, rotated handles, and emergency mode.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Emergency Privacy Lock</p>
                  <p className="text-[11px] text-slate-500">Instantly drops calls and conceals profile in directory</p>
                </div>
                <button
                  onClick={async () => {
                    const next = !privacyLockActive;
                    setPrivacyLockActive(next);
                    triggerHaptic("heavy");
                    await fetch("/api/privacy/lock", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ active: next }),
                    });
                  }}
                  className={`h-7 w-12 rounded-full p-1 transition-colors ${
                    privacyLockActive ? "bg-rose-600" : "bg-slate-300"
                  }`}
                >
                  <motion.div
                    layout
                    transition={MOTION_SPRINGS.snappy}
                    className={`h-5 w-5 rounded-full bg-white shadow-xs ${
                      privacyLockActive ? "ml-auto" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2">
                <Link
                  href="/settings/privacy/dashboard"
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition"
                >
                  <ShieldCheck className="w-4 h-4" /> Open Full Privacy Dashboard →
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </main>

      {/* FLOATING 2026 BOTTOM DOCK NAVIGATION */}
      <FloatingBottomNav
        activeTab={tab}
        onTabChange={setTab}
        missedCallsCount={callLogs.filter((c) => c.status === "MISSED").length}
      />

      {/* MODAL 1: Start New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Start New Encrypted Chat</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select any alumni contact or search above by <strong>@username</strong>:
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setShowNewChatModal(false);
                    router.push(`/messages/${c.id}`);
                  }}
                  className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-xl cursor-pointer transition"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900">{c.name}</p>
                      {c.username && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          @{c.username}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">Class of {c.batchYear}</p>
                  </div>
                  <span className="text-[11px] text-blue-600 font-bold">Start →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Sync Phone Contacts & Matcher Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Find Contacts on App</h2>
                  <p className="text-[11px] text-slate-400">Check who from your address book is registered</p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 text-[11px] text-emerald-800 flex items-start gap-2 border border-emerald-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Address Book Storage:</strong> Contact numbers are hashed locally using client-side SHA-256 before matching. Your phonebook is never uploaded or saved to the server.
              </span>
            </div>

            <div className="shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Enter or paste mobile numbers:</label>
                <button
                  type="button"
                  onClick={handlePickPhoneContacts}
                  className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Pick from Phone
                </button>
              </div>
              <textarea
                value={rawPhoneInput}
                onChange={(e) => setRawPhoneInput(e.target.value)}
                rows={3}
                placeholder="Paste numbers separated by comma or new lines (e.g. 9876543210, 9123456789)"
                className="w-full p-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              />

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setRawPhoneInput("9876543210\n9876543211\n9876543212\n9123456780")}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                >
                  Fill sample numbers
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncContacts()}
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Check Contacts
                </button>
              </div>

              {syncError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{syncError}</span>
                </div>
              )}
            </div>

            {/* Results Display */}
            <div className="flex-1 overflow-y-auto space-y-4 pt-2 border-t border-slate-100">
              {matchedRegistered && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Found on App ({matchedRegistered.length})
                  </h3>
                  {matchedRegistered.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">
                      None of these numbers have an active account yet. You can invite them via SMS below!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {matchedRegistered.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-900">{m.name}</p>
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-medium">
                                {m.username}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              {m.role} • Class of {m.batchYear}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setShowSyncModal(false);
                              router.push(m.messageUrl);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                          >
                            Message →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {matchedUnregistered && matchedUnregistered.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Share2 className="w-4 h-4 text-blue-600" />
                    Not on App Yet — Invite via SMS ({matchedUnregistered.length})
                  </h3>
                  <div className="space-y-2">
                    {matchedUnregistered.map((u, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <p className="text-xs font-mono font-bold text-slate-800">{u.phone}</p>
                        <a
                          href={u.inviteSmsUrl}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Invite via SMS
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Fast2SMS Real SMS Gateway Tester */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Fast2SMS Live Gateway Test</h2>
                  <p className="text-[11px] text-slate-400">Send a real test SMS to any Indian mobile number</p>
                </div>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  10-Digit Indian Mobile Number:
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-2xl text-xs font-bold text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    className="flex-1 p-2.5 text-xs rounded-r-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Custom Message (Optional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Defaults to: Your Alumni Network test code is XXXXXX. Live SMS gateway verified successfully!"
                  value={testCustomMessage}
                  onChange={(e) => setTestCustomMessage(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={sendingSms || testPhoneNumber.length !== 10}
                className="w-full py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {sendingSms ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Dispatching Live SMS...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Live Test SMS
                  </>
                )}
              </button>
            </div>

            {/* Test Results */}
            {smsResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                  smsResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {smsResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{smsResult.message}</span>
                </div>

                {smsResult.wallet && (
                  <div className="text-[11px] bg-white/80 p-2 rounded-xl border border-emerald-100 space-y-0.5">
                    <p>
                      <strong>Fast2SMS Wallet Balance:</strong> ₹{smsResult.wallet.wallet}
                    </p>
                    <p>
                      <strong>Available SMS:</strong> {smsResult.wallet.sms || 200}
                    </p>
                  </div>
                )}

                {smsResult.carrierResponse && (
                  <div className="text-[10px] font-mono bg-white/90 p-2 rounded-xl overflow-x-auto max-h-28 text-slate-700">
                    <pre>{JSON.stringify(smsResult.carrierResponse, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal for In-Person Key Exchange & Instant Chat Connection */}
      {currentUserProfile && (
        <QRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          currentUser={currentUserProfile}
        />
      )}
    </div>
  );
}

