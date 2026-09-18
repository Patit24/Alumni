"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ThumbsUp,
  MessageSquare,
  Share2,
  Send,
  ShieldCheck,
  Briefcase,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";

interface FeedItemData {
  id: string;
  type: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    currentRole: string | null;
    currentCompany: string | null;
    batchYear: number;
    verificationStatus: string;
    department: { name: string } | null;
  };
  metadata: {
    text?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    topics?: string[];
    tags?: string[];
    likes?: number;
    commentsCount?: number;
    badge?: string;
  };
}

interface FeedSectionProps {
  currentUserName: string;
  currentUserRole?: string | null;
  currentUserCompany?: string | null;
  currentUserVerified: boolean;
  batchYear: number;
}

function subscribe() {
  return () => {};
}

function calculateTimeAgo(isoString: string, now: number) {
  if (!now) return "";
  const diffMs = now - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function FeedSection({
  currentUserName,
  batchYear,
}: FeedSectionProps) {
  const [feed, setFeed] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BATCH" | "JOBS" | "MENTORSHIP">("ALL");
  const [newPostText, setNewPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [postLikes, setPostLikes] = useState<Record<string, number>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Safely read client-side time without React purity error
  const now = useSyncExternalStore(
    subscribe,
    () => Date.now(),
    () => 0
  );

  const fetchFeed = useCallback(async (selectedFilter: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/feed?filter=${selectedFilter}`);
      if (!res.ok) throw new Error("Failed to load feed");
      const json = await res.json();
      setFeed(json.feed || []);

      const initialLikes: Record<string, number> = {};
      json.feed?.forEach((item: FeedItemData) => {
        initialLikes[item.id] = item.metadata.likes || 0;
      });
      setPostLikes((prev) => ({ ...initialLikes, ...prev }));
    } catch (err) {
      console.error("Error fetching feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/feed?filter=${filter}`);
        if (!res.ok) throw new Error("Failed to load feed");
        const json = await res.json();
        if (!ignore) {
          setFeed(json.feed || []);
          const initialLikes: Record<string, number> = {};
          json.feed?.forEach((item: FeedItemData) => {
            initialLikes[item.id] = item.metadata.likes || 0;
          });
          setPostLikes((prev) => ({ ...initialLikes, ...prev }));
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
  }, [filter]);

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newPostText.trim()) return;

    try {
      setPosting(true);
      setSuccessMessage(null);
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPostText, type: "POST" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to post");

      setNewPostText("");
      setSuccessMessage("Update shared with your alumni network!");
      await fetchFeed(filter);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating post");
    } finally {
      setPosting(false);
    }
  }

  function toggleLike(postId: string) {
    const isLiked = !!likedPosts[postId];
    setLikedPosts((prev) => ({ ...prev, [postId]: !isLiked }));
    setPostLikes((prev) => ({
      ...prev,
      [postId]: (prev[postId] || 0) + (isLiked ? -1 : 1),
    }));
  }

  return (
    <div className="space-y-4">
      {/* Feed Category Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setFilter("ALL")}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${
              filter === "ALL"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setFilter("BATCH")}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${
              filter === "BATCH"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            Class of {batchYear}
          </button>
          <button
            onClick={() => setFilter("JOBS")}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${
              filter === "JOBS"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            Hiring & Referrals
          </button>
          <button
            onClick={() => setFilter("MENTORSHIP")}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${
              filter === "MENTORSHIP"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            Mentorship
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* LinkedIn-style Share Box */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
            {currentUserName.charAt(0)}
          </div>
          <form onSubmit={handleCreatePost} className="flex-1">
            <input
              type="text"
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="Share an update, placement, or tip with your alumni network..."
              className="w-full bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 rounded-2xl px-4 py-2.5 border border-transparent focus:border-blue-400 focus:outline-none transition"
            />
          </form>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="flex items-center gap-1 hover:text-blue-600 cursor-pointer p-1 rounded-lg">
              <ImageIcon className="w-4 h-4 text-emerald-500" /> Photo
            </span>
            <Link
              href="/jobs"
              className="flex items-center gap-1 hover:text-purple-600 cursor-pointer p-1 rounded-lg"
            >
              <Briefcase className="w-4 h-4 text-purple-500" /> Share Referral
            </Link>
            <Link
              href="/mentorship"
              className="flex items-center gap-1 hover:text-indigo-600 cursor-pointer p-1 rounded-lg"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" /> Offer Mentorship
            </Link>
          </div>

          <button
            onClick={handleCreatePost}
            disabled={posting || !newPostText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading network feed...</p>
        </div>
      ) : feed.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-500">No feed items found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {feed.map((item) => {
            const isLiked = !!likedPosts[item.id];
            const likesCount = postLikes[item.id] ?? (item.metadata.likes || 0);

            return (
              <article
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition space-y-3"
              >
                {/* Author Info Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${item.actor.id}`}>
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm hover:opacity-90 transition">
                        {item.actor.name.charAt(0)}
                      </div>
                    </Link>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/profile/${item.actor.id}`}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {item.actor.name}
                        </Link>
                        {item.actor.verificationStatus === "VERIFIED" && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="text-[10px] text-slate-400">
                          • {calculateTimeAgo(item.createdAt, now)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {item.actor.currentRole || "Alumni"}
                        {item.actor.currentCompany ? ` at ${item.actor.currentCompany}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Class of {item.actor.batchYear} {item.actor.department ? `• ${item.actor.department.name}` : ""}
                      </p>
                    </div>
                  </div>

                  {item.metadata.badge && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      {item.metadata.badge}
                    </span>
                  )}
                </div>

                {/* Post Content */}
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                  {item.metadata.text}
                </p>

                {/* Rich Metadata Cards (e.g. Job details or Topics) */}
                {item.type === "JOB_POSTED" && item.metadata.jobTitle && (
                  <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                        Opportunity Details
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                        {item.metadata.jobTitle}
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        {item.metadata.company} • {item.metadata.location}
                      </p>
                    </div>
                    <Link
                      href="/jobs"
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shrink-0"
                    >
                      View Referral
                    </Link>
                  </div>
                )}

                {item.type === "MENTORSHIP_AVAILABLE" && item.metadata.topics && (
                  <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        Available Guidance Topics
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.metadata.topics.map((top) => (
                          <span
                            key={top}
                            className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md text-indigo-800 border border-indigo-100"
                          >
                            {top}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link
                      href="/mentorship"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shrink-0"
                    >
                      Book Slot
                    </Link>
                  </div>
                )}

                {/* Post Footer Action Bar (LinkedIn-style) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>{likesCount} {likesCount === 1 ? "like" : "likes"}</span>
                    <span>•</span>
                    <span>{item.metadata.commentsCount || 0} comments</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleLike(item.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                        isLiked
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? "fill-blue-600" : ""}`} />
                      <span>{isLiked ? "Liked" : "Like"}</span>
                    </button>

                    <button
                      onClick={() => alert("Comments feature opening soon!")}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Comment</span>
                    </button>

                    <button
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(window.location.href);
                          alert("Link copied to clipboard!");
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
