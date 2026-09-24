"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Users,
  UserPlus,
  CheckCircle2,
  Clock,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { addLocalConnectedPeer, setActiveVaultUser } from "@/lib/e2ee/vault";
import { triggerHaptic } from "@/lib/motion/tokens";

interface DiscoveredUser {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  course?: string | null;
  departmentName?: string | null;
  batchYear?: number | null;
  currentRole?: string | null;
  currentCompany?: string | null;
  city?: string | null;
  mutualCount: number;
  relationshipStatus: "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED";
}

interface InstitutionInfo {
  id: string;
  name: string;
  type?: string;
  city?: string | null;
}

interface InstitutionDiscoverySectionProps {
  institutionId?: string;
  initialInstitutionName?: string;
}

export default function InstitutionDiscoverySection({
  institutionId,
  initialInstitutionName,
}: InstitutionDiscoverySectionProps) {
  const router = useRouter();
  const [users, setUsers] = useState<DiscoveredUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [institution, setInstitution] = useState<InstitutionInfo | null>(
    initialInstitutionName ? { id: institutionId || "", name: initialInstitutionName } : null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDiscovery = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const url = institutionId
        ? `/api/institutions/discovery?institutionId=${encodeURIComponent(institutionId)}`
        : "/api/institutions/discovery";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.currentUserId) {
          setCurrentUserId(data.currentUserId);
          setActiveVaultUser(data.currentUserId);
        }
        if (data.institution) setInstitution(data.institution);
        if (Array.isArray(data.users)) setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to load institution discovery:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiscovery();

    const handleSync = () => fetchDiscovery();
    window.addEventListener("connection-requests-updated", handleSync);
    window.addEventListener("vault-messages-updated", handleSync);
    return () => {
      window.removeEventListener("connection-requests-updated", handleSync);
      window.removeEventListener("vault-messages-updated", handleSync);
    };
  }, [institutionId]);

  const handleConnect = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic("medium");
    setActionLoadingId(targetUserId);

    // Optimistic UI: Immediately mark as PENDING_OUTGOING ("Request Sent")
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, relationshipStatus: "PENDING_OUTGOING" } : u))
    );

    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "REQUEST" }),
      });
      const data = await res.json();
      if (data.status === "ACCEPTED" || data.status === "CONNECTED" || res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, relationshipStatus: "CONNECTED" } : u))
        );
        addLocalConnectedPeer(targetUserId, currentUserId || undefined);
        window.dispatchEvent(new CustomEvent("connection-requests-updated"));
        triggerHaptic("success");
      } else if (data.status === "PENDING") {
        triggerHaptic("light");
      }
    } catch (err) {
      console.error("Connect error:", err);
      // Revert on error
      fetchDiscovery();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAccept = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic("success");
    setActionLoadingId(targetUserId);

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, relationshipStatus: "CONNECTED" } : u))
    );

    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "ACCEPT" }),
      });
      if (res.ok) {
        addLocalConnectedPeer(targetUserId, currentUserId || undefined);
        window.dispatchEvent(new CustomEvent("connection-requests-updated"));
      }
    } catch (err) {
      console.error("Accept error:", err);
      fetchDiscovery();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic("light");
    setActionLoadingId(targetUserId);

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, relationshipStatus: "NONE" } : u))
    );

    try {
      await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, action: "REJECT" }),
      });
    } catch (err) {
      console.error("Reject error:", err);
      fetchDiscovery();
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                People from {institution?.name || "Your Institution"}
              </p>
              <p className="text-[11px] text-slate-400">Discover batchmates & peers</p>
            </div>
          </div>
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-50 animate-pulse border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return null; // Don't clutter the page if no other users from this institution yet
  }

  const institutionDisplayName = institution?.name || initialInstitutionName || "Your Institution";

  return (
    <section className="bg-[#111726]/80 rounded-3xl border border-white/10 p-5 sm:p-6 shadow-lg shadow-black/40 space-y-4 backdrop-blur-xl">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#FF9933] to-[#FF8008] text-white flex items-center justify-center shadow-md shadow-[#ff9933]/20 shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
              People from {institutionDisplayName}
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              Discover classmates and peers • Connect to chat
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchDiscovery(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Refresh discovery"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#FF9933]" : ""}`} />
          </button>
          <Link
            href="/directory"
            className="text-xs font-semibold text-[#FF9933] hover:text-orange-400 flex items-center gap-1 transition"
          >
            <span>See all ({users.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Discovered Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {users.map((person) => {
          const courseOrDept = person.course || person.departmentName || null;
          const academicTag = [courseOrDept, person.batchYear ? `Class of ${person.batchYear}` : null]
            .filter(Boolean)
            .join(" • ");

          return (
            <div
              key={person.id}
              className="bg-[#161f36]/70 hover:bg-[#1a2542] rounded-2xl border border-white/10 p-4 transition-all duration-200 hover:border-[#FF9933]/40 flex flex-col justify-between gap-3 group backdrop-blur-md"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <Link
                  href={`/profile/${person.id}`}
                  className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform overflow-hidden border border-white/10"
                >
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
                </Link>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/profile/${person.id}`}
                      className="text-xs font-bold text-white hover:text-[#FF9933] transition truncate"
                    >
                      {person.name}
                    </Link>
                    {person.username && (
                      <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
                        @{person.username}
                      </span>
                    )}
                  </div>

                  {academicTag && (
                    <p className="text-[11px] font-medium text-slate-300 truncate">
                      {academicTag}
                    </p>
                  )}

                  {/* Mutual Connections Badge */}
                  <div className="pt-0.5">
                    {person.mutualCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                        <Users className="w-2.5 h-2.5 text-emerald-400" />
                        <span>
                          {person.mutualCount} mutual connection{person.mutualCount > 1 ? "s" : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Same institution</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: View Profile + Relationship Aware Button */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/8">
                <Link
                  href={`/profile/${person.id}`}
                  className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition text-center active:scale-98"
                >
                  View Profile
                </Link>

                {person.relationshipStatus === "CONNECTED" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/messages/${person.id}`);
                    }}
                    className="btn-saffron px-3 py-1.5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-md shadow-[#ff9933]/20 active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                ) : person.relationshipStatus === "PENDING_OUTGOING" ? (
                  <span className="px-2.5 py-1.5 rounded-xl bg-white/5 text-slate-400 text-xs font-semibold flex items-center gap-1 shrink-0 border border-white/10">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Request Sent</span>
                  </span>
                ) : person.relationshipStatus === "PENDING_INCOMING" ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={actionLoadingId === person.id}
                      onClick={(e) => handleAccept(e, person.id)}
                      className="btn-india-green px-2.5 py-1.5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === person.id}
                      onClick={(e) => handleReject(e, person.id)}
                      className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoadingId === person.id}
                    onClick={(e) => handleConnect(e, person.id)}
                    className="btn-saffron px-3 py-1.5 rounded-xl text-white text-xs font-bold transition shadow-md shadow-[#ff9933]/20 flex items-center gap-1 active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {actionLoadingId === person.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span>Connect</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
