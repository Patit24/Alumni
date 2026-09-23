"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  Calendar,
  PartyPopper,
  Radio,
  Copy,
  ExternalLink,
  MessageCircle,
  X,
  Loader2,
  Trash2,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    batchYear: number;
    currentRole: string | null;
    currentCompany: string | null;
    verificationStatus: string;
  };
}

interface FeedItemData {
  id: string;
  type: string;
  createdAt: string;
  hasLiked: boolean;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  hasSaved?: boolean;
  savesCount?: number;
  isFriend?: boolean;
  isMutualInstitution?: boolean;
  comments?: CommentData[];
  actor: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    currentRole: string | null;
    currentCompany: string | null;
    batchYear: number;
    verificationStatus: string;
    department: { name: string } | null;
  };
  metadata: {
    text?: string;
    imageUrl?: string | null;
    jobTitle?: string;
    company?: string;
    location?: string;
    topics?: string[];
    tags?: string[];
    badge?: string;
  };
}

interface FeedSectionProps {
  currentUserName: string;
  currentUserRole?: string | null;
  currentUserCompany?: string | null;
  currentUserVerified: boolean;
  batchYear: number;
  institutionId?: string;
  currentUserAvatar?: string | null;
}

const FEED_CACHE_KEY = "alumni_local_feed_cache_v2";

function getLocalFeedPosts(): FeedItemData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFeedPost(post: FeedItemData) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalFeedPosts();
    const updated = [post, ...existing.filter((p) => p.id !== post.id)].slice(0, 40);
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not save post to local cache:", e);
  }
}

function updateLocalFeedPost(postId: string, updater: (post: FeedItemData) => FeedItemData) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalFeedPosts();
    const updated = existing.map((p) => (p.id === postId ? updater(p) : p));
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not update post in local cache:", e);
  }
}

function syncLocalFeedPosts(posts: FeedItemData[]) {
  if (typeof window === "undefined" || !posts.length) return;
  try {
    const localPosts = getLocalFeedPosts();
    const map = new Map<string, FeedItemData>();
    localPosts.forEach((p) => map.set(p.id, p));
    posts.forEach((p) => map.set(p.id, p));
    const merged = Array.from(map.values()).slice(0, 50);
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn("Could not sync local feed posts:", e);
  }
}

function removeLocalFeedPost(postId: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalFeedPosts();
    const updated = existing.filter((p) => p.id !== postId);
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not remove post from local cache:", e);
  }
}

function calculateTimeAgo(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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
  currentUserAvatar: initialAvatar,
}: FeedSectionProps) {
  const [feed, setFeed] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BATCH" | "JOBS" | "MENTORSHIP" | "SAVED">("ALL");
  const [newPostText, setNewPostText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(initialAvatar || null);

  useEffect(() => {
    if (initialAvatar) setCurrentUserAvatar(initialAvatar);
  }, [initialAvatar]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleProfileUpdate = (e: any) => {
      if (e.detail?.avatarUrl !== undefined) {
        setCurrentUserAvatar(e.detail.avatarUrl);
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("profile-updated", handleProfileUpdate);
  }, []);
  const [posting, setPosting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active open comments section by post ID
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // Share Modal state
  const [shareModalPost, setShareModalPost] = useState<FeedItemData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Realtime Status
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const institutionIdRef = useRef<string | null>(null);

  // Handle Photo Pick and Compression (optimized 900x900 JPEG ~50-80KB for permanent fast display)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setSelectedImage(compressedDataUrl);
        } else {
          setSelectedImage(result);
        }
        setUploadingImage(false);
      };
      img.onerror = () => {
        alert("Could not process image file.");
        setUploadingImage(false);
      };
      img.src = result;
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const fetchFeed = useCallback(async (selectedFilter: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/feed?filter=${selectedFilter}`);
      if (!res.ok) throw new Error("Failed to load feed");
      const json = await res.json();
      const serverPosts: FeedItemData[] = json.feed || [];
      const localPosts = getLocalFeedPosts();

      if (serverPosts.length > 0) {
        syncLocalFeedPosts(serverPosts);
      }

      // Merge server posts with local posts so that user-created posts and photos NEVER vanish
      const map = new Map<string, FeedItemData>();
      // First insert server posts
      serverPosts.forEach((p) => map.set(p.id, p));
      // Then overlay any locally saved posts not yet on server or dropped by serverless cold start
      localPosts.forEach((p) => {
        if (!map.has(p.id)) {
          map.set(p.id, p);
        }
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setFeed(merged);
      if (json.currentUser?.institutionId) {
        institutionIdRef.current = json.currentUser.institutionId;
      }
    } catch (err) {
      console.error("Error fetching feed:", err);
      // Even if network fails, display local posts
      const localPosts = getLocalFeedPosts();
      if (localPosts.length > 0) {
        setFeed(localPosts);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load on filter change
  useEffect(() => {
    fetchFeed(filter);
  }, [filter, fetchFeed]);

  // Rock-solid live synchronization: silent 6-second polling + visibility/focus instant refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFeed(filter, true);
    }, 6000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchFeed(filter, true);
      }
    };
    const handleFocus = () => {
      fetchFeed(filter, true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [filter, fetchFeed]);

  // Supabase Realtime Channel Subscription
  useEffect(() => {
    const supabase = createClient();
    const channelName = "campus-feed-global";
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "new-post" }, (event) => {
        const newPost = event.payload as FeedItemData;
        saveLocalFeedPost(newPost);
        setFeed((prev) => {
          if (prev.some((p) => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
      })
      .on("broadcast", { event: "like-update" }, (event) => {
        const { feedItemId, likesCount } = event.payload as {
          feedItemId: string;
          likesCount: number;
          actorId: string;
        };
        updateLocalFeedPost(feedItemId, (p) => ({ ...p, likesCount }));
        setFeed((prev) =>
          prev.map((item) =>
            item.id === feedItemId ? { ...item, likesCount } : item
          )
        );
      })
      .on("broadcast", { event: "new-comment" }, (event) => {
        const { feedItemId, comment, totalComments } = event.payload as {
          feedItemId: string;
          comment: CommentData;
          totalComments: number;
        };
        updateLocalFeedPost(feedItemId, (p) => {
          const currentComments = p.comments || [];
          const exists = currentComments.some((c) => c.id === comment.id);
          return {
            ...p,
            commentsCount: totalComments,
            comments: exists ? currentComments : [...currentComments, comment],
          };
        });
        setFeed((prev) =>
          prev.map((item) => {
            if (item.id === feedItemId) {
              const currentComments = item.comments || [];
              const exists = currentComments.some((c) => c.id === comment.id);
              return {
                ...item,
                commentsCount: totalComments,
                comments: exists ? currentComments : [...currentComments, comment],
              };
            }
            return item;
          })
        );
      })
      .on("broadcast", { event: "share-update" }, (event) => {
        const { feedItemId, sharesCount } = event.payload as {
          feedItemId: string;
          sharesCount: number;
        };
        updateLocalFeedPost(feedItemId, (p) => ({ ...p, sharesCount }));
        setFeed((prev) =>
          prev.map((item) =>
            item.id === feedItemId ? { ...item, sharesCount } : item
          )
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeActive(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Post Submission
  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (uploadingImage) {
      alert("Your photo is still optimizing. Please wait a moment...");
      return;
    }
    if (!newPostText.trim() && !selectedImage) return;

    try {
      setPosting(true);
      setSuccessMessage(null);
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newPostText,
          imageUrl: selectedImage,
          type: "POST",
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to post");

      const createdItem: FeedItemData = result.feedItem;
      if (createdItem) {
        // Persist to local cache so the post and its image NEVER vanish on this device
        saveLocalFeedPost(createdItem);
        // Prepend directly to active feed
        setFeed((prev) => [createdItem, ...prev.filter((p) => p.id !== createdItem.id)]);
      }

      setNewPostText("");
      setSelectedImage(null);
      setSuccessMessage("Update and photo shared live with your alumni network!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating post");
    } finally {
      setPosting(false);
    }
  }

  // Delete Post Handler
  async function handleDeletePost(postId: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    setFeed((prev) => prev.filter((item) => item.id !== postId));
    removeLocalFeedPost(postId);

    try {
      await fetch(`/api/feed/${postId}`, { method: "DELETE" });
    } catch (err) {
      console.warn("Delete post error:", err);
    }
  }

  // Like Toggle Handler with Optimistic UI & Supabase sync
  async function toggleLike(postId: string) {
    const currentPost = feed.find((p) => p.id === postId);
    const nextHasLiked = currentPost ? !currentPost.hasLiked : true;
    const nextCount = currentPost ? Math.max(0, currentPost.likesCount + (nextHasLiked ? 1 : -1)) : 1;

    // Optimistically update React state
    setFeed((prev) =>
      prev.map((item) => {
        if (item.id === postId) {
          return {
            ...item,
            hasLiked: nextHasLiked,
            likesCount: nextCount,
          };
        }
        return item;
      })
    );

    // Optimistically update local storage cache so it persists on refresh
    updateLocalFeedPost(postId, (p) => ({
      ...p,
      hasLiked: nextHasLiked,
      likesCount: nextCount,
    }));

    try {
      const res = await fetch(`/api/feed/${postId}/like`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        updateLocalFeedPost(postId, (p) => ({
          ...p,
          hasLiked: data.hasLiked,
          likesCount: data.likesCount,
        }));
        setFeed((prev) =>
          prev.map((item) =>
            item.id === postId
              ? { ...item, hasLiked: data.hasLiked, likesCount: data.likesCount }
              : item
          )
        );
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  }

  // Save / Bookmark Toggle Handler with Optimistic UI & Local Sync
  async function toggleSave(postId: string) {
    const currentPost = feed.find((p) => p.id === postId);
    const nextHasSaved = currentPost ? !currentPost.hasSaved : true;
    const nextCount = currentPost
      ? Math.max(0, (currentPost.savesCount || 0) + (nextHasSaved ? 1 : -1))
      : 1;

    // Optimistically update React state
    setFeed((prev) =>
      prev.map((item) => {
        if (item.id === postId) {
          return {
            ...item,
            hasSaved: nextHasSaved,
            savesCount: nextCount,
          };
        }
        return item;
      })
    );

    // Optimistically update local cache
    updateLocalFeedPost(postId, (p) => ({
      ...p,
      hasSaved: nextHasSaved,
      savesCount: nextCount,
    }));

    try {
      const res = await fetch(`/api/feed/${postId}/save`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        updateLocalFeedPost(postId, (p) => ({
          ...p,
          hasSaved: data.saved,
          savesCount: data.savesCount,
        }));
        setFeed((prev) =>
          prev.map((item) =>
            item.id === postId
              ? { ...item, hasSaved: data.saved, savesCount: data.savesCount }
              : item
          )
        );
      }
    } catch (err) {
      console.error("Error toggling save:", err);
    }
  }

  // Add Comment Handler
  async function handleAddComment(postId: string) {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`/api/feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post comment");

      // Clear input
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));

      // Optimistically append comment to React state
      setFeed((prev) =>
        prev.map((item) => {
          if (item.id === postId) {
            const comments = item.comments || [];
            return {
              ...item,
              commentsCount: data.totalComments,
              comments: [...comments, data.comment],
            };
          }
          return item;
        })
      );

      // Persist comment to local storage cache so it never vanishes on refresh
      updateLocalFeedPost(postId, (p) => {
        const comments = p.comments || [];
        return {
          ...p,
          commentsCount: data.totalComments,
          comments: [...comments, data.comment],
        };
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error posting comment");
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  }

  // Handle Share Action
  async function handleShareAction(post: FeedItemData, platform: "LINK_COPY" | "WHATSAPP") {
    try {
      await fetch(`/api/feed/${post.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      // Increment local count
      setFeed((prev) =>
        prev.map((item) =>
          item.id === post.id ? { ...item, sharesCount: item.sharesCount + 1 } : item
        )
      );

      const postUrl = typeof window !== "undefined" ? `${window.location.origin}/?post=${post.id}` : "";

      if (platform === "LINK_COPY") {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(postUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 3000);
        }
      } else if (platform === "WHATSAPP") {
        const text = encodeURIComponent(
          `Check out this alumni update from ${post.actor.name} on our Campus Network:\n\n"${post.metadata.text || ""}"\n\nJoin the discussion: ${postUrl}`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Feed Category Filter Header & Live Realtime Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {(["ALL", "BATCH", "JOBS", "MENTORSHIP", "SAVED"] as const).map((tab) => {
            const label =
              tab === "ALL"
                ? "All Activity"
                : tab === "BATCH"
                ? `Class of ${batchYear}`
                : tab === "JOBS"
                ? "Hiring & Referrals"
                : tab === "MENTORSHIP"
                ? "Mentorship"
                : "Saved";
            const isActive = filter === tab;

            return (
              <motion.button
                key={tab}
                whileTap={{ scale: 0.96 }}
                onClick={() => setFilter(tab)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
                }`}
              >
                {tab === "SAVED" && (
                  <Bookmark className={`w-3 h-3 ${isActive ? "fill-white text-white" : "text-slate-400"}`} />
                )}
                <span>{label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Live Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-600 shadow-2xs shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isRealtimeActive ? "bg-emerald-400" : "bg-amber-400"
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isRealtimeActive ? "bg-emerald-500" : "bg-amber-500"
            }`}></span>
          </span>
          <span>{isRealtimeActive ? "Live Feed" : "Connecting..."}</span>
        </div>
      </div>

      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share / Post Composer Box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs shadow-blue-500/20 overflow-hidden">
            {currentUserAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUserAvatar}
                alt={currentUserName}
                className="w-full h-full object-cover"
              />
            ) : (
              currentUserName.charAt(0)
            )}
          </div>
          <form onSubmit={handleCreatePost} className="flex-1 min-w-0">
            <input
              type="text"
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              disabled={posting || uploadingImage}
              placeholder="Share an update, placement, or tip with your alumni network..."
              className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 rounded-2xl px-4 py-2.5 border border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition disabled:opacity-60"
            />
          </form>
        </div>

        {/* Uploading / Processing Image Progress */}
        {uploadingImage && (
          <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-blue-50 border border-blue-200/80 text-xs text-blue-700 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            <span>Optimizing and compressing photo for instant feed display...</span>
          </div>
        )}

        {/* Selected Image Thumbnail Preview */}
        {selectedImage && (
          <div className="relative inline-block mt-2 rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Upload preview"
              className="max-h-48 w-auto object-cover rounded-2xl"
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-950 text-white rounded-full p-1 transition shadow-md"
              title="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hidden File Input for Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoSelect}
          accept="image/*"
          className="hidden"
        />

        {/* Composer Action Bar */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 sm:gap-2 text-slate-500 text-xs overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={posting || uploadingImage}
              className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition disabled:opacity-50 whitespace-nowrap font-medium text-slate-600"
            >
              <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{uploadingImage ? "Processing..." : selectedImage ? "Change Photo" : "Photo"}</span>
            </button>
            <Link
              href="/reunions"
              className="flex items-center gap-1.5 hover:text-amber-600 cursor-pointer px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition whitespace-nowrap font-medium text-slate-600"
            >
              <PartyPopper className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="hidden xs:inline">Plan</span> Reunion
            </Link>
            <Link
              href="/jobs"
              className="flex items-center gap-1.5 hover:text-purple-600 cursor-pointer px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition whitespace-nowrap font-medium text-slate-600"
            >
              <Briefcase className="w-4 h-4 text-purple-500 shrink-0" />
              <span>Referral</span>
            </Link>
            <Link
              href="/mentorship"
              className="flex items-center gap-1.5 hover:text-indigo-600 cursor-pointer px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition whitespace-nowrap font-medium text-slate-600"
            >
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Mentorship</span>
            </Link>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleCreatePost}
            disabled={posting || uploadingImage || (!newPostText.trim() && !selectedImage)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-xs shrink-0"
          >
            {posting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Posting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Feed Stream */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading live alumni network feed...</p>
        </div>
      ) : feed.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-500">No feed items found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map((item, index) => {
            const isCommentsOpen = openCommentsPostId === item.id;
            const commentsList = item.comments || [];

            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition space-y-3"
              >
                {/* Author Info Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link href={`/profile/${item.actor.id}`} className="shrink-0">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs hover:opacity-90 transition overflow-hidden">
                        {item.actor.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.actor.avatarUrl}
                            alt={item.actor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          item.actor.name.charAt(0)
                        )}
                      </div>
                    </Link>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/profile/${item.actor.id}`}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 transition truncate"
                        >
                          {item.actor.name}
                        </Link>
                        {item.actor.verificationStatus === "VERIFIED" && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span className="text-[10px] text-slate-400 shrink-0">
                          • {calculateTimeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.actor.currentRole || "Alumni"}
                        {item.actor.currentCompany ? ` at ${item.actor.currentCompany}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Class of {item.actor.batchYear} {item.actor.department ? `• ${item.actor.department.name}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {item.isMutualInstitution && (item.type === "JOB_POSTED" || item.type === "MENTORSHIP_AVAILABLE") && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                        Mutual School / College
                      </span>
                    )}
                    {item.isFriend && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
                        Friend
                      </span>
                    )}
                    {item.metadata.badge && (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                        {item.metadata.badge}
                      </span>
                    )}
                    {item.actor.name === currentUserName && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(item.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                        title="Delete this post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                {item.metadata.text && (
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    {item.metadata.text}
                  </p>
                )}

                {/* Uploaded Post Photo */}
                {item.metadata.imageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-50 max-h-[460px] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.metadata.imageUrl}
                      alt="Post visual"
                      loading="lazy"
                      className="w-full h-auto max-h-[460px] object-cover rounded-2xl"
                    />
                  </div>
                )}

                {/* Rich Metadata Cards */}
                {item.type === "EVENT_CREATED" && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Batch Reunion Gathering
                        </span>
                        <p className="text-xs font-bold text-slate-900">Check dates, venue & RSVPs</p>
                      </div>
                    </div>
                    <Link
                      href="/reunions"
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shrink-0"
                    >
                      View Reunion
                    </Link>
                  </div>
                )}

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

                {/* Counts Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-600">{item.likesCount}</span>
                    <span>{item.likesCount === 1 ? "like" : "likes"}</span>
                    <span>•</span>
                    <button
                      onClick={() =>
                        setOpenCommentsPostId(isCommentsOpen ? null : item.id)
                      }
                      className="hover:text-blue-600 transition underline-offset-2 hover:underline"
                    >
                      <span className="font-semibold text-slate-600">{item.commentsCount}</span>{" "}
                      {item.commentsCount === 1 ? "comment" : "comments"}
                    </button>
                    {(item.savesCount ?? 0) > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">{item.savesCount}</span>
                        <span>{item.savesCount === 1 ? "saved" : "saves"}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600">{item.sharesCount}</span>
                    <span>{item.sharesCount === 1 ? "share" : "shares"}</span>
                  </div>
                </div>

                {/* Action Bar (Like, Comment, Share, Save) */}
                <div className="pt-1.5 flex items-center justify-between gap-1">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => toggleLike(item.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition ${
                      item.hasLiked
                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : "text-slate-600 hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <ThumbsUp
                      className={`w-4 h-4 ${item.hasLiked ? "fill-blue-600 text-blue-600" : ""}`}
                    />
                    <span>{item.hasLiked ? "Liked" : "Like"}</span>
                  </motion.button>

                  <button
                    onClick={() =>
                      setOpenCommentsPostId(isCommentsOpen ? null : item.id)
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition ${
                      isCommentsOpen
                        ? "bg-slate-100 text-slate-900 font-extrabold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Comment</span>
                  </button>

                  <button
                    onClick={() => setShareModalPost(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl text-slate-600 hover:bg-slate-50 transition"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => toggleSave(item.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition ${
                      item.hasSaved
                        ? "bg-amber-50 text-amber-600 border border-amber-200"
                        : "text-slate-600 hover:bg-slate-50 border border-transparent"
                    }`}
                    title={item.hasSaved ? "Saved to your bookmarks" : "Save post"}
                  >
                    <Bookmark
                      className={`w-4 h-4 ${item.hasSaved ? "fill-amber-600 text-amber-600" : ""}`}
                    />
                    <span>{item.hasSaved ? "Saved" : "Save"}</span>
                  </motion.button>
                </div>

                {/* Inline Real-Time Comments Section */}
                <AnimatePresence>
                  {isCommentsOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pt-3 border-t border-slate-100 space-y-3"
                    >
                      {/* Comment Input */}
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {currentUserAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={currentUserAvatar}
                              alt={currentUserName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            currentUserName.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 flex items-center gap-1.5 bg-slate-100 rounded-2xl px-3 py-1.5 border border-slate-200/60 focus-within:border-blue-400 focus-within:bg-white transition">
                          <input
                            type="text"
                            value={commentInputs[item.id] || ""}
                            onChange={(e) =>
                              setCommentInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(item.id);
                              }
                            }}
                            placeholder="Write a comment..."
                            className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400"
                          />
                          <button
                            disabled={
                              submittingComment[item.id] ||
                              !commentInputs[item.id]?.trim()
                            }
                            onClick={() => handleAddComment(item.id)}
                            className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-40 transition shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Comments List */}
                      {commentsList.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic text-center py-2">
                          No comments yet. Be the first to start the conversation!
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                          {commentsList.map((comm) => (
                            <div
                              key={comm.id}
                              className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-100"
                            >
                              <div className="h-7 w-7 rounded-xl bg-slate-800 text-white flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden">
                                {comm.user.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={comm.user.avatarUrl}
                                    alt={comm.user.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  comm.user.name.charAt(0)
                                )}
                              </div>
                              <div className="flex-1 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900">
                                      {comm.user.name}
                                    </span>
                                    {comm.user.verificationStatus === "VERIFIED" && (
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    )}
                                    <span className="text-[10px] text-slate-400">
                                      &apos;{comm.user.batchYear.toString().slice(-2)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {calculateTimeAgo(comm.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                  {comm.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalPost && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Share Alumni Update</h3>
                </div>
                <button
                  onClick={() => {
                    setShareModalPost(null);
                    setCopiedLink(false);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Share this post by <strong>{shareModalPost.actor.name}</strong> with your fellow alumni and study groups.
              </p>

              <div className="space-y-2 pt-1">
                {/* 1-Tap Copy Link */}
                <button
                  onClick={() => handleShareAction(shareModalPost, "LINK_COPY")}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-800 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>{copiedLink ? "Link Copied to Clipboard!" : "Copy Post Link"}</span>
                  </div>
                  {copiedLink && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </button>

                {/* WhatsApp Share */}
                <button
                  onClick={() => handleShareAction(shareModalPost, "WHATSAPP")}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-800 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>Share to WhatsApp Group</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>

              <button
                onClick={() => {
                  setShareModalPost(null);
                  setCopiedLink(false);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
