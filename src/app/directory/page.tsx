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
  Sparkles,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquare,
  Lock,
  UserPlus,
  CheckCircle2,
  Clock,
  UserCheck,
  X,
  Briefcase,
} from "lucide-react";
import { addLocalConnectedPeer, setActiveVaultUser } from "@/lib/e2ee/vault";

interface AlumniUser {
  id: string;
  name: string;
  username?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  verificationStatus: string;
  batchYear: number;
  currentCompany: string | null;
  currentRole: string | null;
  city: string | null;
  isOpenToMentor?: boolean;
  institution: { id?: string; name: string; city: string | null };
  department?: { id?: string; name: string } | null;
}

interface IncomingRequest {
  id: string;
  createdAt: string;
  user: AlumniUser;
}

interface CurrentUserContext {
  id: string;
  name: string;
  institutionId: string;
  institutionName: string;
  batchYear: number;
}

export default function DirectoryPage() {
  const [alumni, setAlumni] = useState<AlumniUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserContext | null>(null);
  const [availableBatches, setAvailableBatches] = useState<number[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);

  // Navigation tab: "discover" | "connections"
  const [activeTab, setActiveTab] = useState<"discover" | "connections">("discover");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [connectionsSearch, setConnectionsSearch] = useState("");
  const [institutionScope, setInstitutionScope] = useState<"my" | "all">("my");
  const [batchScope, setBatchScope] = useState<string>("my"); // "my" | "all" | string year
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED">>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Incoming invitations & Accepted connections
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [myConnections, setMyConnections] = useState<AlumniUser[]>([]);

  // Fetch true relationship status from server
  const fetchConnectionStatuses = () => {
    fetch("/api/contacts/requests")
      .then((r) => r.json())
      .then((data) => {
        if (data.currentUserId) {
          setCurrentUserId(data.currentUserId);
          setActiveVaultUser(data.currentUserId);
        }
        if (Array.isArray(data.incoming)) {
          setIncomingRequests(data.incoming);
        }
        if (Array.isArray(data.connections)) {
          setMyConnections(data.connections);
        }
        const merged: Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {
          ...(data.statusMap || {}),
        };
        // Mark all server-confirmed connected peers as CONNECTED
        if (Array.isArray(data.connectedPeerIds)) {
          for (const pid of data.connectedPeerIds) {
            if (pid) {
              merged[pid] = "CONNECTED";
              if (data.currentUserId) {
                addLocalConnectedPeer(pid, data.currentUserId);
              }
            }
          }
        }
        setStatusMap(merged);
      })
      .catch((err) => console.warn("Fetch connection status error:", err));
  };

  useEffect(() => {
    fetchConnectionStatuses();
    window.addEventListener("connection-requests-updated", fetchConnectionStatuses);
    return () => window.removeEventListener("connection-requests-updated", fetchConnectionStatuses);
  }, []);

  // 1-Click Connect (Sends PENDING request or auto-accepts if mutual)
  const handleConnect = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistically show pending
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "PENDING_OUTGOING" }));

    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "REQUEST" }),
      });
      const data = await res.json();
      if (data.status === "CONNECTED" || data.status === "ACCEPTED") {
        setStatusMap((prev) => ({ ...prev, [targetUserId]: "CONNECTED" }));
        addLocalConnectedPeer(targetUserId, currentUserId || undefined);

        // Add to connections list if in alumni directory
        const addedPerson = alumni.find((a) => a.id === targetUserId);
        if (addedPerson) {
          setMyConnections((prev) => {
            if (prev.some((p) => p.id === targetUserId)) return prev;
            return [addedPerson, ...prev];
          });
        }
        window.dispatchEvent(new CustomEvent("connection-requests-updated"));
      } else if (data.status === "PENDING") {
        setStatusMap((prev) => ({ ...prev, [targetUserId]: "PENDING_OUTGOING" }));
      }
    } catch (err) {
      console.error("Connect request error:", err);
      fetchConnectionStatuses();
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Accept (Accepts incoming request)
  const handleAccept = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistic UI updates
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "CONNECTED" }));
    addLocalConnectedPeer(targetUserId, currentUserId || undefined);

    // Find person from incoming requests or directory
    const reqItem = incomingRequests.find((r) => r.user?.id === targetUserId);
    const addedPerson = reqItem?.user || alumni.find((a) => a.id === targetUserId);

    // Remove from incoming requests list immediately
    setIncomingRequests((prev) => prev.filter((r) => r.user?.id !== targetUserId));

    if (addedPerson) {
      setMyConnections((prev) => {
        if (prev.some((p) => p.id === targetUserId)) return prev;
        return [addedPerson, ...prev];
      });
    }

    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "ACCEPT" }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("connection-requests-updated"));
      } else {
        fetchConnectionStatuses();
      }
    } catch (err) {
      console.error("Accept error:", err);
      fetchConnectionStatuses();
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Ignore / Reject incoming request
  const handleIgnore = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);

    // Optimistically remove from incoming requests
    setIncomingRequests((prev) => prev.filter((r) => r.user?.id !== targetUserId));
    setStatusMap((prev) => ({ ...prev, [targetUserId]: "NONE" }));

    try {
      await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "REJECT" }),
      });
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error("Ignore request error:", err);
      fetchConnectionStatuses();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Fetch Directory Data
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
          if (data.currentUser) setCurrentUser(data.currentUser);
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

  const userBatchYear = currentUser?.batchYear || 2026;
  const userInstName = currentUser?.institutionName || (currentUser as any)?.institution?.name || "All Colleges";

  // Filtered connections list for the "My Connections" tab
  const filteredConnections = useMemo(() => {
    const q = connectionsSearch.trim().toLowerCase();
    if (!q) return myConnections;
    return myConnections.filter((c) => {
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
  }, [myConnections, connectionsSearch]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Network & Alumni</h1>
              <p className="text-[11px] text-slate-500">
                {activeTab === "connections"
                  ? `${myConnections.length} Accepted Connections`
                  : institutionScope === "my"
                  ? `${userInstName} • Class of ${userBatchYear}`
                  : "All Campuses & Batches"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
              {activeTab === "connections"
                ? `${myConnections.length} Connections`
                : `${alumni.length} Directory`}
            </span>
          </div>
        </div>

        {/* LinkedIn-Style Network Tabs */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 pt-2 border-t border-slate-100 mt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("discover")}
            className={`pb-2 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "discover"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Discover Alumni</span>
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-extrabold animate-pulse shadow-xs">
                {incomingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("connections")}
            className={`pb-2 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "connections"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>My Connections</span>
            {myConnections.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold">
                {myConnections.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* ========================================================================= */}
        {/* LINKEDIN-STYLE INCOMING INVITATIONS SECTION */}
        {/* ========================================================================= */}
        {incomingRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
            <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-slate-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-none">
                    Invitations ({incomingRequests.length})
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Alumni who sent you a connection request
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                1-Click Add
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {incomingRequests.map((req) => {
                const person = req.user;
                if (!person) return null;
                const isVerified = person.verificationStatus === "VERIFIED";
                const isLoading = actionLoadingId === person.id;

                return (
                  <div
                    key={req.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                  >
                    <Link
                      href={`/profile/${person.id}`}
                      className="flex items-center gap-3.5 min-w-0 group"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
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
                          <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                            {person.name}
                          </span>
                          {person.username && (
                            <span className="text-[11px] font-mono text-slate-400">
                              @{person.username}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                              isVerified
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {isVerified && <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />}
                            {isVerified ? "Verified" : "Unverified"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate font-medium">
                          {person.currentRole || "Alumni Member"}
                          {person.currentCompany && ` at ${person.currentCompany}`}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>{person.institution?.name || "Campus"}</span>
                          <span>•</span>
                          <span>Class of {person.batchYear}</span>
                        </p>
                      </div>
                    </Link>

                    {/* Action buttons (1-click Accept & Ignore) */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => handleIgnore(e, person.id)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        Ignore
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => handleAccept(e, person.id)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

        {/* ========================================================================= */}
        {/* TAB 1: MY CONNECTIONS (GUARANTEED NEVER TO VANISH!) */}
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
                placeholder="Search your connections by name, company, role, or city..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none shadow-sm transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {filteredConnections.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {myConnections.length === 0
                    ? "No connections yet"
                    : "No matching connections found"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  {myConnections.length === 0
                    ? "Explore the Discover Alumni tab to connect with peers, batchmates, and mentors from your college."
                    : "Try searching with different keywords."}
                </p>
                {myConnections.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("discover")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Discover Alumni</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConnections.map((friend) => {
                  const isVerified = friend.verificationStatus === "VERIFIED";

                  return (
                    <div
                      key={friend.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition flex items-center justify-between gap-3 group"
                    >
                      <Link
                        href={`/profile/${friend.id}`}
                        className="flex items-start gap-3.5 min-w-0"
                      >
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                          {friend.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={friend.avatarUrl}
                              alt={friend.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            friend.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                              {friend.name}
                            </h2>
                            {friend.username && (
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                                @{friend.username}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Connected
                            </span>
                            {isVerified && (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5 text-blue-600" /> Verified
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 truncate font-medium">
                            {friend.currentRole || "Alumni"}
                            {friend.currentCompany && ` at ${friend.currentCompany}`}
                          </p>

                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-medium">
                              <Building className="w-3 h-3 text-blue-500 shrink-0" />
                              {friend.institution?.name || "Campus"}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3 text-slate-400" />
                              Class of {friend.batchYear}
                            </span>
                            {friend.city && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {friend.city}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Direct Encrypted Message Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/messages/${friend.id}`}
                          className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold transition shadow-xs active:scale-95"
                          title="Open Encrypted Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DISCOVER ALUMNI (ALL USERS WITH DIRECTORY FILTERS) */}
        {/* ========================================================================= */}
        {activeTab === "discover" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by User ID, @username, name, company, role, or city..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none shadow-sm transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Filter Controls Box */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
              {/* Scope Toggles */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                {/* Institution Scope Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setInstitutionScope("my")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      institutionScope === "my"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {userInstName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstitutionScope("all")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      institutionScope === "all"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Institutions
                  </button>
                </div>

                {/* Batch Scope Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBatchScope("my")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      batchScope === "my"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Class of {userBatchYear}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchScope("all")}
                    className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      batchScope === "all"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Batches
                  </button>
                </div>
              </div>

              {/* Granular Filter Selectors */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <Filter className="w-3 h-3" /> Filters:
                </span>

                {/* Specific Batch Year Select */}
                <select
                  value={batchScope}
                  onChange={(e) => setBatchScope(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 outline-none focus:border-blue-600"
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

                {/* City Select */}
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="all">City: All Locations</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>
                      City: {c}
                    </option>
                  ))}
                </select>

                {/* Department Select */}
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="all">Department: All</option>
                  {availableDepts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {/* Reset Filters button */}
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
                    className="text-blue-600 hover:underline font-medium text-xs ml-auto cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Directory Alumni Cards List */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-600" />
                <p className="text-xs">Loading alumni directory...</p>
              </div>
            ) : alumni.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No alumni found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition cursor-pointer"
                >
                  Expand to All Batches & Institutions
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {alumni.map((person) => {
                  const isVerified = person.verificationStatus === "VERIFIED";
                  const isCurrentUser = currentUser?.id === person.id;
                  const rel = statusMap[person.id] || "NONE";
                  const isLoading = actionLoadingId === person.id;

                  return (
                    <Link
                      key={person.id}
                      href={`/profile/${person.id}`}
                      className="block bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          {/* Avatar Circle */}
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
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

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                                {person.name}
                              </h2>
                              {person.username && (
                                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                                  @{person.username}
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                  isVerified
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {isVerified && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                                {isVerified ? "Verified" : "Unverified"}
                              </span>
                              {person.isOpenToMentor && (
                                <span className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5 text-purple-600" /> Mentor
                                </span>
                              )}
                            </div>

                            {/* Institution + Batch + Department */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                              <span className="flex items-center gap-1 font-medium">
                                <Building className="w-3 h-3 text-blue-500 shrink-0" />
                                {person.institution?.name}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-slate-400" />
                                Class of {person.batchYear}
                                {person.department?.name && ` • ${person.department.name}`}
                              </span>
                              {person.city && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {person.city}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Connection Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!isCurrentUser && (
                            <>
                              {rel === "CONNECTED" ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/messages/${person.id}`;
                                  }}
                                  className="h-8 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center gap-1 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                  title="Send Encrypted Message"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Message</span>
                                </button>
                              ) : rel === "PENDING_INCOMING" ? (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={(e) => handleAccept(e, person.id)}
                                  className="h-8 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-[11px] font-bold transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                                  title="Accept Connection Request"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>Accept</span>
                                </button>
                              ) : rel === "PENDING_OUTGOING" ? (
                                <span
                                  className="h-8 px-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200/80 flex items-center gap-1 text-[11px] font-semibold"
                                  title="Request Pending"
                                >
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="hidden sm:inline">Requested</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={(e) => handleConnect(e, person.id)}
                                  className="h-8 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 flex items-center gap-1 text-[11px] font-bold transition shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                                  title="Connect with Alumni"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                                  )}
                                  <span>Connect</span>
                                </button>
                              )}
                            </>
                          )}
                          <div className="p-2 rounded-xl text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </Link>
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
