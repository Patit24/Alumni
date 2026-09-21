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
  Clock,
  Trash2,
  Settings,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Sparkles,
  Users,
  MessageSquare,
} from "lucide-react";
import { getCallLogs, clearCallLogs, VaultCallLog } from "@/lib/e2ee/vault";

interface AlumniContact {
  id: string;
  name: string;
  currentRole: string | null;
  currentCompany: string | null;
  batchYear: number;
  verificationStatus: string;
  department?: { name: string } | null;
}

export default function MessagesHubPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"CHATS" | "CALLS">("CHATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<AlumniContact[]>([]);
  const [callLogs, setCallLogs] = useState<VaultCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Fetch alumni contacts for starting new encrypted conversations
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dirRes, calls] = await Promise.all([
          fetch("/api/directory?limit=30"),
          getCallLogs(),
        ]);

        if (dirRes.ok) {
          const dirData = await dirRes.json();
          setContacts(dirData.users || []);
        }

        setCallLogs(calls);
      } catch (err) {
        console.error("Error loading messages hub:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.currentCompany?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.batchYear.toString().includes(searchQuery)
  );

  const handleClearCallLogs = async () => {
    if (confirm("Clear your entire call history from this device?")) {
      await clearCallLogs();
      setCallLogs([]);
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
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 leading-tight">Private Messages</h1>
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-slate-400">End-to-End Encrypted Communication</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/privacy"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              title="Privacy & Security"
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
        {/* E2EE Info Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-900 leading-relaxed">
            <strong>Signal/Telegram-grade E2EE:</strong> Messages and calls are encrypted on your device.
            Our servers never receive plaintext message content or call media.
          </p>
        </div>

        {/* Tab Switcher: Chats vs Calls */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
          <button
            onClick={() => setTab("CHATS")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
              tab === "CHATS"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Direct Chats
          </button>
          <button
            onClick={() => setTab("CALLS")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
              tab === "CALLS"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Call History {callLogs.length > 0 && `(${callLogs.length})`}
          </button>
        </div>

        {/* Search Filter */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={tab === "CHATS" ? "Search contacts or batchmates..." : "Search calls..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* CHATS TAB */}
        {tab === "CHATS" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            {filteredContacts.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold">No direct conversations found</p>
                <p className="text-[11px] mt-1">Tap &quot;New Chat&quot; to message any alumni contact</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/messages/${contact.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-base font-bold shadow-sm shadow-blue-500/20 shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                          {contact.name}
                        </p>
                        {contact.verificationStatus === "VERIFIED" && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {contact.currentRole || "Alumni Member"} {contact.currentCompany ? `at ${contact.currentCompany}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400">Class of {contact.batchYear}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="h-8 px-3 rounded-xl bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-[11px] font-bold text-slate-600 flex items-center transition">
                      Chat →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* CALLS TAB */}
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
                  <div key={log.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center ${
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
                          <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {log.durationSeconds > 0 && (
                            <>
                              <span>•</span>
                              <span>{Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/messages/${log.peerId}`)}
                      className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
                      title="Call back"
                    >
                      {log.callType === "VIDEO" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* New Chat Contact Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Start New Encrypted Chat</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select any verified batchmate or alumni from your institution to start an end-to-end encrypted chat:
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
                    <p className="text-xs font-bold text-slate-900">{c.name}</p>
                    <p className="text-[10px] text-slate-400">Class of {c.batchYear}</p>
                  </div>
                  <span className="text-[11px] text-blue-600 font-bold">Start →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
