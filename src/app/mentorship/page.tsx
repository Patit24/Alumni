"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  Building,
  RefreshCw,
} from "lucide-react";

interface Mentor {
  id: string;
  name: string;
  avatarUrl?: string | null;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
  city: string | null;
  linkedinUrl: string | null;
  verificationStatus: string;
  isOpenToMentor: boolean;
  mentorTopics: string | null;
  institution: { name: string };
  department: { name: string } | null;
}

interface RequestItem {
  id: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
  mentor?: {
    name: string;
    avatarUrl?: string | null;
    currentRole: string | null;
    currentCompany: string | null;
    institution: { name: string };
  };
  sender?: {
    name: string;
    avatarUrl?: string | null;
    batchYear: number;
    currentRole: string | null;
    currentCompany: string | null;
    institution: { name: string };
  };
}

interface MentorshipData {
  currentUser: {
    id: string;
    name: string;
    verificationStatus: string;
    isOpenToMentor: boolean;
    mentorTopics: string | null;
    mentorScope: string;
  };
  mentors: Mentor[];
  sentRequests: RequestItem[];
  receivedRequests: RequestItem[];
}

const TOPICS = [
  "ALL",
  "System Design",
  "Resume Review",
  "Mock Interviews",
  "Campus Placements",
  "Portfolio Review",
  "UI/UX Design",
  "Frontend Architecture",
  "Career Switch",
  "Microsoft Referrals",
];

export default function MentorshipPage() {
  const [data, setData] = useState<MentorshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"browse" | "my-requests" | "settings">("browse");

  // Filters
  const [selectedTopic, setSelectedTopic] = useState("ALL");
  const [scope, setScope] = useState<"institution" | "all">("institution");

  // Request Modal state
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [requestTopic, setRequestTopic] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Settings state
  const [isOpenToMentor, setIsOpenToMentor] = useState(false);
  const [mentorTopicsInput, setMentorTopicsInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchMentorship = useCallback(async () => {
    try {
      const res = await fetch(`/api/mentorship?topic=${encodeURIComponent(selectedTopic)}&scope=${scope}`);
      if (!res.ok) throw new Error("Failed to load mentorship");
      const json = await res.json();
      setData(json);
      setIsOpenToMentor(json.currentUser.isOpenToMentor);
      setMentorTopicsInput(json.currentUser.mentorTopics || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, scope]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/mentorship?topic=${encodeURIComponent(selectedTopic)}&scope=${scope}`);
        if (!res.ok) throw new Error("Failed to load mentorship");
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setIsOpenToMentor(json.currentUser.isOpenToMentor);
          setMentorTopicsInput(json.currentUser.mentorTopics || "");
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
  }, [selectedTopic, scope]);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMentor) return;

    try {
      setSubmittingRequest(true);
      setStatusMessage(null);
      const res = await fetch("/api/mentorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_REQUEST",
          mentorId: selectedMentor.id,
          topic: requestTopic,
          message: requestMessage,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send request");

      setStatusMessage("Mentorship request sent successfully!");
      setSelectedMentor(null);
      setRequestMessage("");
      await fetchMentorship();
      setActiveTab("my-requests");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error sending request");
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setStatusMessage(null);
      const res = await fetch("/api/mentorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_MENTOR_PROFILE",
          isOpenToMentor,
          mentorTopics: mentorTopicsInput,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update settings");

      setStatusMessage("Mentorship profile updated successfully!");
      await fetchMentorship();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating settings");
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading mentors...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isVerified = data.currentUser.verificationStatus === "VERIFIED";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
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
              <h1 className="text-sm font-bold text-slate-900">Mentorship Network</h1>
              <p className="text-[11px] text-slate-500">Connect with alumni for 1-on-1 guidance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab("browse")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
              activeTab === "browse"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Find Mentors ({data.mentors.length})
          </button>
          <button
            onClick={() => setActiveTab("my-requests")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
              activeTab === "my-requests"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            My Requests ({data.sentRequests.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
              activeTab === "settings"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Mentor Settings
          </button>
        </div>

        {statusMessage && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab 1: Browse Mentors */}
        {activeTab === "browse" && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Scope Toggle */}
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setScope("institution")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      scope === "institution"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    My College
                  </button>
                  <button
                    onClick={() => setScope("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      scope === "all"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    All Colleges
                  </button>
                </div>

                {/* Topic Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Topic:
                  </span>
                  <div className="flex gap-1.5">
                    {TOPICS.slice(0, 5).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTopic(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                          selectedTopic === t
                            ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mentors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.mentors.map((mentor) => (
                <div
                  key={mentor.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:border-indigo-300 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-500/10 overflow-hidden shrink-0">
                          {mentor.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mentor.avatarUrl}
                              alt={mentor.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            mentor.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900">{mentor.name}</h3>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <p className="text-xs text-slate-600 font-medium">
                            {mentor.currentRole || "Alumni"}
                            {mentor.currentCompany ? ` at ${mentor.currentCompany}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1">
                      <Building className="w-3 h-3" /> {mentor.institution.name} • Class of {mentor.batchYear}
                    </p>

                    {mentor.mentorTopics && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {mentor.mentorTopics.split(",").map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md"
                          >
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/profile/${mentor.id}`}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      View Profile
                    </Link>

                    <button
                      onClick={() => {
                        if (!isVerified) {
                          alert("Please verify your account first to request mentorship.");
                          return;
                        }
                        setSelectedMentor(mentor);
                        setRequestTopic(mentor.mentorTopics ? mentor.mentorTopics.split(",")[0].trim() : "Career Guidance");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm shadow-indigo-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Request Guidance
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: My Requests */}
        {activeTab === "my-requests" && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sent Mentorship Requests ({data.sentRequests.length})
            </h3>

            {data.sentRequests.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">You haven&apos;t sent any mentorship requests yet.</p>
                <button
                  onClick={() => setActiveTab("browse")}
                  className="mt-3 text-xs font-bold text-indigo-600 hover:underline"
                >
                  Browse available alumni mentors →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {data.sentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {req.topic}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          Mentor: {req.mentor?.name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {req.mentor?.currentRole} at {req.mentor?.currentCompany}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          req.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : req.status === "ACCEPTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3 italic">
                      &ldquo;{req.message}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Mentor Settings */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm max-w-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Mentor Settings</h3>
            <p className="text-xs text-slate-500 mb-5">
              Help juniors and peers from your university navigate interviews, career transitions, and industry practices.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={isOpenToMentor}
                  onChange={(e) => setIsOpenToMentor(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">Open to giving mentorship</p>
                  <p className="text-[11px] text-slate-500">Show up in the mentorship directory for students & alumni</p>
                </div>
              </label>

              {isOpenToMentor && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Topics You Can Help With (comma separated)
                  </label>
                  <input
                    type="text"
                    value={mentorTopicsInput}
                    onChange={(e) => setMentorTopicsInput(e.target.value)}
                    placeholder="e.g. Resume Review, Fullstack Web, Mock Interviews"
                    className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Send Request Modal */}
      {selectedMentor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Request Mentorship from {selectedMentor.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedMentor.currentRole} at {selectedMentor.currentCompany}</p>
              </div>
              <button
                onClick={() => setSelectedMentor(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Topic of Guidance
                </label>
                <input
                  type="text"
                  value={requestTopic}
                  onChange={(e) => setRequestTopic(e.target.value)}
                  required
                  placeholder="e.g. System Design, Resume Review"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Note / Specific Questions
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  required
                  rows={3}
                  placeholder="Hi! I'm preparing for frontend interviews and would love feedback on my architecture..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMentor(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                >
                  {submittingRequest ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
