"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  PlusCircle,
  Sparkles,
  PartyPopper,
  CheckCircle2,
  RefreshCw,
  Building,
  GraduationCap,
  Share2,
} from "lucide-react";

interface Attendee {
  id: string;
  name: string;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
}

interface ReunionItem {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  batchScope: string;
  creator: {
    name: string;
    batchYear: number;
    currentRole: string | null;
    currentCompany: string | null;
    verificationStatus: string;
  };
  attendeeCount: number;
  attendees: Attendee[];
  isRsvpd: boolean;
  isCreator: boolean;
}

interface ReunionsData {
  currentUser: {
    id: string;
    name: string;
    batchYear: number;
    institutionName: string;
    verificationStatus: string;
  };
  reunions: ReunionItem[];
}

export default function ReunionsPage() {
  const [data, setData] = useState<ReunionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "BATCH">("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Plan Reunion Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [batchScope, setBatchScope] = useState("SAME_BATCH");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchReunions = useCallback(async (scope: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reunions?scope=${scope}`);
      if (!res.ok) throw new Error("Failed to load reunions");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/reunions?scope=${scopeFilter}`);
        if (!res.ok) throw new Error("Failed to load reunions");
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [scopeFilter]);

  async function handleToggleRsvp(eventId: string) {
    try {
      setTogglingId(eventId);
      setStatusMessage(null);
      const res = await fetch("/api/reunions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_RSVP", eventId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "RSVP failed");

      if (result.rsvpd) {
        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore confetti fallback
        }
      }

      setStatusMessage(result.message);
      await fetchReunions(scopeFilter);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating RSVP");
    } finally {
      setTogglingId(null);
    }
  }

  async function handlePlanReunion(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !location.trim()) return;

    try {
      setSubmitting(true);
      setStatusMessage(null);
      const res = await fetch("/api/reunions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          date,
          location,
          batchScope: batchScope === "SAME_BATCH" ? String(data?.currentUser.batchYear) : "ALL",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to plan reunion");

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {
        // ignore
      }

      setStatusMessage("Reunion planned successfully! Broadcasted to batchmates.");
      setShowModal(false);
      setTitle("");
      setDescription("");
      setDate("");
      setLocation("");
      await fetchReunions(scopeFilter);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error planning reunion");
    } finally {
      setSubmitting(false);
    }
  }

  function formatEventDate(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getDaysToGo(dateString: string) {
    const eventDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(eventDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (days < 0) return "Happened";
    if (days === 0) return "Today!";
    if (days === 1) return "Tomorrow!";
    return `In ${days} days`;
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Gathering batch reunions...</p>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Batch Reunions & Get-Togethers</span>
                <PartyPopper className="w-4 h-4 text-amber-500" />
              </h1>
              <p className="text-[11px] text-slate-500">
                {data.currentUser.institutionName} • Class of {data.currentUser.batchYear}
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white text-xs font-bold rounded-2xl transition shadow-md shadow-orange-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Plan Reunion</span>
          </motion.button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Interactive Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-orange-500/15"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-amber-100 bg-white/15 backdrop-blur px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3 text-amber-200" /> Plan & Meet Offline
              </span>
              <h2 className="text-xl sm:text-2xl font-black leading-tight">
                Reconnect, Reminisce & Plan Get-Togethers
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 leading-relaxed">
                Coordinate dates, decide rooftop restaurants or campus meetups, and see which batchmates are coming. One-tap RSVP and automatic calendar reminders!
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center shrink-0 w-full sm:w-auto">
              <div className="text-3xl font-black">{data.reunions.length}</div>
              <div className="text-[10px] font-bold text-amber-100 uppercase tracking-wider mt-0.5">
                Upcoming Reunions
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setScopeFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                scopeFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Gatherings
            </button>
            <button
              onClick={() => setScopeFilter("BATCH")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                scopeFilter === "BATCH"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Class of {data.currentUser.batchYear} Only
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            {data.reunions.length} events scheduled
          </span>
        </div>

        {/* Reunions Stream */}
        <div className="space-y-4">
          {data.reunions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3"
            >
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Upcoming Reunions Scheduled</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Be the first to propose a batch dinner, weekend coffee, or campus visit!
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 text-xs font-bold text-amber-600 hover:underline"
              >
                + Plan a Reunion with Buddies →
              </button>
            </motion.div>
          ) : (
            data.reunions.map((item, idx) => {
              const isBatchScoped = item.batchScope !== "ALL";

              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.06 }}
                  whileHover={{ y: -2 }}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:border-amber-300 hover:shadow-md transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {getDaysToGo(item.date)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isBatchScoped
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}
                        >
                          {isBatchScoped ? `Class of ${item.batchScope}` : "All Alumni"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium mt-2">
                        <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          {formatEventDate(item.date)}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          {item.location}
                        </span>
                      </div>
                    </div>

                    {/* Action RSVP Button */}
                    <div className="shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleToggleRsvp(item.id)}
                        disabled={togglingId === item.id}
                        className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-2xl transition shadow-sm flex items-center justify-center gap-1.5 ${
                          item.isRsvpd
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}
                      >
                        {togglingId === item.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : item.isRsvpd ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Going ✓
                          </>
                        ) : (
                          <>
                            <PartyPopper className="w-3.5 h-3.5" />
                            RSVP / I&apos;m Going
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                    {item.description}
                  </p>

                  {/* Attendees Gallery & Attribution */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-700">
                        {item.attendeeCount} buddies attending:
                      </span>
                      <span className="text-slate-600 truncate max-w-xs">
                        {item.attendees.map((a) => a.name).slice(0, 3).join(", ")}
                        {item.attendees.length > 3 ? ` +${item.attendees.length - 3} more` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span>Organized by: <strong className="text-slate-800">{item.creator.name}</strong></span>
                      <button
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(window.location.href);
                            alert("Reunion link copied! Send it to your WhatsApp batch group!");
                          }
                        }}
                        className="text-slate-400 hover:text-slate-600"
                        title="Share invite link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </div>
      </main>

      {/* Plan Reunion Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PartyPopper className="w-5 h-5 text-amber-500" /> Plan a Reunion with Buddies
                  </h3>
                  <p className="text-xs text-slate-500">Pick a date, place, and invite batchmates</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handlePlanReunion} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reunion Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Class of 2026 Rooftop Dinner & Catchup 🥂"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Who Is Invited?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBatchScope("SAME_BATCH")}
                      className={`p-3 text-left rounded-2xl border transition ${
                        batchScope === "SAME_BATCH"
                          ? "border-amber-500 bg-amber-50 text-amber-900"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" /> Class of {data.currentUser.batchYear}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Strictly your graduating batch</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchScope("ALL")}
                      className={`p-3 text-left rounded-2xl border transition ${
                        batchScope === "ALL"
                          ? "border-amber-500 bg-amber-50 text-amber-900"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" /> All Batches & Alumni
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Open university gathering</p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Venue / Place
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                      placeholder="e.g. Park Street Cafe / Barasat Campus"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Details & Plan
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={3}
                    placeholder="Mention food plans, meeting spot, or what activities you have in mind..."
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-amber-500"
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
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-xl shadow-md disabled:opacity-50"
                  >
                    {submitting ? "Planning..." : "Broadcast Reunion 🎉"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
