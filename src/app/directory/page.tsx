"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Users,
  Building,
  GraduationCap,
  MapPin,
  ShieldCheck,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquare,
  UserPlus,
  CheckCircle2,
  Clock,
  UserCheck,
  UserMinus,
  X,
  Sparkles,
  Send,
  Inbox,
  MoreVertical,
} from "lucide-react";
import { addLocalConnectedPeer, syncLocalConnectedPeers, setActiveVaultUser } from "@/lib/e2ee/vault";

interface ConnectionProfile {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
  city: string | null;
  verificationStatus: string;
  isOpenToMentor?: boolean;
  institution: { id?: string; name: string; city: string | null };
  department?: { id?: string; name: string } | null;
  connectedAt?: string;
  mutualCount?: number;
}

interface InvitationItem {
  id: string;
  createdAt: string;
  user: ConnectionProfile;
  mutualCount: number;
}

interface CurrentUserContext {
  id: string;
  name: string;
  institutionId?: string;
  institutionName?: string;
  batchYear?: number;
}

export default function DirectoryPage() {
  // Navigation tabs: "grow" (People You May Know / Directory) | "invitations" | "connections"
  const [activeTab, setActiveTab] = useState<"grow" | "invitations" | "connections">("grow");
  const [invitationsSubTab, setInvitationsSubTab] = useState<"received" | "sent">("received");

  // Core Data
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<InvitationItem[]>([]);
  const [sentInvitations, setSentInvitations] = useState<InvitationItem[]>([]);
  const [alumni, setAlumni] = useState<ConnectionProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserContext | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [connectionsSearch, setConnectionsSearch] = useState("");
  const [institutionScope, setInstitutionScope] = useState<"my" | "all">("my");
  const [batchScope, setBatchScope] = useState<string>("my");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");

  const [availableBatches, setAvailableBatches] = useState<number[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);

  // States & Status Map
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, "NOT_CONNECTED" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED">>({});
  const [mutualMap, setMutualMap] = useState<Record<string, number>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // 1. Fetch Authoritative Connection Network Data
  const fetchNetworkData = async () => {
    try {
      const res = await fetch("/api/connections");
      if (!res.ok) return;
      const data = await res.json();

      if (data.connections) {
        setConnections(data.connections);
        const peerIds = data.connections.map((c: ConnectionProfile) => c.id);
        if (currentUserId) {
          syncLocalConnectedPeers(peerIds, currentUserId);
        }
      }
      if (Array.isArray(data.receivedInvitations)) {
        setReceivedInvitations(data.receivedInvitations);
      }
      if (Array.isArray(data.sentInvitations)) {
        setSentInvitations(data.sentInvitations);
      }

      // Build status map from database
      const newStatusMap: Record<string, "NOT_CONNECTED" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {};
      const newMutualMap: Record<string, number> = {};

      data.connections?.forEach((c: ConnectionProfile) => {
        newStatusMap[c.id] = "CONNECTED";
        if (typeof c.mutualCount === "number") newMutualMap[c.id] = c.mutualCount;
      });

      data.receivedInvitations?.forEach((inv: InvitationItem) => {
        if (inv.user?.id) {
          newStatusMap[inv.user.id] = "PENDING_INCOMING";
          newMutualMap[inv.user.id] = inv.mutualCount || 0;
        }
      });

      data.sentInvitations?.forEach((inv: InvitationItem) => {
        if (inv.user?.id) {
          newStatusMap[inv.user.id] = "PENDING_OUTGOING";
          newMutualMap[inv.user.id] = inv.mutualCount || 0;
        }
      });

      setStatusMap(newStatusMap);
      setMutualMap((prev) => ({ ...prev, ...newMutualMap }));
    } catch (err) {
      console.warn("Failed to fetch network data:", err);
    }
  };

  useEffect(() => {
    fetchNetworkData();
    window.addEventListener("connection-requests-updated", fetchNetworkData);
    return () => window.removeEventListener("connection-requests-updated", fetchNetworkData);
  }, [currentUserId]);

  // 2. Fetch Directory Recommendations & Users
  useEffect(() => {
    let isCancelled = false;
    const fetchDirectory = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        params.set("institutionScope", institutionScope);
        params.set("batchScope", batchScope);
        if (selectedCity !== "all") params.set("city", selectedCity);
        if (selectedDept !== "all") params.set("department", selectedDept);

        const res = await fetch(`/api/directory?${params.toString()}`);
        const data = await res.json();

        if (!isCancelled && data.alumni) {
          setAlumni(data.alumni);
          if (data.currentUser) {
            setCurrentUser(data.currentUser);
            setCurrentUserId(data.currentUser.id);
            setActiveVaultUser(data.currentUser.id);
          }
          if (data.availableBatches) setAvailableBatches(data.availableBatches);
          if (data.availableCities) setAvailableCities(data.availableCities);
          if (data.availableDepartments) setAvailableDepts(data.availableDepartments);
        }
      } catch (err) {
        console.error("Failed to load directory:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const debounce = setTimeout(fetchDirectory, 200);
    return () => {
      isCancelled = true;
      clearTimeout(debounce);
    };
  }, [searchQuery, institutionScope, batchScope, selectedCity, selectedDept]);

  // Actions: Connect, Accept, Ignore, Withdraw, Remove
  const handleConnect = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistic UI
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "PENDING_OUTGOING" }));

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONNECT", targetUserId }),
      });
      const data = await res.json();
      if (data.relationship?.status === "CONNECTED") {
        setStatusMap((prev) => ({ ...prev, [targetUserId]: "CONNECTED" }));
        if (currentUserId) addLocalConnectedPeer(targetUserId, currentUserId);
      }
      fetchNetworkData();
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error("Connect error:", err);
      fetchNetworkData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAccept = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistic UI
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "CONNECTED" }));
    setReceivedInvitations((prev) => prev.filter((inv) => inv.user?.id !== targetUserId));
    if (currentUserId) addLocalConnectedPeer(targetUserId, currentUserId);

    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT", targetUserId }),
      });
      fetchNetworkData();
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error("Accept error:", err);
      fetchNetworkData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleIgnore = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistic UI
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "NOT_CONNECTED" }));
    setReceivedInvitations((prev) => prev.filter((inv) => inv.user?.id !== targetUserId));

    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "IGNORE", targetUserId }),
      });
      fetchNetworkData();
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error("Ignore error:", err);
      fetchNetworkData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWithdraw = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistic UI
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "NOT_CONNECTED" }));
    setSentInvitations((prev) => prev.filter((inv) => inv.user?.id !== targetUserId));

    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW", targetUserId }),
      });
      fetchNetworkData();
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error("Withdraw error:", err);
      fetchNetworkData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveConnection = async (targetUserId: string) => {
    setMenuOpenId(null);
    if (!confirm("Are you sure you want to remove this connection?")) return;

    setActionLoadingId(targetUserId);
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "NOT_CONNECTED" }));
    setConnections((prev) => prev.filter((c) => c.id !== targetUserId));

    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE", targetUserId }),
      });
      fetchNetworkData();
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error("Remove connection error:", err);
      fetchNetworkData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const userBatchYear = currentUser?.batchYear || 2026;
  const userInstName = currentUser?.institutionName || "All Colleges";

  // Filtered connections list for search
  const filteredConnections = useMemo(() => {
    const q = connectionsSearch.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.username && c.username.toLowerCase().includes(q)) ||
        (c.currentCompany && c.currentCompany.toLowerCase().includes(q)) ||
        (c.currentRole && c.currentRole.toLowerCase().includes(q)) ||
        (c.institution?.name && c.institution.name.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        c.batchYear.toString().includes(q)
      );
    });
  }, [connections, connectionsSearch]);

  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col pb-28 sm:pb-16">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#0a0f1d]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-8 shadow-lg shadow-black/40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white leading-tight">My Network</h1>
                <span className="text-[10px] font-bold bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/30 px-2 py-0.5 rounded-full">
                  LinkedIn Style
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {connections.length} {connections.length === 1 ? "1st-degree connection" : "1st-degree connections"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
              {activeTab === "connections"
                ? `${connections.length} Connections`
                : activeTab === "invitations"
                ? `${receivedInvitations.length} Received`
                : `${alumni.length} Alumni`}
            </span>
          </div>
        </div>

        {/* 3 Main LinkedIn Hub Tabs */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 pt-2 border-t border-white/10 mt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("grow")}
            className={`pb-2 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "grow"
                ? "border-[#ff9933] text-[#ff9933]"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Grow</span>
            {receivedInvitations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold animate-pulse">
                {receivedInvitations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`pb-2 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "invitations"
                ? "border-[#ff9933] text-[#ff9933]"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Invitations</span>
            {receivedInvitations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-extrabold shadow-xs">
                {receivedInvitations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("connections")}
            className={`pb-2 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "connections"
                ? "border-[#ff9933] text-[#ff9933]"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Connections</span>
            {connections.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold">
                {connections.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* ========================================================================= */}
        {/* TAB 1: GROW (PEOPLE YOU MAY KNOW + DIRECTORY + QUICK INVITATIONS)         */}
        {/* ========================================================================= */}
        {activeTab === "grow" && (
          <div className="space-y-5">
            {/* Quick Received Invitations Box */}
            {receivedInvitations.length > 0 && (
              <div className="bg-[#111726]/80 rounded-2xl border border-white/10 shadow-lg shadow-black/40 overflow-hidden backdrop-blur-xl animate-in fade-in duration-200">
                <div className="bg-gradient-to-r from-blue-950/80 via-[#000066]/60 to-[#111726]/80 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-[#FF9933] to-[#FF8008] text-white flex items-center justify-center shadow-xs">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white leading-none">
                        Invitations ({receivedInvitations.length})
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Alumni waiting to connect with you
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("invitations");
                      setInvitationsSubTab("received");
                    }}
                    className="text-xs font-semibold text-[#FF9933] hover:underline cursor-pointer"
                  >
                    See all
                  </button>
                </div>

                <div className="divide-y divide-white/8">
                  {receivedInvitations.slice(0, 3).map((inv) => {
                    const person = inv.user;
                    if (!person) return null;
                    const isLoading = actionLoadingId === person.id;

                    return (
                      <div
                        key={inv.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.04] transition"
                      >
                        <Link
                          href={`/profile/${person.id}`}
                          className="flex items-center gap-3.5 min-w-0 group"
                        >
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 overflow-hidden group-hover:scale-105 transition-transform border border-white/10">
                            {person.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={person.avatarUrl}
                                alt={person.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              person.name?.charAt(0).toUpperCase() || "A"
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-white group-hover:text-[#FF9933] transition truncate">
                                {person.name}
                              </span>
                              {person.username && (
                                <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
                                  @{person.username}
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-slate-300 bg-white/10 px-1.5 py-0.2 rounded-full border border-white/15">
                                2nd
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 truncate font-medium">
                              {person.currentRole || "Alumni Member"}
                              {person.currentCompany && ` at ${person.currentCompany}`}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{person.institution?.name || "Campus"}</span>
                              <span>•</span>
                              <span>Class of {person.batchYear}</span>
                              {inv.mutualCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#FF9933] font-semibold">
                                    {inv.mutualCount} mutual
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(e) => handleIgnore(e, person.id)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            Ignore
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(e) => handleAccept(e, person.id)}
                            className="btn-india-green px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {isLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Accept</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* People You May Know Header & Subtitle */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF9933]" />
                  <span>People You May Know</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Based on your institution ({userInstName}) and graduation batch ({userBatchYear})
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alumni by name, company, role, batch, or city..."
                className="w-full rounded-2xl border border-white/10 bg-[#111726] py-3 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-400 outline-none shadow-sm transition focus:border-[#ff9933]/50 focus:ring-2 focus:ring-[#ff9933]/30"
              />
            </div>

            {/* Filter Controls Box */}
            <div className="bg-[#111726]/80 rounded-2xl border border-white/10 p-4 shadow-lg shadow-black/40 space-y-3 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                {/* Institution Scope Toggle */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setInstitutionScope("my")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      institutionScope === "my"
                        ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {userInstName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstitutionScope("all")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      institutionScope === "all"
                        ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All Institutions
                  </button>
                </div>

                {/* Batch Scope Toggle */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBatchScope("my")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      batchScope === "my"
                        ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Class of {userBatchYear}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchScope("all")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      batchScope === "all"
                        ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All Batches
                  </button>
                </div>
              </div>

              {/* Granular Filter Selectors */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <Filter className="w-3 h-3 text-[#FF9933]" /> Filters:
                </span>

                <select
                  value={batchScope}
                  onChange={(e) => setBatchScope(e.target.value)}
                  className="bg-[#161f36] border border-white/10 rounded-lg py-1 px-2.5 text-xs text-slate-200 outline-none focus:border-[#ff9933]/50"
                >
                  <option value="my">Batch: Class of {userBatchYear}</option>
                  <option value="all">Batch: All Years</option>
                  {availableBatches
                    .filter((y) => y !== userBatchYear)
                    .map((y) => (
                      <option key={y} value={y.toString()}>
                        Batch: Class of {y}
                      </option>
                    ))}
                </select>

                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-[#161f36] border border-white/10 rounded-lg py-1 px-2.5 text-xs text-slate-200 outline-none focus:border-[#ff9933]/50"
                >
                  <option value="all">City: All Locations</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>
                      City: {c}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-[#161f36] border border-white/10 rounded-lg py-1 px-2.5 text-xs text-slate-200 outline-none focus:border-[#ff9933]/50"
                >
                  <option value="all">Department: All</option>
                  {availableDepts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {(searchQuery ||
                  institutionScope !== "my" ||
                  batchScope !== "my" ||
                  selectedCity !== "all" ||
                  selectedDept !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setInstitutionScope("my");
                      setBatchScope("my");
                      setSelectedCity("all");
                      setSelectedDept("all");
                    }}
                    className="text-[#FF9933] hover:underline font-medium text-xs ml-auto cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Recommendations Grid / Cards */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#FF9933]" />
                <p className="text-xs">Finding alumni recommendations...</p>
              </div>
            ) : alumni.length === 0 ? (
              <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-8 text-center space-y-3 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">No alumni found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Try switching the scope toggles above to <strong>&ldquo;All Batches&rdquo;</strong> or{" "}
                  <strong>&ldquo;All Institutions&rdquo;</strong>, or clearing your search keywords.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setBatchScope("all");
                    setInstitutionScope("all");
                  }}
                  className="btn-saffron inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  Expand to All Batches & Institutions
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {alumni.map((person) => {
                  const isCurrentUser = currentUser?.id === person.id;
                  const rel = statusMap[person.id] || "NOT_CONNECTED";
                  const mutuals = mutualMap[person.id] || 0;
                  const isLoading = actionLoadingId === person.id;

                  return (
                    <div
                      key={person.id}
                      className="bg-[#111726]/90 rounded-2xl border border-white/10 p-4 shadow-lg shadow-black/30 hover:border-[#ff9933]/40 hover:bg-[#151c2e] transition group flex flex-col justify-between backdrop-blur-xl relative overflow-hidden"
                    >
                      <Link href={`/profile/${person.id}`} className="block space-y-3">
                        <div className="flex items-start gap-3">
                          {/* Avatar Circle */}
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden border border-white/10">
                            {person.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={person.avatarUrl}
                                alt={person.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              person.name.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-sm font-bold text-white group-hover:text-[#FF9933] transition truncate">
                                {person.name}
                              </h3>
                              {/* Degree badge */}
                              {rel === "CONNECTED" ? (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                                  1st
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-300 bg-white/10 border border-white/15 px-1.5 py-0.2 rounded-full">
                                  {mutuals > 0 ? "2nd" : "3rd"}
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-[10px] font-bold bg-white/10 text-slate-300 px-1.5 py-0.2 rounded">
                                  You
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 truncate font-medium">
                              {person.currentRole || "Alumni Member"}
                              {person.currentCompany && ` at ${person.currentCompany}`}
                            </p>

                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <Building className="w-3 h-3 text-orange-400 shrink-0" />
                              <span className="truncate">{person.institution?.name}</span>
                              <span>•</span>
                              <span>{person.batchYear}</span>
                            </p>
                          </div>
                        </div>

                        {/* Mutual Connection Chip */}
                        {mutuals > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-300 bg-white/5 rounded-xl px-2.5 py-1 border border-white/10">
                            <Users className="w-3 h-3 text-[#FF9933] shrink-0" />
                            <span>{mutuals} mutual {mutuals === 1 ? "connection" : "connections"}</span>
                          </div>
                        )}
                      </Link>

                      {/* Action Button */}
                      {!isCurrentUser && (
                        <div className="pt-3 mt-1 border-t border-white/10 flex items-center justify-between gap-2">
                          {rel === "CONNECTED" ? (
                            <Link
                              href={`/messages/${person.id}`}
                              className="btn-saffron w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Message</span>
                            </Link>
                          ) : rel === "PENDING_INCOMING" ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={(e) => handleIgnore(e, person.id)}
                                className="w-1/2 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                              >
                                Ignore
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={(e) => handleAccept(e, person.id)}
                                className="btn-india-green w-1/2 py-2 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                <span>Accept</span>
                              </button>
                            </div>
                          ) : rel === "PENDING_OUTGOING" ? (
                            <div className="flex items-center justify-between w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs">
                              <span className="flex items-center gap-1 text-[#ff9933] font-semibold text-[11px]">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending</span>
                              </span>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={(e) => handleWithdraw(e, person.id)}
                                className="text-slate-400 hover:text-rose-400 text-[11px] font-medium transition cursor-pointer"
                              >
                                Withdraw
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={(e) => handleConnect(e, person.id)}
                              className="btn-saffron w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5" />
                              )}
                              <span>Connect</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INVITATIONS (RECEIVED & SENT WITH WITHDRAW)                        */}
        {/* ========================================================================= */}
        {activeTab === "invitations" && (
          <div className="space-y-4">
            {/* Sub-tabs: Received vs Sent */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <button
                type="button"
                onClick={() => setInvitationsSubTab("received")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  invitationsSubTab === "received"
                    ? "bg-[#FF9933] text-white shadow-md shadow-[#FF9933]/20"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Received</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
                  {receivedInvitations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInvitationsSubTab("sent")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  invitationsSubTab === "sent"
                    ? "bg-[#FF9933] text-white shadow-md shadow-[#FF9933]/20"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Sent</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
                  {sentInvitations.length}
                </span>
              </button>
            </div>

            {/* Received Invitations List */}
            {invitationsSubTab === "received" && (
              <div className="space-y-3">
                {receivedInvitations.length === 0 ? (
                  <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-8 text-center space-y-2 backdrop-blur-xl">
                    <Inbox className="w-8 h-8 text-slate-500 mx-auto" />
                    <h3 className="text-sm font-bold text-white">No incoming invitations</h3>
                    <p className="text-xs text-slate-400">
                      When someone invites you to connect, you will see their invitation here.
                    </p>
                  </div>
                ) : (
                  receivedInvitations.map((inv) => {
                    const person = inv.user;
                    if (!person) return null;
                    const isLoading = actionLoadingId === person.id;

                    return (
                      <div
                        key={inv.id}
                        className="bg-[#111726]/90 rounded-2xl border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#151c2e] transition"
                      >
                        <Link href={`/profile/${person.id}`} className="flex items-center gap-3.5 min-w-0">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 overflow-hidden border border-white/10">
                            {person.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" />
                            ) : (
                              person.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white hover:text-[#FF9933] transition truncate">
                                {person.name}
                              </h4>
                              <span className="text-[10px] font-semibold text-slate-300 bg-white/10 px-1.5 py-0.2 rounded-full">
                                2nd
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 truncate font-medium">
                              {person.currentRole || "Alumni"}
                              {person.currentCompany && ` at ${person.currentCompany}`}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{person.institution?.name}</span>
                              <span>•</span>
                              <span>Class of {person.batchYear}</span>
                              {inv.mutualCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#FF9933] font-semibold">{inv.mutualCount} mutual connections</span>
                                </>
                              )}
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(e) => handleIgnore(e, person.id)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            Ignore
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(e) => handleAccept(e, person.id)}
                            className="btn-india-green px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Accept</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Sent Invitations List */}
            {invitationsSubTab === "sent" && (
              <div className="space-y-3">
                {sentInvitations.length === 0 ? (
                  <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-8 text-center space-y-2 backdrop-blur-xl">
                    <Send className="w-8 h-8 text-slate-500 mx-auto" />
                    <h3 className="text-sm font-bold text-white">No pending sent invitations</h3>
                    <p className="text-xs text-slate-400">
                      When you send a connection request, you can track or withdraw it here.
                    </p>
                  </div>
                ) : (
                  sentInvitations.map((inv) => {
                    const person = inv.user;
                    if (!person) return null;
                    const isLoading = actionLoadingId === person.id;

                    return (
                      <div
                        key={inv.id}
                        className="bg-[#111726]/90 rounded-2xl border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#151c2e] transition"
                      >
                        <Link href={`/profile/${person.id}`} className="flex items-center gap-3.5 min-w-0">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 overflow-hidden border border-white/10">
                            {person.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" />
                            ) : (
                              person.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-sm font-bold text-white hover:text-[#FF9933] transition truncate">
                              {person.name}
                            </h4>
                            <p className="text-xs text-slate-300 truncate font-medium">
                              {person.currentRole || "Alumni"}
                              {person.currentCompany && ` at ${person.currentCompany}`}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{person.institution?.name}</span>
                              <span>•</span>
                              <span>Class of {person.batchYear}</span>
                              <span>•</span>
                              <span className="text-amber-400">Pending</span>
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(e) => handleWithdraw(e, person.id)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                          >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            <span>Withdraw</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CONNECTIONS (1ST-DEGREE CONNECTIONS WITH SEARCH & REMOVE)          */}
        {/* ========================================================================= */}
        {activeTab === "connections" && (
          <div className="space-y-4">
            {/* Search within connections */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={connectionsSearch}
                onChange={(e) => setConnectionsSearch(e.target.value)}
                placeholder="Search your 1st-degree connections by name, company, role, or city..."
                className="w-full rounded-2xl border border-white/10 bg-[#111726] py-3 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-400 outline-none shadow-sm transition focus:border-[#ff9933]/50 focus:ring-2 focus:ring-[#ff9933]/30"
              />
            </div>

            {filteredConnections.length === 0 ? (
              <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-8 text-center space-y-3 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF9933]">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {connections.length === 0 ? "No connections yet" : "No matching connections found"}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {connections.length === 0
                    ? "Connect with alumni, batchmates, and professors in the Grow tab to build your 1st-degree network."
                    : "Try searching with different keywords."}
                </p>
                {connections.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("grow")}
                    className="btn-saffron inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Grow Your Network</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConnections.map((friend) => {
                  const isVerified = friend.verificationStatus === "VERIFIED";
                  const isMenuOpen = menuOpenId === friend.id;

                  return (
                    <div
                      key={friend.id}
                      className="bg-[#111726]/80 rounded-2xl border border-white/10 p-4 sm:p-5 shadow-lg shadow-black/30 hover:border-[#ff9933]/40 hover:bg-[#151c2e] transition flex items-center justify-between gap-3 group backdrop-blur-xl relative"
                    >
                      <Link href={`/profile/${friend.id}`} className="flex items-start gap-3.5 min-w-0">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden border border-white/10">
                          {friend.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={friend.avatarUrl} alt={friend.name} className="w-full h-full object-cover" />
                          ) : (
                            friend.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm font-bold text-white group-hover:text-[#FF9933] transition truncate">
                              {friend.name}
                            </h2>
                            {/* 1st degree badge */}
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                              1st
                            </span>
                            {friend.username && (
                              <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md font-medium border border-white/10">
                                @{friend.username}
                              </span>
                            )}
                            {isVerified && (
                              <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5 text-blue-400" /> Verified
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300 truncate font-medium">
                            {friend.currentRole || "Alumni"}
                            {friend.currentCompany && ` at ${friend.currentCompany}`}
                          </p>

                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 font-medium">
                              <Building className="w-3 h-3 text-orange-400 shrink-0" />
                              {friend.institution?.name || "Campus"}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3 text-slate-400" />
                              Class of {friend.batchYear}
                            </span>
                            {friend.connectedAt && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-400">
                                  Connected {new Date(friend.connectedAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Direct Message Button & 3-dots Menu */}
                      <div className="flex items-center gap-2 shrink-0 relative">
                        <Link
                          href={`/messages/${friend.id}`}
                          className="btn-saffron h-8 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                          title="Message"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setMenuOpenId(isMenuOpen ? null : friend.id)}
                          className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Options Dropdown */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-10 w-48 rounded-xl bg-[#0d1326] border border-white/15 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95">
                            <button
                              type="button"
                              onClick={() => handleRemoveConnection(friend.id)}
                              className="w-full text-left px-3.5 py-2 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 text-xs font-semibold cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Remove Connection</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
