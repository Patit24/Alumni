"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Send,
  Music,
  Play,
  Pause,
  Share2,
  Users,
  ShieldCheck,
  Building,
  GraduationCap,
  RefreshCw,
  FolderOpen,
  Radio,
  Sparkles,
  UserPlus,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Plus,
  ShieldAlert,
  Lock,
  CameraOff,
  Camera,
  AlertTriangle,
  Clock,
  EyeOff,
  Sliders,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Member {
  id: string;
  name: string;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
  verificationStatus: string;
}

interface Message {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  metadata?: {
    title?: string;
    artist?: string;
    embedType?: "SPOTIFY" | "APPLE_MUSIC" | "GAANA" | "YOUTUBE";
    embedUrl?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    roleType?: string;
    topic?: string;
    mentorName?: string;
  } | null;
  sender: {
    id: string;
    name: string;
    batchYear: number;
    currentRole: string | null;
    currentCompany: string | null;
    verificationStatus: string;
  };
}

interface GroupData {
  currentUser: {
    id: string;
    name: string;
    isAdmin: boolean;
  };
  group: {
    id: string;
    name: string;
    description: string | null;
    scope: string;
    batchYear: number | null;
    institutionName: string;
    memberCount: number;
    members: Member[];
    isSecretMode: boolean;
    allowScreenshot: boolean;
    createdById: string;
  };
  messages: Message[];
}

// Built-in campus radio & chill ambient tracks
const PRESET_TRACKS = [
  {
    title: "Campus Study Lo-Fi Beats",
    artist: "Alumni Chill Radio",
    src: "https://actions.google.com/sounds/v1/weather/rain_heavy.ogg",
  },
  {
    title: "Late Night Coding Stream",
    artist: "University Tech Society",
    src: "https://actions.google.com/sounds/v1/science_fiction/deep_space_drone.ogg",
  },
  {
    title: "Acoustic Campus Breeze",
    artist: "Brainware Music Jam",
    src: "https://actions.google.com/sounds/v1/weather/gentle_stream.ogg",
  },
];

export default function GroupChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);

  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);

  // In-App Music Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackName, setCurrentTrackName] = useState<string>("Campus Study Lo-Fi Beats");
  const [currentArtist, setCurrentArtist] = useState<string>("Alumni Chill Radio");
  const [audioProgress, setAudioProgress] = useState(0);
  const [showMusicDock, setShowMusicDock] = useState(true);

  // Modal States
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [candidateUsers, setCandidateUsers] = useState<Member[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const [showShareJobModal, setShowShareJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "",
    location: "Remote / India",
    roleType: "Full-Time",
  });

  const [showShareMentorshipModal, setShowShareMentorshipModal] = useState(false);
  const [mentorForm, setMentorForm] = useState({
    topic: "Resume Review & Career Guidance",
    description: "",
  });

  const [showStreamingModal, setShowStreamingModal] = useState(false);
  const [streamService, setStreamService] = useState<"SPOTIFY" | "GAANA" | "APPLE_MUSIC">("SPOTIFY");
  const [streamUrl, setStreamUrl] = useState("");

  // Privacy & Anti-Screenshot States
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [updatingSecurity, setUpdatingSecurity] = useState(false);
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState(false);
  const [liveScreenshotAlert, setLiveScreenshotAlert] = useState<{
    culpritName: string;
    timestamp: string;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchRoomData = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`);
      if (!res.ok) throw new Error("Failed to load group");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/groups/${groupId}/messages`);
        if (!res.ok) throw new Error("Failed to load group");
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

    // Supabase Realtime Subscription for live instant messages & screenshot alerts
    const supabase = createClient();
    const channel = supabase.channel(`campus-group:${groupId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "new-chat-message" }, (event) => {
        const newMsg = event.payload as Message;
        setData((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((m) => m.id === newMsg.id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, newMsg],
          };
        });
      })
      .on("broadcast", { event: "screenshot-alert" }, (event) => {
        const payload = event.payload as { culpritName: string; timestamp: string };
        setLiveScreenshotAlert(payload);
        setTimeout(() => {
          setLiveScreenshotAlert(null);
        }, 8000);
      })
      .on("broadcast", { event: "group-security-update" }, (event) => {
        const payload = event.payload as { isSecretMode: boolean; allowScreenshot: boolean };
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            group: {
              ...prev.group,
              isSecretMode: payload.isSecretMode,
              allowScreenshot: payload.allowScreenshot,
            },
          };
        });
      })
      .subscribe();

    // Background interval poll (every 4s) to ensure full synchronization and 2-day vanishing purge
    const interval = setInterval(() => {
      fetchRoomData();
    }, 4000);

    return () => {
      ignore = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchRoomData]);

  // Anti-Screenshot & Screen Capture Protection Listeners
  useEffect(() => {
    if (!data) return;
    const { group, currentUser } = data;

    // Report screenshot attempt to server and group
    const reportScreenshotAttempt = async () => {
      try {
        await fetch(`/api/groups/${groupId}/security`, {
          method: "POST",
        });
      } catch (err) {
        console.error("Failed to report screenshot:", err);
      }
    };

    // Keyboard listener for screenshot shortcuts (PrintScreen, Cmd+Shift+3/4/5, Snipping tool, Windows key combos)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrintScreen =
        e.key === "PrintScreen" ||
        e.code === "PrintScreen" ||
        e.key === "Snapshot";
      const isMacScreenshot =
        (e.metaKey || e.metaKey === true) &&
        (e.shiftKey || e.shiftKey === true) &&
        ["3", "4", "5", "6", "$", "%", "^"].includes(e.key);
      const isWindowsSnip =
        (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s";

      if (isPrintScreen || isMacScreenshot || isWindowsSnip) {
        if (!group.allowScreenshot) {
          // Trigger instant blackout shield immediately to protect chat content
          setIsPrivacyShieldActive(true);
          // Overwrite clipboard to prevent screenshot paste
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText("Screenshots are protected in this Alumni conversation.").catch(() => {});
          }
          setTimeout(() => setIsPrivacyShieldActive(false), 3000);
        }

        // Notify entire group of screenshot action
        reportScreenshotAttempt();
      }
    };

    // On blur / visibility change / snippet tool trigger, shield sensitive chat
    const handleVisibilityOrBlur = () => {
      if (!group.allowScreenshot) {
        setIsPrivacyShieldActive(true);
      }
    };

    const handleWindowFocus = () => {
      // Delay unshield slightly to ensure snapshot tool has finished
      setTimeout(() => {
        setIsPrivacyShieldActive(false);
      }, 500);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyDown, true);
    window.addEventListener("blur", handleVisibilityOrBlur);
    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    window.addEventListener("focus", handleWindowFocus);

    if (!group.allowScreenshot) {
      document.body.classList.add("screenshot-blocked");
    } else {
      document.body.classList.remove("screenshot-blocked");
    }

    return () => {
      document.body.classList.remove("screenshot-blocked");
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
      window.removeEventListener("blur", handleVisibilityOrBlur);
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [data, groupId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  // Setup initial audio track
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(PRESET_TRACKS[0].src);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && audioRef.current.duration) {
          setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      };
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function togglePlayPause() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log("Audio play error:", err));
    }
  }

  // Handle local mobile/PC file picker
  function handleDeviceFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    if (audioRef.current) {
      audioRef.current.src = fileUrl;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          const cleanName = file.name.replace(/\.[^/.]+$/, "");
          setCurrentTrackName(cleanName);
          setCurrentArtist("My Mobile Device");
        })
        .catch(console.error);
    }
  }

  function playPresetTrack(track: typeof PRESET_TRACKS[0]) {
    if (audioRef.current) {
      audioRef.current.src = track.src;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setCurrentTrackName(track.title);
          setCurrentArtist(track.artist);
        })
        .catch(console.error);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    try {
      setSending(true);
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: inputMessage,
          type: "TEXT",
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send");

      setInputMessage("");
      await fetchRoomData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error sending message");
    } finally {
      setSending(false);
    }
  }

  // Admin toggles security settings (Secret Mode or Screenshot Permission)
  async function handleUpdateSecurity(setting: { isSecretMode?: boolean; allowScreenshot?: boolean }) {
    try {
      setUpdatingSecurity(true);
      const res = await fetch(`/api/groups/${groupId}/security`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update security");

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          group: {
            ...prev.group,
            ...json.group,
          },
        };
      });
      await fetchRoomData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Security update error");
    } finally {
      setUpdatingSecurity(false);
    }
  }

  // Share Spotify / Gaana / Apple Music link
  async function handleShareStreamingTrack() {
    if (!streamUrl.trim()) return;

    let title = "Shared Track";
    const artist = streamService === "SPOTIFY" ? "Spotify Music" : streamService === "GAANA" ? "Gaana.com" : "Apple Music";

    if (streamService === "SPOTIFY") {
      title = "Spotify Track / Playlist";
    } else if (streamService === "GAANA") {
      title = "Gaana Campus Hit";
    } else {
      title = "Apple Music Stream";
    }

    try {
      await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Streaming on ${artist}: ${streamUrl}`,
          type: "STREAMING_SHARE",
          metadata: {
            title,
            artist,
            embedType: streamService,
            embedUrl: streamUrl.trim(),
          },
        }),
      });
      setStreamUrl("");
      setShowStreamingModal(false);
      await fetchRoomData();
    } catch (err) {
      console.error(err);
    }
  }

  // Share Job Opportunity inside Group
  async function handleShareJob() {
    if (!jobForm.title || !jobForm.company) return;

    try {
      await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🎯 Group Job Referral: ${jobForm.title} at ${jobForm.company}`,
          type: "JOB_SHARE",
          metadata: {
            jobTitle: jobForm.title,
            company: jobForm.company,
            location: jobForm.location,
            roleType: jobForm.roleType,
          },
        }),
      });
      setShowShareJobModal(false);
      setJobForm({ title: "", company: "", location: "Remote / India", roleType: "Full-Time" });
      await fetchRoomData();
    } catch (err) {
      console.error(err);
    }
  }

  // Share Mentorship Offering inside Group
  async function handleShareMentorship() {
    try {
      await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `💡 Mentorship Slot Available in Group: ${mentorForm.topic}`,
          type: "MENTORSHIP_SHARE",
          metadata: {
            topic: mentorForm.topic,
            mentorName: data?.currentUser.name,
          },
        }),
      });
      setShowShareMentorshipModal(false);
      await fetchRoomData();
    } catch (err) {
      console.error(err);
    }
  }

  // Load candidate alumni to add to group
  async function openAddMember() {
    setShowAddMemberModal(true);
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const json = await res.json();
      setCandidateUsers(json.availableUsers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  }

  // Add alumnus to group
  async function addMember(userId: string) {
    try {
      setAddingMemberId(userId);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setCandidateUsers((prev) => prev.filter((u) => u.id !== userId));
        await fetchRoomData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingMemberId(null);
    }
  }

  async function handleShareCurrentTrackToChat() {
    try {
      await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Vibing to: ${currentTrackName} 🎧`,
          type: "MUSIC_SHARE",
          metadata: {
            title: currentTrackName,
            artist: currentArtist,
          },
        }),
      });
      await fetchRoomData();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-pink-600 animate-spin" />
          <p className="text-xs text-slate-500">Entering group lounge...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-xs text-slate-500">Group not found or restricted by Secret Mode.</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-100 flex flex-col justify-between select-none ${
        !data.group.allowScreenshot ? "select-none screenshot-restricted" : ""
      } ${isPrivacyShieldActive ? "screenshot-shield-active" : ""}`}
      style={{
        WebkitTouchCallout: "none",
        userSelect: "none",
      }}
    >
      {/* Hidden audio file picker for mobile & PC */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDeviceFilePick}
        accept="audio/*"
        className="hidden"
      />

      {/* Instant Privacy Blackout Shield (When screen capture is attempted or window loses focus) */}
      <AnimatePresence>
        {isPrivacyShieldActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 text-center text-white"
          >
            <div className="h-16 w-16 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4 shadow-lg">
              <CameraOff className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold">Screenshot Protection Active</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              The group admin has restricted screenshots for this room. Chat content is shielded to protect member privacy.
            </p>
            <button
              onClick={() => setIsPrivacyShieldActive(false)}
              className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl transition border border-slate-700"
            >
              Resume Viewing
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Live Screenshot Alert Toast */}
      <AnimatePresence>
        {liveScreenshotAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-rose-500"
          >
            <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-bounce" />
            <span>⚠️ {liveScreenshotAlert.culpritName} took a screenshot of this conversation!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/groups"
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm shadow-pink-500/20">
              {data.group.name.charAt(0)}
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm font-bold text-slate-900">{data.group.name}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                  {data.group.scope === "SAME_BATCH"
                    ? `Class of ${data.group.batchYear}`
                    : "University Wide"}
                </span>

                {data.group.isSecretMode && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 flex items-center gap-1 border border-slate-700">
                    <Lock className="w-2.5 h-2.5" /> Secret • 48h Vanish
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{data.group.memberCount} members</span>
                <span>•</span>
                <span>{data.group.institutionName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Admin Security / Privacy Settings Button */}
            {data.currentUser.isAdmin && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSecurityModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  data.group.isSecretMode
                    ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Security & Privacy</span>
              </motion.button>
            )}

            {/* Add Member Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={openAddMember}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Member</span>
            </motion.button>

            {/* Toggle Music Player Dock */}
            <button
              onClick={() => setShowMusicDock(!showMusicDock)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                showMusicDock
                  ? "bg-pink-50 text-pink-700 border border-pink-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Music className={`w-3.5 h-3.5 ${isPlaying ? "animate-bounce" : ""}`} />
              <span>{isPlaying ? "Playing..." : "Music Lounge"}</span>
            </button>
          </div>
        </div>

        {/* Secret Mode Banner */}
        {data.group.isSecretMode && (
          <div className="max-w-4xl mx-auto mt-2 bg-slate-900 text-amber-300 px-3 py-1.5 rounded-xl text-[11px] font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>Secret Conversation Active:</strong> Older messages vanish after 48 hours. Only group members can view.
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Screenshots: {data.group.allowScreenshot ? "Permitted" : "Blocked & Audited"}
            </span>
          </div>
        )}
      </header>

      {/* In-App Mobile & Streaming Music Player Bar */}
      {showMusicDock && (
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white px-4 py-3 border-b border-purple-900/50 shrink-0 shadow-md">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Track Info & Play Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={togglePlayPause}
                className="h-10 w-10 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-500/20 transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[280px]">
                    {currentTrackName}
                  </span>
                  <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded font-medium">
                    {currentArtist}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-48 sm:w-64 h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-pink-500 transition-all duration-200"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Audio Source Options */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Play from Device */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition border border-white/10"
              >
                <FolderOpen className="w-3.5 h-3.5 text-pink-400" />
                <span>Play from Mobile</span>
              </button>

              {/* Spotify / Gaana / Apple Music Player Button */}
              <button
                onClick={() => setShowStreamingModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl transition border border-emerald-500/30"
              >
                <Music className="w-3.5 h-3.5 text-emerald-400" />
                <span>Spotify / Gaana</span>
              </button>

              {/* Campus Lo-Fi Preset */}
              <button
                onClick={() => playPresetTrack(PRESET_TRACKS[0])}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition border border-white/10"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Campus Beats</span>
              </button>

              {/* Share current track to chat */}
              <button
                onClick={handleShareCurrentTrackToChat}
                title="Share track in chat"
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Stream with DRM protection */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-3">
        {data.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
            <Music className="w-10 h-10 text-slate-300 animate-pulse" />
            <p className="text-xs">No messages yet. Start the conversation or share music from your mobile!</p>
          </div>
        ) : (
          data.messages.map((msg) => {
            const isMe = msg.sender.id === data.currentUser.id;

            if (msg.type === "SYSTEM") {
              const isAlert = msg.content.includes("SCREENSHOT ALERT");
              return (
                <div key={msg.id} className="text-center my-3">
                  <span
                    className={`text-[11px] px-3 py-1 rounded-full font-medium shadow-2xs ${
                      isAlert
                        ? "bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                        : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {msg.content}
                  </span>
                </div>
              );
            }

            // In-App Job Opportunity Card
            if (msg.type === "JOB_SHARE" && msg.metadata) {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-2`}>
                  <div className="max-w-sm bg-purple-50 border border-purple-200 rounded-3xl p-4 shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-purple-700">Internal Referral</span>
                        <p className="text-xs font-bold text-slate-900">{msg.metadata.jobTitle}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {msg.metadata.company} • {msg.metadata.location}
                    </p>
                    <Link
                      href="/jobs"
                      className="block text-center py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      View & Apply on Jobs Board
                    </Link>
                  </div>
                </div>
              );
            }

            // In-App Mentorship Card
            if (msg.type === "MENTORSHIP_SHARE" && msg.metadata) {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-2`}>
                  <div className="max-w-sm bg-indigo-50 border border-indigo-200 rounded-3xl p-4 shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-indigo-700">Senior Mentorship Offer</span>
                        <p className="text-xs font-bold text-slate-900">{msg.metadata.topic}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Offered by {msg.sender.name} ({msg.sender.currentRole || "Alumni"} at {msg.sender.currentCompany || "Network"})
                    </p>
                    <Link
                      href="/mentorship"
                      className="block text-center py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      Book 1-on-1 Guidance Slot
                    </Link>
                  </div>
                </div>
              );
            }

            // Spotify / Gaana / Apple Music Player Card
            if (msg.type === "STREAMING_SHARE" && msg.metadata) {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-2`}>
                  <div className="max-w-sm bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-300/80 rounded-3xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                          <Music className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{msg.metadata.title}</p>
                          <span className="text-[10px] text-emerald-700 font-semibold">{msg.metadata.artist}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={msg.metadata.embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Play on {msg.metadata.artist}</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>
                </div>
              );
            }

            // Local Music Share
            if (msg.type === "MUSIC_SHARE") {
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-2`}
                >
                  <div className="max-w-sm bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-pink-200 rounded-3xl p-3.5 shadow-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-pink-600 text-white flex items-center justify-center">
                        <Music className="w-4 h-4 animate-spin" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-900">{msg.sender.name}</p>
                        <p className="text-[10px] text-pink-600 font-semibold">Shared a music track</p>
                      </div>
                    </div>
                    <div className="bg-white/80 rounded-2xl p-2.5 border border-pink-100 flex items-center justify-between">
                      <div className="overflow-hidden mr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{msg.metadata?.title || "Music Track"}</p>
                        <p className="text-[10px] text-slate-500">{msg.metadata?.artist || "Audio"}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (msg.metadata?.title) {
                            setCurrentTrackName(msg.metadata.title);
                            setCurrentArtist(msg.metadata.artist || "Audio");
                            togglePlayPause();
                          }
                        }}
                        className="p-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition shrink-0"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1.5`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400 px-1">
                  <span className="font-semibold text-slate-600">{msg.sender.name}</span>
                  {msg.sender.verificationStatus === "VERIFIED" && (
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  )}
                  <span>• Class of {msg.sender.batchYear}</span>
                  <span className="text-[10px] text-slate-400 ml-1">{timeString}</span>
                </div>

                <div
                  className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Quick Action Shortcuts & Input Bar */}
      <footer className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 shadow-xs space-y-2">
        {/* Quick Sharing Shortcuts */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setShowShareJobModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold transition shrink-0"
          >
            <Briefcase className="w-3.5 h-3.5" /> Post Job in Group
          </button>

          <button
            onClick={() => setShowShareMentorshipModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Offer Mentorship
          </button>

          <button
            onClick={() => setShowStreamingModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition shrink-0"
          >
            <Music className="w-3.5 h-3.5" /> Spotify / Gaana Track
          </button>
        </div>

        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Message ${data.group.name}...`}
            className="flex-1 bg-slate-100 focus:bg-white text-xs text-slate-900 rounded-2xl px-4 py-3 border border-transparent focus:border-pink-500 focus:outline-none transition"
          />

          <button
            type="submit"
            disabled={sending || !inputMessage.trim()}
            className="p-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white rounded-2xl transition shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      {/* 1. Add Member Modal */}
      <AnimatePresence>
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Add Alumni to Group</h3>
                    <p className="text-[11px] text-slate-500">From {data.group.institutionName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingCandidates ? (
                  <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Finding alumni...</span>
                  </div>
                ) : candidateUsers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    All matching alumni from this cohort are already in the group!
                  </p>
                ) : (
                  candidateUsers.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                          {candidate.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-900">{candidate.name}</span>
                            {candidate.verificationStatus === "VERIFIED" && (
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Class of {candidate.batchYear} • {candidate.currentRole || "Alumni"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => addMember(candidate.id)}
                        disabled={addingMemberId === candidate.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition"
                      >
                        {addingMemberId === candidate.id ? "Adding..." : "Add"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowAddMemberModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Admin Security & Privacy Settings Modal */}
      <AnimatePresence>
        {showSecurityModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl border border-slate-200 p-6 shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Group Privacy & Security</h3>
                    <p className="text-[11px] text-slate-500">Admin Controls for {data.group.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Secret Conversation Switch */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-700" />
                      <span className="text-xs font-bold text-slate-900">Secret Conversation Mode</span>
                    </div>
                    <button
                      disabled={updatingSecurity}
                      onClick={() =>
                        handleUpdateSecurity({ isSecretMode: !data.group.isSecretMode })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        data.group.isSecretMode ? "bg-amber-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          data.group.isSecretMode ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    When enabled:
                    <br />
                    • <strong>2-Day Auto Vanishing:</strong> Chats older than 48 hours are automatically purged.
                    <br />
                    • <strong>Strict Privacy:</strong> Only members inside the group can view or track this conversation.
                  </p>
                </div>

                {/* Screenshot Permission Switch */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-slate-700" />
                      <span className="text-xs font-bold text-slate-900">Allow Screenshots</span>
                    </div>
                    <button
                      disabled={updatingSecurity}
                      onClick={() =>
                        handleUpdateSecurity({ allowScreenshot: !data.group.allowScreenshot })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        data.group.allowScreenshot ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          data.group.allowScreenshot ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    When <strong>OFF</strong> (default):
                    <br />
                    • Screen capture shortcuts are shielded with blackout overlays.
                    <br />
                    • If any member takes/attempts a screenshot, an audit alert will immediately announce <strong>who took the screenshot</strong> to the entire group.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSecurityModal(false)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Post Job In Group Modal */}
      <AnimatePresence>
        {showShareJobModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Post Job in Group</h3>
                </div>
                <button
                  onClick={() => setShowShareJobModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Role Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Full Stack Developer"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full mt-1 bg-slate-100 text-xs rounded-xl p-2.5 border border-transparent focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Company *</label>
                  <input
                    type="text"
                    placeholder="e.g. Swiggy / Google / TCS"
                    value={jobForm.company}
                    onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })}
                    className="w-full mt-1 bg-slate-100 text-xs rounded-xl p-2.5 border border-transparent focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru / Kolkata / Remote"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full mt-1 bg-slate-100 text-xs rounded-xl p-2.5 border border-transparent focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleShareJob}
                  disabled={!jobForm.title || !jobForm.company}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Broadcast Job to Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Offer Mentorship In Group Modal */}
      <AnimatePresence>
        {showShareMentorshipModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Offer Mentorship in Group</h3>
                </div>
                <button
                  onClick={() => setShowShareMentorshipModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Topic You Can Help With</label>
                  <select
                    value={mentorForm.topic}
                    onChange={(e) => setMentorForm({ ...mentorForm, topic: e.target.value })}
                    className="w-full mt-1 bg-slate-100 text-xs rounded-xl p-2.5 border border-transparent focus:border-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="Resume Review & ATS Optimization">Resume Review & ATS Optimization</option>
                    <option value="Mock Technical Interview & DSA">Mock Technical Interview & DSA</option>
                    <option value="Switching from Service to Product Tech">Switching from Service to Product Tech</option>
                    <option value="Career & Higher Studies Guidance">Career & Higher Studies Guidance</option>
                  </select>
                </div>

                <button
                  onClick={handleShareMentorship}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Post Mentorship in Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Spotify / Gaana / Apple Music Player Modal */}
      <AnimatePresence>
        {showStreamingModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Music className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Music Streaming Player</h3>
                </div>
                <button
                  onClick={() => setShowStreamingModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Choose Music App</label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(["SPOTIFY", "GAANA", "APPLE_MUSIC"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStreamService(s)}
                        className={`py-2 text-[11px] font-bold rounded-xl border transition ${
                          streamService === s
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {s === "SPOTIFY" ? "Spotify" : s === "GAANA" ? "Gaana" : "Apple Music"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Song / Playlist Link</label>
                  <input
                    type="url"
                    placeholder={`Paste ${streamService === "SPOTIFY" ? "open.spotify.com" : streamService === "GAANA" ? "gaana.com" : "music.apple.com"} track link...`}
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    className="w-full mt-1 bg-slate-100 text-xs rounded-xl p-2.5 border border-transparent focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleShareStreamingTrack}
                  disabled={!streamUrl.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Share & Play in Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
