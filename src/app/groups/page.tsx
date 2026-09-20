"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Music,
  PlusCircle,
  MessageCircle,
  Sparkles,
  Building,
  GraduationCap,
  RefreshCw,
  Search,
  CheckCircle2,
} from "lucide-react";

interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  batchYear: number | null;
  memberCount: number;
  messageCount: number;
  isMember: boolean;
  role: string | null;
  createdByName: string;
  createdAt: string;
}

interface GroupsData {
  currentUser: {
    id: string;
    name: string;
    batchYear: number;
    institutionName: string;
  };
  groups: GroupItem[];
}

export default function GroupsPage() {
  const [data, setData] = useState<GroupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "SAME_BATCH" | "INSTITUTION">("ALL");
  const [search, setSearch] = useState("");

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupScope, setNewGroupScope] = useState<"SAME_BATCH" | "INSTITUTION">("SAME_BATCH");
  const [creating, setCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchGroups = useCallback(async (scope: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/groups?scope=${scope}`);
      if (res.status === 401) {
        window.location.href = "/auth";
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Unable to load groups at this moment.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups(scopeFilter);
  }, [scopeFilter, fetchGroups]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setCreating(true);
      setStatusMessage(null);
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc,
          scope: newGroupScope,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create group");

      setStatusMessage("Group created successfully! You are now the Admin.");
      setShowModal(false);
      setNewGroupName("");
      setNewGroupDesc("");
      await fetchGroups(scopeFilter);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating group");
    } finally {
      setCreating(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-pink-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading groups & music rooms...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm max-w-sm w-full text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto font-bold">
            !
          </div>
          <h3 className="text-sm font-bold text-slate-800">Connection Issue</h3>
          <p className="text-xs text-slate-500">
            {errorMessage || "Unable to reach the groups server. Please check your session."}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => fetchGroups(scopeFilter)}
              className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              Retry
            </button>
            <Link
              href="/"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Return to Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredGroups = data.groups.filter((g) =>
    search ? g.name.toLowerCase().includes(search.toLowerCase()) || g.description?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Batch & University Groups</h1>
              <p className="text-[11px] text-slate-500">
                {data.currentUser.institutionName} • Class of {data.currentUser.batchYear}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Create Group
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {statusMessage && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Feature Hero Card */}
        <div className="bg-gradient-to-br from-pink-600 via-rose-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg shadow-pink-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-pink-200 bg-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 w-fit">
                <Music className="w-3 h-3" /> Live Group Chat & Mobile Music Player
              </span>
              <h2 className="text-xl sm:text-2xl font-bold mt-2">
                Hangout With Batchmates & Jam to Music
              </h2>
              <p className="text-xs text-pink-100 mt-1 max-w-lg leading-relaxed">
                Create dedicated groups with people from your batch or the whole university. Chat, share campus updates, or play songs directly from your phone while studying together!
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur rounded-2xl p-4 border border-white/20 text-center shrink-0 w-full sm:w-auto">
              <div className="text-2xl font-black">{data.groups.length}</div>
              <div className="text-[10px] font-semibold text-pink-100 uppercase tracking-wider">
                Active Rooms
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search groups or music clubs..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 w-full sm:w-auto justify-center">
              <button
                onClick={() => setScopeFilter("ALL")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  scopeFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Groups
              </button>
              <button
                onClick={() => setScopeFilter("SAME_BATCH")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  scopeFilter === "SAME_BATCH"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Class of {data.currentUser.batchYear} Only
              </button>
              <button
                onClick={() => setScopeFilter("INSTITUTION")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  scopeFilter === "INSTITUTION"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                University Wide
              </button>
            </div>
          </div>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredGroups.length === 0 ? (
            <div className="col-span-2 bg-white rounded-3xl border border-slate-200 p-8 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No groups found. Be the first to start a group!</p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const isBatch = group.scope === "SAME_BATCH";

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:border-pink-300 transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-sm ${
                            isBatch
                              ? "bg-gradient-to-tr from-pink-500 to-rose-600"
                              : "bg-gradient-to-tr from-indigo-500 to-purple-600"
                          }`}
                        >
                          {isBatch ? <GraduationCap className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 hover:text-pink-600 transition">
                            {group.name}
                          </h3>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                              isBatch
                                ? "bg-pink-50 text-pink-700 border border-pink-200"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            }`}
                          >
                            {isBatch ? `Class of ${group.batchYear} Batch` : "University Club"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {group.description || "Campus group room for discussions and music."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {group.memberCount} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Music className="w-3.5 h-3.5 text-pink-500" /> Music Room
                      </span>
                    </div>

                    <Link
                      href={`/groups/${group.id}`}
                      className="inline-flex items-center gap-1 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Enter Room
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create a New Group</h3>
                <p className="text-xs text-slate-500">For chatting and playing music together</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewGroupScope("SAME_BATCH")}
                    className={`p-3 text-left rounded-2xl border transition ${
                      newGroupScope === "SAME_BATCH"
                        ? "border-pink-500 bg-pink-50 text-pink-900"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" /> Same Batch
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Class of {data.currentUser.batchYear} batchmates</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewGroupScope("INSTITUTION")}
                    className={`p-3 text-left rounded-2xl border transition ${
                      newGroupScope === "INSTITUTION"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> University Wide
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Open to all students & alumni</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  placeholder="e.g. MCA 2026 Chill Lounge 🎵"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  rows={2}
                  placeholder="What is this group about? (e.g. music listening sessions, project discussions)"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white rounded-xl shadow-sm"
                >
                  {creating ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
