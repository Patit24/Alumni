"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { addLocalConnectedPeer } from "@/lib/e2ee/vault";

interface AlumniUser {
  id: string;
  name: string;
  username?: string | null;
  phone: string;
  avatarUrl?: string | null;
  verificationStatus: string;
  batchYear: number;
  currentCompany: string | null;
  currentRole: string | null;
  city: string | null;
  isOpenToMentor: boolean;
  institution: { id: string; name: string; city: string | null };
  department: { id: string; name: string } | null;
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [institutionScope, setInstitutionScope] = useState<"my" | "all">("my");
  const [batchScope, setBatchScope] = useState<string>("my"); // "my" | "all" | string year
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");

  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED">>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch true relationship status from server
  const fetchConnectionStatuses = () => {
    fetch("/api/contacts/requests")
      .then((r) => r.json())
      .then((data) => {
        const merged: Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {
          ...(data.statusMap || {}),
        };
        // Also mark all server-confirmed connected peers as CONNECTED
        if (Array.isArray(data.connectedPeerIds)) {
          for (const pid of data.connectedPeerIds) {
            if (pid) merged[pid] = "CONNECTED";
          }
        }
        setStatusMap(merged);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchConnectionStatuses();
    window.addEventListener("connection-requests-updated", fetchConnectionStatuses);
    return () => window.removeEventListener("connection-requests-updated", fetchConnectionStatuses);
  }, []);

  const handleConnect = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "REQUEST" }),
      });
      const data = await res.json();
      if (data.status === "ACCEPTED") {
        setStatusMap((prev) => ({ ...prev, [targetUserId]: "CONNECTED" }));
        addLocalConnectedPeer(targetUserId);
      } else if (data.status === "PENDING") {
        setStatusMap((prev) => ({ ...prev, [targetUserId]: "PENDING_OUTGOING" }));
      }
    } catch (err) {
      console.error("Connect request error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAccept = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoadingId(targetUserId);
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "ACCEPT" }),
      });
      if (res.ok) {
        setStatusMap((prev) => ({ ...prev, [targetUserId]: "CONNECTED" }));
        addLocalConnectedPeer(targetUserId);
      }
    } catch (err) {
      console.error("Accept error:", err);
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
              <h1 className="text-base font-bold text-slate-900 leading-tight">Alumni Directory</h1>
              <p className="text-[11px] text-slate-500">
                {institutionScope === "my" ? userInstName : "All Institutions"} •{" "}
                {batchScope === "my"
                  ? `Class of ${userBatchYear}`
                  : batchScope === "all"
                  ? "All Batches"
                  : `Class of ${batchScope}`}
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
            {alumni.length} {alumni.length === 1 ? "Member" : "Members"}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by @username, name, company, role, or city..."
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
                className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
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
                className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
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
                className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
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
                className={`flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
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
                className="text-blue-600 hover:underline font-medium text-xs ml-auto"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition"
            >
              Expand to All Batches & Institutions
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {alumni.map((person) => {
              const isVerified = person.verificationStatus === "VERIFIED";
              const isCurrentUser = currentUser?.id === person.id;

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
                            {person.institution.name}
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

                    <div className="flex items-center gap-2 shrink-0">
                      {!isCurrentUser && (
                        <>
                          {statusMap[person.id] === "CONNECTED" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.location.href = `/messages/${person.id}`;
                              }}
                              className="h-8 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center gap-1 text-[11px] font-bold transition shadow-2xs"
                              title="Send Encrypted Message"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Message</span>
                            </button>
                          ) : statusMap[person.id] === "PENDING_INCOMING" ? (
                            <button
                              type="button"
                              disabled={actionLoadingId === person.id}
                              onClick={(e) => handleAccept(e, person.id)}
                              className="h-8 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-[11px] font-bold transition shadow-xs active:scale-95 disabled:opacity-50"
                              title="Accept Connection Request"
                            >
                              {actionLoadingId === person.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Accept</span>
                            </button>
                          ) : statusMap[person.id] === "PENDING_OUTGOING" ? (
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
                              disabled={actionLoadingId === person.id}
                              onClick={(e) => handleConnect(e, person.id)}
                              className="h-8 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 flex items-center gap-1 text-[11px] font-bold transition shadow-2xs active:scale-95 disabled:opacity-50"
                              title="Connect for Encrypted Chat"
                            >
                              {actionLoadingId === person.id ? (
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
      </main>
    </div>
  );
}
