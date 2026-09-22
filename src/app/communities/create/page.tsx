"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Sparkles, 
  Lock, 
  Globe, 
  ShieldAlert, 
  Check, 
  CheckCircle2,
  Trophy, 
  Briefcase, 
  GraduationCap, 
  Gamepad2, 
  Compass, 
  HeartHandshake, 
  CalendarDays, 
  Users2, 
  Fingerprint, 
  Layers,
  ChevronRight
} from "lucide-react";
import Link from "next/link";

interface TemplateOption {
  type: string;
  title: string;
  description: string;
  icon: any;
  gradient: string;
  channels: string[];
  modules: string[];
}

const TEMPLATES: TemplateOption[] = [
  {
    type: "SPORTS",
    title: "Sports Team & Club",
    description: "Match announcements, schedule, tactical boards, roster, and match replay clips.",
    icon: Trophy,
    gradient: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
    channels: ["announcements", "general", "tactics-strategy", "match-day", "media-highlights"],
    modules: ["Channels", "Events & Matches", "Announcements", "Media", "Live Voice/Video"],
  },
  {
    type: "ORGANIZATION",
    title: "Company, Startup & Dept",
    description: "Corporate workspace, department channels, town halls, confidential file vaults.",
    icon: Briefcase,
    gradient: "from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400",
    channels: ["townhall", "general", "engineering", "product-design", "watercooler"],
    modules: ["Channels", "Announcements", "Calendar", "File Vault", "Polls", "Encrypted Calling"],
  },
  {
    type: "EDUCATION",
    title: "University & Academy",
    description: "Classroom updates, study groups, research labs, syllabus, and assignment deadlines.",
    icon: GraduationCap,
    gradient: "from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-400",
    channels: ["faculty-notices", "general-discussion", "study-groups", "project-collab"],
    modules: ["Channels", "Announcements", "Events/Classes", "Documents", "Polls"],
  },
  {
    type: "GAMING",
    title: "Gaming & Esports Squad",
    description: "Scrims coordination, highlight clips, tournament calendars, and low-latency voice.",
    icon: Gamepad2,
    gradient: "from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-400",
    channels: ["announcements", "lobby-chat", "scrims-scheduling", "clips-montages"],
    modules: ["Channels", "Events & Tournaments", "Voice/Video Calls", "Media Gallery"],
  },
  {
    type: "CLUB",
    title: "Cultural Club & Society",
    description: "Meetups, discussions, project showcase, event RSVPs, and voting.",
    icon: Compass,
    gradient: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
    channels: ["announcements", "general", "ideas-projects", "event-planning"],
    modules: ["Channels", "Events", "Announcements", "Polls", "Media"],
  },
  {
    type: "NGO",
    title: "NGO & Volunteer Group",
    description: "Campaign coordination, donation drives, field work reports, and alerts.",
    icon: HeartHandshake,
    gradient: "from-teal-500/20 to-cyan-500/10 border-teal-500/30 text-teal-400",
    channels: ["action-alerts", "general-coordination", "volunteer-hub", "field-reports"],
    modules: ["Channels", "Announcements", "Events", "Documents"],
  },
  {
    type: "EVENT",
    title: "Summit, Festival or Hackathon",
    description: "Temporary event schedule, speaker sessions, Q&A, and real-time updates.",
    icon: CalendarDays,
    gradient: "from-indigo-500/20 to-sky-500/10 border-indigo-500/30 text-indigo-400",
    channels: ["stage-announcements", "attendee-chat", "help-desk", "networking"],
    modules: ["Channels", "Events & Agenda", "Announcements", "Polls"],
  },
  {
    type: "FRIENDS",
    title: "Close Friends & Family",
    description: "Private encrypted group, photo memories, hangout calls, and weekend plans.",
    icon: Users2,
    gradient: "from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-400",
    channels: ["hangout", "plans", "photos-videos"],
    modules: ["Channels", "Media Sharing", "Live Calls", "Polls"],
  },
  {
    type: "PRIVATE",
    title: "Private Syndicate & VIP",
    description: "Stealth privacy, invite-only tokens, strict encryption, no public discovery.",
    icon: Fingerprint,
    gradient: "from-zinc-500/20 to-zinc-700/10 border-zinc-500/30 text-zinc-300",
    channels: ["secure-bulletin", "operations", "vault"],
    modules: ["Channels", "E2EE Calls", "Secure Files"],
  },
  {
    type: "CUSTOM",
    title: "Custom Community Engine",
    description: "Start from a blank canvas. Full freedom to pick your channels and modules.",
    icon: Layers,
    gradient: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400",
    channels: ["general"],
    modules: ["Channels", "Announcements", "Events", "Polls", "Files", "Calls"],
  },
];

export default function CreateCommunityPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("ORGANIZATION");

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinMode, setJoinMode] = useState<"OPEN" | "APPROVAL" | "INVITE_ONLY">("OPEN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTemplate = TEMPLATES.find((t) => t.type === selectedTemplate) || TEMPLATES[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please give your community a name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type: selectedTemplate,
          isPrivate,
          joinMode: isPrivate ? "INVITE_ONLY" : joinMode,
          requiresApproval: joinMode === "APPROVAL",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create community");
      }

      router.push(`/communities/${data.community.id}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/communities"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </Link>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className={step === 1 ? "text-cyan-400" : "text-zinc-400"}>1. Template</span>
            <span className="text-zinc-600">/</span>
            <span className={step === 2 ? "text-cyan-400" : "text-zinc-400"}>2. Details</span>
          </div>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-4xl w-full px-4 pt-8">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col"
            >
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Universal Community Engine
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Choose a template for your group
                </h1>
                <p className="mt-2 text-sm text-zinc-400 max-w-lg mx-auto">
                  Every community is completely customizable. Templates instantly configure sensible channels, roles, and modules.
                </p>
              </div>

              {/* Template Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isSelected = selectedTemplate === tmpl.type;

                  return (
                    <div
                      key={tmpl.type}
                      onClick={() => setSelectedTemplate(tmpl.type)}
                      className={`relative cursor-pointer rounded-2xl border p-5 transition-all text-left flex flex-col justify-between ${
                        isSelected
                          ? `bg-zinc-900/90 border-cyan-500/60 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-500/10`
                          : `bg-zinc-900/40 border-white/10 hover:border-white/20 hover:bg-zinc-900/60`
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-xl border ${tmpl.gradient}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <h3 className="font-semibold text-base text-zinc-100">{tmpl.title}</h3>
                        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{tmpl.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                        {tmpl.modules.slice(0, 3).map((mod) => (
                          <span
                            key={mod}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 font-mono"
                          >
                            {mod}
                          </span>
                        ))}
                        {tmpl.modules.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-500 font-mono">
                            +{tmpl.modules.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Next Button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
                >
                  <span>Continue with {activeTemplate.title}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-xl mx-auto"
            >
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to templates</span>
                </button>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Customize your community details
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Using template: <span className="text-cyan-400 font-medium">{activeTemplate.title}</span>
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-6">
                {/* Community Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Community Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Manchester United Fan Club, Apollo Engineering Team..."
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Description & Purpose (Optional)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={280}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell members what this community is for..."
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                  />
                </div>

                {/* Privacy Setting */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Privacy & Discovery
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPrivate(false)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        !isPrivate
                          ? "bg-zinc-900 border-emerald-500/60 ring-1 ring-emerald-500/40"
                          : "bg-zinc-900/40 border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-xs text-white">Public</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Visible in hub. Anyone can discover and see the preview.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPrivate(true)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isPrivate
                          ? "bg-zinc-900 border-amber-500/60 ring-1 ring-amber-500/40"
                          : "bg-zinc-900/40 border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-xs text-white">Private</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Hidden from search. Accessible strictly via invite link or QR.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Join Policy (if public) */}
                {!isPrivate && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Access Policy
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setJoinMode("OPEN")}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          joinMode === "OPEN"
                            ? "bg-zinc-900 border-cyan-500/60 ring-1 ring-cyan-500/40"
                            : "bg-zinc-900/40 border-white/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <span className="font-medium text-xs text-white block mb-0.5">Open Join</span>
                        <span className="text-[11px] text-zinc-400">Anyone can join instantly</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJoinMode("APPROVAL")}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          joinMode === "APPROVAL"
                            ? "bg-zinc-900 border-cyan-500/60 ring-1 ring-cyan-500/40"
                            : "bg-zinc-900/40 border-white/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <span className="font-medium text-xs text-white block mb-0.5">Approval Required</span>
                        <span className="text-[11px] text-zinc-400">Admins review every join request</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Template Auto-Config Overview */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                  <span className="font-semibold text-zinc-300 block mb-2">
                    Default Initialized Channels:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.channels.map((ch) => (
                      <span
                        key={ch}
                        className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-zinc-300 font-mono text-[11px]"
                      >
                        #{ch}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Initializing Engine & Keys...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Launch Community</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
