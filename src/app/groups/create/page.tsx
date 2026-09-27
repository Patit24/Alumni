"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Check,
  X,
  Camera,
  Users,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Lock,
  EyeOff,
  Sparkles,
  CameraOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getCachedConnectionProfiles } from "@/lib/e2ee/vault";
import { triggerHaptic } from "@/lib/motion/tokens";

interface ParticipantContact {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  batchYear?: number;
  currentRole?: string | null;
  currentCompany?: string | null;
  verificationStatus?: string;
}

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Contacts & Selection
  const [contacts, setContacts] = useState<ParticipantContact[]>(() => {
    try {
      return getCachedConnectionProfiles<ParticipantContact>();
    } catch {
      return [];
    }
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Group Details
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [scope, setScope] = useState<"SAME_BATCH" | "INSTITUTION">("SAME_BATCH");
  const [isSecretMode, setIsSecretMode] = useState(false);
  const [allowScreenshot, setAllowScreenshot] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load contacts cache-first with silent background refresh
  useEffect(() => {
    async function loadContacts() {
      try {
        const cached = getCachedConnectionProfiles<ParticipantContact>();
        if (cached.length > 0) setContacts(cached);

        const res = await fetch("/api/connections?type=connections");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.connections) && data.connections.length > 0) {
            setContacts((prev) => {
              const map = new Map<string, ParticipantContact>();
              prev.forEach((c) => map.set(c.id, c));
              data.connections.forEach((c: ParticipantContact) => {
                if (c && c.id) map.set(c.id, c);
              });
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.warn("Could not background refresh connections:", err);
      }
    }
    loadContacts();
  }, []);

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.username && c.username.toLowerCase().includes(q)) ||
        (c.currentRole && c.currentRole.toLowerCase().includes(q)) ||
        (c.currentCompany && c.currentCompany.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  // Selected participants list
  const selectedParticipants = useMemo(() => {
    const map = new Map(contacts.map((c) => [c.id, c]));
    return selectedIds
      .map((id) => map.get(id))
      .filter((c): c is ParticipantContact => Boolean(c));
  }, [contacts, selectedIds]);

  const toggleSelect = (contactId: string) => {
    triggerHaptic("light");
    setSelectedIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const removeSelected = (contactId: string) => {
    triggerHaptic("light");
    setSelectedIds((prev) => prev.filter((id) => id !== contactId));
  };

  // Image selection and compression
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_DIM) {
            h *= MAX_DIM / w;
            w = MAX_DIM;
          }
        } else {
          if (h > MAX_DIM) {
            w *= MAX_DIM / h;
            h = MAX_DIM;
          }
        }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setGroupAvatar(canvas.toDataURL("image/jpeg", 0.75));
        } else {
          setGroupAvatar(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Submit and create group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setErrorMessage("Please enter a group subject / name.");
      triggerHaptic("error");
      return;
    }

    try {
      setCreating(true);
      setErrorMessage(null);
      triggerHaptic("medium");

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          avatar: groupAvatar || undefined,
          scope,
          isSecretMode,
          allowScreenshot,
          memberIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create group");
      }

      triggerHaptic("success");
      // Direct navigation to newly created group room
      router.push(`/groups/${data.group.id}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating group");
      setCreating(false);
      triggerHaptic("error");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#080811] text-white flex flex-col font-sans">
      {/* ── WhatsApp-Style Header ── */}
      <header className="sticky top-0 z-40 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 px-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                triggerHaptic("light");
                if (step === 2) {
                  setStep(1);
                } else {
                  router.back();
                }
              }}
              className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition active:scale-90"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                New group
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                {step === 1
                  ? selectedIds.length > 0
                    ? `${selectedIds.length} of ${contacts.length} selected`
                    : "Add participants"
                  : "Add subject"}
              </p>
            </div>
          </div>

          {step === 1 && (
            <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              {selectedIds.length} selected
            </div>
          )}
        </div>
      </header>

      {/* ── STEP 1: ADD PARTICIPANTS ── */}
      {step === 1 && (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto pb-32">
          {/* Selected participants horizontal chips (WhatsApp style) */}
          <AnimatePresence>
            {selectedParticipants.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-white/5 bg-[#0e1424]/60 backdrop-blur-md"
              >
                <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto no-scrollbar">
                  {selectedParticipants.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="flex flex-col items-center shrink-0 relative group"
                    >
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-tr from-slate-700 to-slate-800 border border-white/20 flex items-center justify-center font-bold text-white text-sm shadow-md">
                          {p.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            p.name.charAt(0)
                          )}
                        </div>
                        <button
                          onClick={() => removeSelected(p.id)}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-slate-700 hover:bg-rose-600 text-white flex items-center justify-center border border-black shadow transition active:scale-90"
                          title="Remove participant"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium mt-1 truncate max-w-[56px] text-center">
                        {p.name.split(" ")[0]}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search bar */}
          <div className="p-4 border-b border-white/5 bg-[#080811]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search name, username, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 divide-y divide-white/5 px-2">
            {filteredContacts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-semibold">
                  {searchQuery ? "No matching contacts found." : "No connected alumni contacts yet."}
                </p>
                <p className="text-[11px] text-slate-500">
                  Connect with alumni or batchmates to add them to your group.
                </p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedIds.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleSelect(contact.id)}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-11 w-11 rounded-full overflow-hidden bg-gradient-to-tr from-slate-700 to-slate-800 border border-white/15 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm">
                        {contact.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                        ) : (
                          contact.name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">{contact.name}</p>
                          {contact.verificationStatus === "VERIFIED" && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {contact.currentRole || "Alumni"}
                          {contact.currentCompany ? ` at ${contact.currentCompany}` : ""}
                          {contact.batchYear ? ` • Class of ${contact.batchYear}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* WhatsApp-style circular checkmark */}
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30 scale-105"
                          : "border-2 border-slate-600 bg-transparent"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating Next Button (WhatsApp Green Circular FAB / Pill) */}
          <div className="fixed bottom-6 right-6 z-40">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                triggerHaptic("medium");
                setStep(2);
              }}
              className="h-14 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold flex items-center gap-2 shadow-2xl shadow-emerald-500/40 transition active:scale-95 text-sm"
            >
              <span>Next</span>
              {selectedIds.length > 0 && (
                <span className="h-5 px-1.5 rounded-full bg-black/20 text-black font-black text-xs flex items-center justify-center">
                  {selectedIds.length}
                </span>
              )}
              <ChevronRight className="w-5 h-5 stroke-[3]" />
            </motion.button>
          </div>
        </div>
      )}

      {/* ── STEP 2: GROUP SUBJECT & ICON ── */}
      {step === 2 && (
        <div className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-32">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
              <X className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Group Icon & Subject Input Card */}
          <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-5 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center gap-4">
              {/* Avatar Photo Picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative h-16 w-16 rounded-full bg-slate-800 hover:bg-slate-700 border-2 border-dashed border-white/20 hover:border-emerald-400 cursor-pointer flex items-center justify-center overflow-hidden transition group shrink-0"
                title="Add group icon"
              >
                {groupAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={groupAvatar} alt="Group avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
                accept="image/*"
                className="hidden"
              />

              {/* Group Name Input */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Type group subject here..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/20 focus:border-emerald-400 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none py-2 transition"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                  <span>Provide a group subject and optional icon</span>
                  <span>{groupName.length}/50</span>
                </div>
              </div>
            </div>

            {/* Group Description */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={200}
                placeholder="What is this group about?"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
              />
            </div>
          </div>

          {/* Privacy & Scope Card */}
          <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-5 backdrop-blur-xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Group Settings & Privacy
            </h3>

            {/* Scope */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope("SAME_BATCH")}
                className={`p-3 rounded-2xl border text-left transition ${
                  scope === "SAME_BATCH"
                    ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <p className="text-xs font-bold">Class of Batch</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Visible to your graduation batch</p>
              </button>

              <button
                type="button"
                onClick={() => setScope("INSTITUTION")}
                className={`p-3 rounded-2xl border text-left transition ${
                  scope === "INSTITUTION"
                    ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <p className="text-xs font-bold">Campus-Wide</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Open to all campus alumni</p>
              </button>
            </div>

            {/* Secret Mode toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <EyeOff className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Secret Mode (Auto-Vanish)</p>
                  <p className="text-[10px] text-slate-400">Messages automatically vanish after 48h</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isSecretMode}
                onChange={(e) => setIsSecretMode(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Anti-screenshot toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <CameraOff className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Block Screenshots</p>
                  <p className="text-[10px] text-slate-400">Prevent saving or screen recording</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={!allowScreenshot}
                onChange={(e) => setAllowScreenshot(!e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Selected Participants Overview */}
          <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-5 backdrop-blur-xl shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Participants: {selectedParticipants.length}
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Edit
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {selectedParticipants.length === 0 ? (
                <p className="text-xs text-slate-400">No participants added yet (you will be sole admin).</p>
              ) : (
                selectedParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white"
                  >
                    <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-700 text-[10px] font-bold flex items-center justify-center">
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        p.name.charAt(0)
                      )}
                    </div>
                    <span>{p.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Floating Create Group Button (WhatsApp Green Circular FAB) */}
          <div className="fixed bottom-6 right-6 z-40">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim()}
              className="h-14 px-7 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold flex items-center gap-2 shadow-2xl shadow-emerald-500/40 transition active:scale-95 text-sm"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating group...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Create Group</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
