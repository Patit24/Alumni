"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Search,
  MapPin,
  PlusCircle,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  roleType: string;
  description: string;
  applyUrl: string | null;
  createdAt: string;
  poster: {
    id: string;
    name: string;
    currentRole: string | null;
    currentCompany: string | null;
    batchYear: number;
    verificationStatus: string;
    linkedinUrl: string | null;
  };
  institution: {
    id: string;
    name: string;
  };
}

interface JobsData {
  currentUser: {
    id: string;
    name: string;
    verificationStatus: string;
  };
  jobs: Job[];
}

export default function JobsPage() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleType, setRoleType] = useState("ALL");
  const [scope, setScope] = useState<"institution" | "all">("institution");

  // Post modal state
  const [showPostModal, setShowPostModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form fields
  const [newTitle, setNewTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newRoleType, setNewRoleType] = useState("FULL_TIME");
  const [newDescription, setNewDescription] = useState("");
  const [newApplyUrl, setNewApplyUrl] = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/jobs?roleType=${roleType}&scope=${scope}&q=${encodeURIComponent(search)}`
      );
      if (!res.ok) throw new Error("Failed to load jobs");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [roleType, scope, search]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/jobs?roleType=${roleType}&scope=${scope}&q=${encodeURIComponent(search)}`
        );
        if (!res.ok) throw new Error("Failed to load jobs");
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
  }, [roleType, scope, search]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchJobs();
  }

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          company: newCompany,
          location: newLocation,
          roleType: newRoleType,
          description: newDescription,
          applyUrl: newApplyUrl,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to post job");

      setStatusMessage("Job / Referral posted successfully!");
      setShowPostModal(false);
      setNewTitle("");
      setNewCompany("");
      setNewLocation("");
      setNewDescription("");
      setNewApplyUrl("");
      await fetchJobs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error posting job");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isVerified = data.currentUser.verificationStatus === "VERIFIED";

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
              <h1 className="text-sm font-bold text-slate-900">Jobs & Internal Referrals</h1>
              <p className="text-[11px] text-slate-500">Opportunities shared directly by alumni</p>
            </div>
          </div>

          <div>
            <button
              onClick={() => {
                if (!isVerified) {
                  alert("Only verified alumni can post jobs and referrals. Please verify your account first.");
                  return;
                }
                setShowPostModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Post Referral
            </button>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {statusMessage && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}




        {/* Search & Filter Controls */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job title, company, or keyword..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Scope Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setScope("institution")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  scope === "institution"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                My College Network
              </button>
              <button
                onClick={() => setScope("all")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  scope === "all"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Openings
              </button>
            </div>

            {/* Role Type Filter */}
            <div className="flex items-center gap-1.5">
              {["ALL", "FULL_TIME", "INTERNSHIP", "REMOTE"].map((type) => (
                <button
                  key={type}
                  onClick={() => setRoleType(type)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    roleType === type
                      ? "bg-purple-100 text-purple-800 border border-purple-200"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {type.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Referrals & Openings ({data.jobs.length})
            </h3>
          </div>

          {data.jobs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No jobs found matching your criteria.</p>
            </div>
          ) : (
            data.jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:border-purple-300 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900">{job.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        {job.roleType.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-2">
                      <span className="text-purple-600 font-bold">{job.company}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.applyUrl && (
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                      >
                        Apply Link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <Link
                      href={`/profile/${job.poster.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Ask for Referral
                    </Link>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                  {job.description}
                </p>

                {/* Poster Attribution */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-2">
                    <span>Referred by:</span>
                    <Link
                      href={`/profile/${job.poster.id}`}
                      className="font-bold text-slate-800 hover:text-purple-600 flex items-center gap-1"
                    >
                      {job.poster.name}
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    </Link>
                    <span>({job.poster.currentRole} at {job.poster.currentCompany})</span>
                  </div>
                  <span>{job.institution.name}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Post Referral Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Post a Job or Internal Referral</h3>
              <button
                onClick={() => setShowPostModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Associate Software Engineer"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    required
                    placeholder="e.g. Google"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role Type</label>
                  <select
                    value={newRoleType}
                    onChange={(e) => setNewRoleType(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-purple-500"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="REMOTE">Remote</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  required
                  placeholder="e.g. Bengaluru / Hybrid"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description & Referral Details
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Mention required tech stack, eligibility, or how batchmates should share their resume..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Application Link (Optional)
                </label>
                <input
                  type="url"
                  value={newApplyUrl}
                  onChange={(e) => setNewApplyUrl(e.target.value)}
                  placeholder="https://careers.company.com/job/123"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm"
                >
                  {submitting ? "Publishing..." : "Publish Referral"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
