"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  UserMinus, 
  Save, 
  Lock, 
  Globe, 
  Key,
  Users,
  Layers,
  Sparkles
} from "lucide-react";

export default function CommunitySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params?.id as string;

  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinMode, setJoinMode] = useState<"OPEN" | "APPROVAL" | "INVITE_ONLY">("OPEN");

  useEffect(() => {
    if (communityId) {
      loadData();
    }
  }, [communityId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [commRes, memRes, rolRes] = await Promise.all([
        fetch(`/api/communities/${communityId}`),
        fetch(`/api/communities/${communityId}/members`),
        fetch(`/api/communities/${communityId}/roles`),
      ]);

      const commData = await commRes.json();
      if (!commRes.ok) throw new Error(commData.error || "Failed to load community");

      setCommunity(commData.community);
      setName(commData.community.name);
      setDescription(commData.community.description || "");
      setIsPrivate(commData.community.isPrivate);
      setJoinMode(commData.community.joinMode);

      if (memRes.ok) {
        const memData = await memRes.json();
        setMembers(memData.members || []);
      }

      if (rolRes.ok) {
        const rolData = await rolRes.json();
        setRoles(rolData.roles || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPrivate,
          joinMode: isPrivate ? "INVITE_ONLY" : joinMode,
          requiresApproval: joinMode === "APPROVAL",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      alert("Settings saved successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMemberRoleChange = async (memberId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, roleId }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to kick this member?")) return;
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, ban: false }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCommunity = async () => {
    const confirmation = prompt("Type DELETE to confirm permanent deletion of this community:");
    if (confirmation !== "DELETE") return;

    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      router.push("/communities");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md px-4 flex items-center justify-between">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          <Link
            href={`/communities/${communityId}`}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Community</span>
          </Link>
          <span className="font-bold text-sm text-white">Community Settings</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 pt-8 space-y-10">
        {/* Section 1: General Settings */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>General Information</span>
          </h2>

          <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/60 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Community Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Privacy Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    !isPrivate
                      ? "bg-zinc-800 border-cyan-500 text-white font-medium"
                      : "bg-zinc-800/40 border-white/10 text-zinc-400"
                  }`}
                >
                  <Globe className="w-4 h-4 text-emerald-400 mb-1" />
                  <span>Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    isPrivate
                      ? "bg-zinc-800 border-amber-500 text-white font-medium"
                      : "bg-zinc-800/40 border-white/10 text-zinc-400"
                  }`}
                >
                  <Lock className="w-4 h-4 text-amber-400 mb-1" />
                  <span>Private</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Members & Role Management */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Manage Members ({members.length})</span>
          </h2>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 divide-y divide-white/5 overflow-hidden">
            {members.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-xs text-white overflow-hidden">
                    {m.user?.image ? (
                      <img src={m.user.image} alt={m.user.name || ""} className="h-full w-full object-cover" />
                    ) : (
                      <span>{m.user?.name?.slice(0, 2).toUpperCase() || "U"}</span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-white block">
                      {m.user?.name || "User"}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      @{m.user?.username || "user"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={m.roleId || ""}
                    onChange={(e) => handleMemberRoleChange(m.id, e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleKickMember(m.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Remove Member"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Danger Zone */}
        <section className="space-y-4 pt-4 border-t border-white/10">
          <h2 className="text-base font-bold text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Danger Zone</span>
          </h2>

          <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-xs text-white">Delete this Community</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Permanently delete all encrypted messages, channels, events, and member records. This cannot be undone.
              </p>
            </div>

            <button
              onClick={handleDeleteCommunity}
              className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-black text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Community</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
