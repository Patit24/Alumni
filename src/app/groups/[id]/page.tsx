"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  RefreshCw,
  FolderOpen,
  Radio,
  Sparkles,
  UserPlus,
  Briefcase,
  ExternalLink,
  Plus,
  Lock,
  CameraOff,
  Camera,
  AlertTriangle,
  Sliders,
  CheckCheck,
  Phone,
  Video,
  Search,
  MoreVertical,
  Info,
  X,
  ChevronRight,
  LogOut,
  Sparkle,
  Crown,
  UserMinus,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { setNativeScreenshotAllowed } from "@/lib/native-security";

interface Member {
  id: string;
  name: string;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
  verificationStatus: string;
  role?: string;
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

// WhatsApp Signature Member Colors
const MEMBER_COLORS = [
  "#25d366", // Emerald Green
  "#53bdeb", // Sky Blue
  "#f15c6d", // Coral Pink
  "#e5a65c", // Gold Amber
  "#a983f4", // Purple
  "#34b7f1", // Cyan
  "#ff72d2", // Magenta
  "#20c997", // Teal
  "#fd7e14", // Orange
];

function getSenderColor(senderId: string): string {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MEMBER_COLORS.length;
  return MEMBER_COLORS[index];
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

function getLocalGroupData(groupId: string): GroupData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`alumni_group_data_v2_${groupId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalGroupData(groupId: string, data: GroupData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`alumni_group_data_v2_${groupId}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not cache group data:", e);
  }
}

export default function GroupChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: groupId } = use(params);

  // 0ms Cache-First Data Initialization
  const [data, setData] = useState<GroupData | null>(() => getLocalGroupData(groupId));
  const [loading, setLoading] = useState<boolean>(() => !getLocalGroupData(groupId));
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedMemberAction, setSelectedMemberAction] = useState<Member | null>(null);
  const [isProcessingMemberAction, setIsProcessingMemberAction] = useState(false);

  // Attachment Dock Menu
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // In-Chat Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // WhatsApp Group Info Drawer
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // In-App Ambient Music Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackName, setCurrentTrackName] = useState<string>("Campus Study Lo-Fi Beats");
  const [currentArtist, setCurrentArtist] = useState<string>("Alumni Chill Radio");
  const [audioProgress, setAudioProgress] = useState(0);
  const [showMusicDock, setShowMusicDock] = useState(false);

  // Calling prompt
  const [showCallPrompt, setShowCallPrompt] = useState<"audio" | "video" | null>(null);

  // Modals
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
      const json: GroupData = await res.json();
      setData(json);
      saveLocalGroupData(groupId, json);
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
        const json: GroupData = await res.json();
        if (!ignore) {
          setData(json);
          saveLocalGroupData(groupId, json);
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
          // If this is current user's message that was added optimistically, replace temp message
          const tempMatch = prev.messages.find(
            (m) =>
              m.id.startsWith("temp_") &&
              m.sender.id === newMsg.sender.id &&
              m.content === newMsg.content
          );
          const updatedMessages = tempMatch
            ? prev.messages.map((m) => (m.id === tempMatch.id ? newMsg : m))
            : [...prev.messages, newMsg];
          const updated = {
            ...prev,
            messages: updatedMessages,
          };
          saveLocalGroupData(groupId, updated);
          return updated;
        });
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
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
          const updated = {
            ...prev,
            group: {
              ...prev.group,
              isSecretMode: payload.isSecretMode,
              allowScreenshot: payload.allowScreenshot,
            },
          };
          saveLocalGroupData(groupId, updated);
          return updated;
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
    const { group } = data;

    const reportScreenshotAttempt = async () => {
      try {
        await fetch(`/api/groups/${groupId}/security`, {
          method: "POST",
        });
      } catch (err) {
        console.error("Failed to report screenshot:", err);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrintScreen =
        e.key === "PrintScreen" ||
        e.code === "PrintScreen" ||
        e.key === "Snapshot";
      const isMacScreenshot =
        Boolean(e.metaKey) &&
        Boolean(e.shiftKey) &&
        ["3", "4", "5", "6", "$", "%", "^"].includes(e.key);
      const isWindowsSnip =
        Boolean(e.ctrlKey || e.metaKey) && Boolean(e.shiftKey) && e.key.toLowerCase() === "s";

      if (isPrintScreen || isMacScreenshot || isWindowsSnip) {
        if (!group.allowScreenshot) {
          setIsPrivacyShieldActive(true);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText("Screenshots are protected in this Alumni conversation.").catch(() => {});
          }
          setTimeout(() => setIsPrivacyShieldActive(false), 3000);
        }
        reportScreenshotAttempt();
      }
    };

    const handleVisibilityOrBlur = () => {
      if (!group.allowScreenshot) {
        setIsPrivacyShieldActive(true);
      }
    };

    const handleWindowFocus = () => {
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
      setNativeScreenshotAllowed(false);
    } else {
      document.body.classList.remove("screenshot-blocked");
      setNativeScreenshotAllowed(true);
    }

    return () => {
      document.body.classList.remove("screenshot-blocked");
      setNativeScreenshotAllowed(true);
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
          setShowMusicDock(true);
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
          setShowMusicDock(true);
          setCurrentTrackName(track.title);
          setCurrentArtist(track.artist);
        })
        .catch(console.error);
    }
  }

  function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !data) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setShowAttachMenu(false);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageText,
      type: "TEXT",
      createdAt: new Date().toISOString(),
      sender: {
        id: data.currentUser.id,
        name: data.currentUser.name,
        batchYear: data.group.batchYear || 2026,
        currentRole: null,
        currentCompany: null,
        verificationStatus: "VERIFIED",
      },
    };

    // 1. Instant optimistic update (0ms latency)
    setData((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        messages: [...prev.messages, optimisticMessage],
      };
      saveLocalGroupData(groupId, updated);
      return updated;
    });

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 10);

    // 2. Background async network dispatch
    (async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: messageText,
            type: "TEXT",
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to send");

        if (result.message) {
          setData((prev) => {
            if (!prev) return prev;
            const alreadyInserted = prev.messages.some((m) => m.id === result.message.id);
            const updatedMessages = alreadyInserted
              ? prev.messages.filter((m) => m.id !== tempId)
              : prev.messages.map((m) =>
                  m.id === tempId ? { ...m, ...result.message, id: result.message.id } : m
                );
            const updated = { ...prev, messages: updatedMessages };
            saveLocalGroupData(groupId, updated);
            return updated;
          });
        }
      } catch (err: unknown) {
        console.error("Error sending group message:", err);
      }
    })();
  }

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
        const updated = {
          ...prev,
          group: {
            ...prev.group,
            ...json.group,
          },
        };
        saveLocalGroupData(groupId, updated);
        return updated;
      });
      await fetchRoomData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Security update error");
    } finally {
      setUpdatingSecurity(false);
    }
  }

  async function handleShareStreamingTrack() {
    if (!streamUrl.trim()) return;

    let title = "Shared Track";
    const artist =
      streamService === "SPOTIFY" ? "Spotify Music" : streamService === "GAANA" ? "Gaana.com" : "Apple Music";

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

  async function removeMember(targetUserId: string) {
    if (!data) return;
    try {
      setIsProcessingMemberAction(true);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      if (res.ok) {
        if (targetUserId === data.currentUser.id) {
          router.push("/messages");
        } else {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              group: {
                ...prev.group,
                memberCount: Math.max(0, prev.group.memberCount - 1),
                members: prev.group.members.filter((m) => m.id !== targetUserId),
              },
            };
          });
          setSelectedMemberAction(null);
          await fetchRoomData();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to remove member");
      }
    } catch (err) {
      console.error("Error removing member:", err);
    } finally {
      setIsProcessingMemberAction(false);
    }
  }

  async function toggleAdminRole(targetUserId: string, currentRole?: string) {
    if (!data) return;
    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    try {
      setIsProcessingMemberAction(true);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, role: newRole }),
      });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            group: {
              ...prev.group,
              members: prev.group.members.map((m) =>
                m.id === targetUserId ? { ...m, role: newRole } : m
              ),
            },
          };
        });
        setSelectedMemberAction(null);
        await fetchRoomData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to update member role");
      }
    } catch (err) {
      console.error("Error updating member role:", err);
    } finally {
      setIsProcessingMemberAction(false);
    }
  }

  async function handleExitGroup() {
    if (!confirm("Are you sure you want to leave this group?")) return;
    await removeMember(data?.currentUser.id || "");
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

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-[#202c33] border border-[#2a3942] flex items-center justify-center shadow-lg">
            <RefreshCw className="w-6 h-6 text-[#00a884] animate-spin" />
          </div>
          <p className="text-xs text-[#8696a0] font-medium tracking-wide">Connecting to WhatsApp lounge...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3 bg-[#111b21] p-6 rounded-3xl border border-[#2a3942]">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Group Not Available</h2>
          <p className="text-xs text-[#8696a0]">
            This group could not be found or you are not an authorized member.
          </p>
          <Link
            href="/messages"
            className="inline-block px-4 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold rounded-xl transition"
          >
            Back to Chats
          </Link>
        </div>
      </div>
    );
  }

  // Filter messages if search query is active
  const filteredMessages = searchQuery.trim()
    ? data.messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data.messages;

  return (
    <div
      className={`h-[100dvh] flex flex-col bg-[#0b141a] text-[#e9edef] overflow-hidden select-none ${
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
            className="fixed inset-0 bg-[#0b141a]/98 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 text-center text-white"
          >
            <div className="h-16 w-16 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4 shadow-xl">
              <CameraOff className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold">Screenshot Protection Shield</h2>
            <p className="text-xs text-[#8696a0] mt-2 max-w-sm leading-relaxed">
              Screenshotting is strictly disabled in this group to protect student and alumni conversations.
            </p>
            <button
              onClick={() => setIsPrivacyShieldActive(false)}
              className="mt-6 px-5 py-2.5 bg-[#202c33] hover:bg-[#2a3942] text-xs font-semibold rounded-xl transition border border-[#2a3942]"
            >
              Resume Chat
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
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-rose-500 animate-bounce"
          >
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span>⚠️ {liveScreenshotAlert.culpritName} attempted a screenshot in this room!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Prompt Modal */}
      <AnimatePresence>
        {showCallPrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#202c33] border border-[#2a3942] rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                {showCallPrompt === "video" ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Group {showCallPrompt === "video" ? "Video" : "Voice"} Call
                </h3>
                <p className="text-xs text-[#8696a0] mt-1">
                  Start an encrypted group call with {data.group.memberCount} members of &ldquo;{data.group.name}&rdquo;?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCallPrompt(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#111b21] text-xs font-bold text-[#8696a0] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCallPrompt(null);
                    alert("Group Calling feature is connecting with active members...");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-xs font-bold text-white transition shadow-md"
                >
                  Start Call
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── WhatsApp Header ── */}
      <header className="bg-[#202c33] border-b border-[#2a3942] sticky top-0 z-30 px-3 sm:px-4 py-2.5 shadow-md flex items-center justify-between gap-2 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Back button */}
          <Link
            href="/messages"
            className="p-1.5 -ml-1 text-[#aebac1] hover:text-white rounded-full hover:bg-white/5 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Group Avatar & Clickable Subject */}
          <div
            onClick={() => setShowGroupInfo(true)}
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 group"
          >
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#FF9933] via-[#00a884] to-[#128C7E] p-[1.5px] shadow-sm">
                <div className="h-full w-full rounded-full bg-[#111b21] flex items-center justify-center text-white font-bold text-sm">
                  {data.group.name.charAt(0).toUpperCase()}
                </div>
              </div>
              {data.group.isSecretMode && (
                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xs">
                  <Lock className="w-2.5 h-2.5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-white truncate group-hover:text-[#00a884] transition">
                  {data.group.name}
                </h1>
                {data.group.scope === "SAME_BATCH" && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    &apos;{String(data.group.batchYear).slice(-2)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8696a0] truncate mt-0.5 flex items-center gap-1">
                <span>{data.group.memberCount} members</span>
                <span>•</span>
                <span className="truncate">tap here for group info</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Icons: Video, Voice, Search, Menu */}
        <div className="flex items-center gap-1 shrink-0 text-[#aebac1]">
          <button
            onClick={() => setShowCallPrompt("video")}
            className="p-2 hover:text-white hover:bg-white/5 rounded-full transition"
            title="Group Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCallPrompt("audio")}
            className="p-2 hover:text-white hover:bg-white/5 rounded-full transition"
            title="Group Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition ${
              showSearch ? "text-[#00a884] bg-white/10" : "hover:text-white hover:bg-white/5"
            }`}
            title="Search in chat"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMusicDock(!showMusicDock)}
            className={`p-2 rounded-full transition ${
              showMusicDock ? "text-pink-400 bg-white/10" : "hover:text-white hover:bg-white/5"
            }`}
            title="Campus Beats Radio"
          >
            <Music className={`w-4 h-4 ${isPlaying ? "animate-bounce text-pink-400" : ""}`} />
          </button>
          <button
            onClick={() => setShowGroupInfo(true)}
            className="p-2 hover:text-white hover:bg-white/5 rounded-full transition"
            title="Group Info"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#111b21] border-b border-[#2a3942] px-4 py-2 shrink-0 flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Search conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent flex-1 text-xs text-white focus:outline-none placeholder:text-[#8696a0]"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[#8696a0] hover:text-white text-xs">
                ✕
              </button>
            )}
            <button onClick={() => setShowSearch(false)} className="text-xs text-[#00a884] font-semibold">
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Ambient Campus Beats Radio Dock */}
      <AnimatePresence>
        {showMusicDock && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#111b21]/95 border-b border-[#2a3942] px-4 py-2.5 shrink-0 z-20 backdrop-blur-md shadow-md"
          >
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={togglePlayPause}
                  className="h-8 w-8 rounded-full bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shrink-0 shadow-md transition"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                    {currentTrackName}
                  </p>
                  <p className="text-[10px] text-pink-400 font-medium truncate">{currentArtist}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => playPresetTrack(PRESET_TRACKS[0])}
                  className="px-2.5 py-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[11px] font-semibold text-white transition border border-[#2a3942]"
                >
                  Study Lo-Fi
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[11px] font-semibold text-white transition border border-[#2a3942]"
                >
                  Pick Audio
                </button>
                <button
                  onClick={handleShareCurrentTrackToChat}
                  className="p-1.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition"
                  title="Share track to chat"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowMusicDock(false)}
                  className="p-1.5 text-[#8696a0] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="max-w-4xl mx-auto w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${audioProgress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WhatsApp Chat Wallpaper & Stream ── */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 max-w-4xl w-full mx-auto space-y-2 relative">
        {/* Subtle WhatsApp dark wallpaper pattern overlay */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage: "radial-gradient(#202c33 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Secret Mode Notice Pill */}
        {data.group.isSecretMode && (
          <div className="text-center my-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#182229]/95 text-amber-300 text-[11px] font-semibold border border-amber-500/20 shadow-sm">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Secret Conversation: Messages vanish after 48h · Screen capture protected</span>
            </span>
          </div>
        )}

        {filteredMessages.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-[#8696a0] space-y-3">
            <div className="h-16 w-16 rounded-3xl bg-[#202c33] border border-[#2a3942] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#00a884]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Welcome to {data.group.name}</p>
              <p className="text-xs text-[#8696a0] mt-1 max-w-xs">
                Send the first message, share job referrals, or play campus music with your alumni group!
              </p>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.sender.id === data.currentUser.id;

            // System Message
            if (msg.type === "SYSTEM") {
              const isAlert = msg.content.includes("SCREENSHOT ALERT");
              return (
                <div key={msg.id} className="text-center my-3">
                  <span
                    className={`inline-block text-[11px] px-3.5 py-1 rounded-lg font-medium shadow-xs ${
                      isAlert
                        ? "bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold"
                        : "bg-[#182229]/90 text-[#8696a0] border border-white/5"
                    }`}
                  >
                    {msg.content}
                  </span>
                </div>
              );
            }

            // Job Share Attachment Card
            if (msg.type === "JOB_SHARE" && msg.metadata) {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1.5`}>
                  <div
                    className={`max-w-sm rounded-2xl p-3.5 shadow-md border ${
                      isMe
                        ? "bg-[#005c4b] text-white border-emerald-600/40 rounded-tr-xs"
                        : "bg-[#202c33] text-white border-purple-500/30 rounded-tl-xs"
                    }`}
                  >
                    {!isMe && (
                      <p
                        className="text-xs font-bold mb-1.5 flex items-center gap-1"
                        style={{ color: getSenderColor(msg.sender.id) }}
                      >
                        {msg.sender.name}
                        {msg.sender.verificationStatus === "VERIFIED" && (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        )}
                      </p>
                    )}
                    <div className="bg-[#111b21]/70 rounded-xl p-3 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wide">
                            Internal Referral
                          </span>
                          <p className="text-xs font-bold text-white truncate">{msg.metadata.jobTitle}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8696a0]">
                        {msg.metadata.company} • {msg.metadata.location}
                      </p>
                      <Link
                        href="/jobs"
                        className="block text-center py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition"
                      >
                        View & Apply on Jobs Board
                      </Link>
                    </div>
                    <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-white/50">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              );
            }

            // Mentorship Share Attachment Card
            if (msg.type === "MENTORSHIP_SHARE" && msg.metadata) {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1.5`}>
                  <div
                    className={`max-w-sm rounded-2xl p-3.5 shadow-md border ${
                      isMe
                        ? "bg-[#005c4b] text-white border-emerald-600/40 rounded-tr-xs"
                        : "bg-[#202c33] text-white border-indigo-500/30 rounded-tl-xs"
                    }`}
                  >
                    {!isMe && (
                      <p
                        className="text-xs font-bold mb-1.5 flex items-center gap-1"
                        style={{ color: getSenderColor(msg.sender.id) }}
                      >
                        {msg.sender.name}
                        {msg.sender.verificationStatus === "VERIFIED" && (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        )}
                      </p>
                    )}
                    <div className="bg-[#111b21]/70 rounded-xl p-3 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wide">
                            Mentorship Slot
                          </span>
                          <p className="text-xs font-bold text-white truncate">{msg.metadata.topic}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8696a0]">
                        Offered by {msg.sender.name} ({msg.sender.currentRole || "Alumni"})
                      </p>
                      <Link
                        href="/mentorship"
                        className="block text-center py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                      >
                        Book 1-on-1 Session
                      </Link>
                    </div>
                    <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-white/50">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              );
            }

            // Spotify / Gaana / Streaming Card
            if (msg.type === "STREAMING_SHARE" && msg.metadata) {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1.5`}>
                  <div
                    className={`max-w-sm rounded-2xl p-3.5 shadow-md border ${
                      isMe
                        ? "bg-[#005c4b] text-white border-emerald-600/40 rounded-tr-xs"
                        : "bg-[#202c33] text-white border-emerald-500/30 rounded-tl-xs"
                    }`}
                  >
                    {!isMe && (
                      <p
                        className="text-xs font-bold mb-1.5 flex items-center gap-1"
                        style={{ color: getSenderColor(msg.sender.id) }}
                      >
                        {msg.sender.name}
                      </p>
                    )}
                    <div className="bg-[#111b21]/70 rounded-xl p-3 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{msg.metadata.title}</p>
                          <span className="text-[10px] text-emerald-400 font-semibold">{msg.metadata.artist}</span>
                        </div>
                      </div>
                      <a
                        href={msg.metadata.embedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Play on {msg.metadata.artist}</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                    <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-white/50">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              );
            }

            // In-Chat Music Audio Player Card
            if (msg.type === "MUSIC_SHARE") {
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1.5`}>
                  <div
                    className={`max-w-sm rounded-2xl p-3.5 shadow-md border ${
                      isMe
                        ? "bg-[#005c4b] text-white border-emerald-600/40 rounded-tr-xs"
                        : "bg-[#202c33] text-white border-pink-500/30 rounded-tl-xs"
                    }`}
                  >
                    {!isMe && (
                      <p
                        className="text-xs font-bold mb-1.5 flex items-center gap-1"
                        style={{ color: getSenderColor(msg.sender.id) }}
                      >
                        {msg.sender.name}
                      </p>
                    )}
                    <div className="bg-[#111b21]/70 rounded-xl p-2.5 border border-white/10 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{msg.metadata?.title || "Audio Track"}</p>
                        <p className="text-[10px] text-pink-400 truncate">{msg.metadata?.artist || "Campus Radio"}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (msg.metadata?.title) {
                            setCurrentTrackName(msg.metadata.title);
                            setCurrentArtist(msg.metadata.artist || "Audio");
                            setShowMusicDock(true);
                            togglePlayPause();
                          }
                        }}
                        className="h-8 w-8 rounded-full bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shrink-0 transition"
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>
                    <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-white/50">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              );
            }

            const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            // Standard WhatsApp Chat Bubble
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-md px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm relative ${
                    isMe
                      ? "bg-[#005c4b] text-[#e9edef] rounded-tr-xs"
                      : "bg-[#202c33] text-[#e9edef] border border-white/5 rounded-tl-xs"
                  }`}
                >
                  {/* Sender Name in distinct WhatsApp Color for incoming messages */}
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-xs font-bold"
                        style={{ color: getSenderColor(msg.sender.id) }}
                      >
                        {msg.sender.name}
                      </span>
                      {msg.sender.verificationStatus === "VERIFIED" && (
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      )}
                      <span className="text-[10px] text-[#8696a0]">
                        &apos;{String(msg.sender.batchYear).slice(-2)}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>

                  {/* Timestamp & WhatsApp Status Checkmarks */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0] select-none float-right ml-3">
                    <span className={isMe ? "text-white/60" : "text-[#8696a0]"}>{timeString}</span>
                    {isMe && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* ── WhatsApp Floating Attachment Popup Tray ── */}
      <AnimatePresence>
        {showAttachMenu && (
          <div
            onClick={() => setShowAttachMenu(false)}
            className="fixed inset-0 z-30 bg-black/20"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-20 left-4 sm:left-auto bg-[#202c33] border border-[#2a3942] rounded-3xl p-3 shadow-2xl flex flex-col gap-2 z-40 max-w-xs"
            >
              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowShareJobModal(true);
                }}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#2a3942] transition text-left text-xs text-white"
              >
                <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white">Job Referral</p>
                  <p className="text-[10px] text-[#8696a0]">Post opportunity for group</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowShareMentorshipModal(true);
                }}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#2a3942] transition text-left text-xs text-white"
              >
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white">Mentorship Offer</p>
                  <p className="text-[10px] text-[#8696a0]">Help juniors or batchmates</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowStreamingModal(true);
                }}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#2a3942] transition text-left text-xs text-white"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white">Spotify / Gaana Track</p>
                  <p className="text-[10px] text-[#8696a0]">Share playlist or music</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#2a3942] transition text-left text-xs text-white"
              >
                <div className="h-10 w-10 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white">Audio File</p>
                  <p className="text-[10px] text-[#8696a0]">Upload music from device</p>
                </div>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── WhatsApp Bottom Input Bar ── */}
      <footer className="bg-[#202c33] border-t border-[#2a3942] p-2.5 sm:p-3 shrink-0 z-20 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          {/* Attachment Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`h-10 w-10 rounded-full flex items-center justify-center transition shrink-0 ${
              showAttachMenu ? "bg-[#00a884] text-white rotate-45" : "text-[#8696a0] hover:text-white hover:bg-[#2a3942]"
            }`}
            title="Attach referral or music"
          >
            <Plus className="w-5 h-5 transition-transform" />
          </button>

          {/* WhatsApp Text Input Pill */}
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Message ${data.group.name}...`}
            className="flex-1 bg-[#2a3942] text-sm text-[#e9edef] placeholder:text-[#8696a0] rounded-2xl px-4 py-2.5 border border-transparent focus:border-[#00a884] focus:outline-none transition"
          />

          {/* WhatsApp Green Send Button */}
          <button
            type="submit"
            disabled={sending || !inputMessage.trim()}
            className="h-10 w-10 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white rounded-full flex items-center justify-center transition shadow-md shrink-0 active:scale-95"
            title="Send Message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </footer>

      {/* ── WhatsApp Group Info Drawer (Right Slide-Over) ── */}
      <AnimatePresence>
        {showGroupInfo && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="bg-[#111b21] w-full max-w-md h-full flex flex-col border-l border-[#2a3942] shadow-2xl overflow-y-auto"
            >
              {/* Drawer Top Header */}
              <div className="bg-[#202c33] border-b border-[#2a3942] px-4 py-3 flex items-center gap-3 sticky top-0 z-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button
                  onClick={() => setShowGroupInfo(false)}
                  className="p-1.5 text-[#8696a0] hover:text-white rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-base font-bold text-white">Group Info</h2>
              </div>

              {/* Group Profile Cover */}
              <div className="bg-[#111b21] p-6 text-center border-b border-[#2a3942] space-y-3">
                <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-tr from-[#FF9933] via-[#00a884] to-[#128C7E] p-1 shadow-xl">
                  <div className="h-full w-full rounded-full bg-[#202c33] flex items-center justify-center text-3xl font-black text-white">
                    {data.group.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">{data.group.name}</h3>
                  <p className="text-xs text-[#8696a0] mt-0.5">{data.group.institutionName}</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#202c33] text-[#00a884] border border-[#2a3942]">
                    {data.group.scope === "SAME_BATCH" ? `Class of ${data.group.batchYear}` : "University Wide"}
                  </span>
                  {data.group.isSecretMode && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Secret Mode
                    </span>
                  )}
                </div>
              </div>

              {/* Group Description */}
              <div className="p-4 bg-[#111b21] border-b border-[#2a3942] space-y-1">
                <p className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">Description</p>
                <p className="text-xs text-white leading-relaxed">
                  {data.group.description || "Official alumni group on Samparka. Connect, share jobs, and network with peers."}
                </p>
              </div>

              {/* Security & Admin Controls */}
              <div className="p-4 bg-[#111b21] border-b border-[#2a3942] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">Privacy & Security</span>
                  {data.currentUser.isAdmin && (
                    <button
                      onClick={() => setShowSecurityModal(true)}
                      className="text-xs text-[#00a884] font-bold hover:underline"
                    >
                      Configure
                    </button>
                  )}
                </div>
                <div className="bg-[#202c33] p-3 rounded-2xl border border-[#2a3942] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" /> Secret Mode (48h vanish)
                    </span>
                    <span className="font-bold text-amber-400">{data.group.isSecretMode ? "ON" : "OFF"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-rose-400" /> Screenshot Capture
                    </span>
                    <span className="font-bold text-rose-400">{data.group.allowScreenshot ? "Allowed" : "Blocked"}</span>
                  </div>
                </div>
              </div>

              {/* Participants Section */}
              <div className="p-4 bg-[#111b21] flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">
                    {data.group.memberCount} Participants
                  </span>
                  <button
                    onClick={openAddMember}
                    className="inline-flex items-center gap-1.5 text-xs text-[#00a884] font-bold hover:underline"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Alumni</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {data.group.members.map((member) => {
                    const isSelf = member.id === data.currentUser.id;
                    const isMemberAdmin = member.role === "ADMIN" || member.id === data.group.createdById;
                    const canManage = data.currentUser.isAdmin && !isSelf && member.id !== data.group.createdById;

                    return (
                      <div
                        key={member.id}
                        className="p-2.5 rounded-2xl bg-[#202c33] border border-[#2a3942] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-[#111b21] border border-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-white truncate">
                                {member.name} {isSelf && <span className="text-[#8696a0] font-normal">(You)</span>}
                              </span>
                              {member.verificationStatus === "VERIFIED" && (
                                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-[#8696a0] truncate">
                              Class of {member.batchYear} • {member.currentRole || "Alumnus"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isMemberAdmin && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30 shrink-0">
                              Group Admin
                            </span>
                          )}

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setSelectedMemberAction(member)}
                              className="p-1.5 rounded-lg text-[#8696a0] hover:text-white hover:bg-white/5 transition"
                              title="Member Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exit Group Button */}
              <div className="p-4 bg-[#111b21] border-t border-[#2a3942]">
                <button
                  type="button"
                  onClick={handleExitGroup}
                  disabled={isProcessingMemberAction}
                  className="w-full py-2.5 rounded-xl bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 flex items-center justify-center gap-2 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Group</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Member Admin Actions ── */}
      <AnimatePresence>
        {selectedMemberAction && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="bg-[#202c33] w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-[#2a3942] p-5 shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#2a3942]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#111b21] border border-white/10 flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {selectedMemberAction.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{selectedMemberAction.name}</h3>
                    <p className="text-[11px] text-[#8696a0] truncate">
                      {selectedMemberAction.role === "ADMIN" ? "Group Admin" : "Member"} • Class of {selectedMemberAction.batchYear}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberAction(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-[#8696a0] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {/* Promote / Demote Admin */}
                <button
                  type="button"
                  onClick={() => toggleAdminRole(selectedMemberAction.id, selectedMemberAction.role)}
                  disabled={isProcessingMemberAction}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#111b21] hover:bg-[#2a3942] border border-[#2a3942] text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-[#00a884]" />
                  <span>
                    {selectedMemberAction.role === "ADMIN"
                      ? "Dismiss as Admin"
                      : "Make Group Admin"}
                  </span>
                </button>

                {/* Remove from group */}
                <button
                  type="button"
                  onClick={() => removeMember(selectedMemberAction.id)}
                  disabled={isProcessingMemberAction}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/30 text-xs font-semibold text-rose-400 transition disabled:opacity-50 cursor-pointer"
                >
                  <UserMinus className="w-4 h-4 text-rose-400" />
                  <span>Remove from Group</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMemberAction(null)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#8696a0] hover:text-white font-medium transition cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 1: Add Member Modal ── */}
      <AnimatePresence>
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202c33] w-full max-w-md rounded-3xl border border-[#2a3942] p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Add Alumni to Group</h3>
                    <p className="text-[11px] text-[#8696a0]">From {data.group.institutionName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-xs font-bold text-[#8696a0] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingCandidates ? (
                  <div className="py-8 text-center text-[#8696a0] text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#00a884]" />
                    <span>Finding alumni...</span>
                  </div>
                ) : candidateUsers.length === 0 ? (
                  <p className="text-xs text-[#8696a0] text-center py-8">
                    All matching alumni from this cohort are already in the group!
                  </p>
                ) : (
                  candidateUsers.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="p-3 bg-[#111b21] rounded-2xl border border-[#2a3942] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-[#202c33] text-white flex items-center justify-center text-xs font-bold">
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-white">{candidate.name}</span>
                            {candidate.verificationStatus === "VERIFIED" && (
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#8696a0]">
                            Class of {candidate.batchYear} • {candidate.currentRole || "Alumni"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => addMember(candidate.id)}
                        disabled={addingMemberId === candidate.id}
                        className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition"
                      >
                        {addingMemberId === candidate.id ? "Adding..." : "Add"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowAddMemberModal(false)}
                className="w-full py-2 bg-[#111b21] hover:bg-[#2a3942] text-[#8696a0] hover:text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 2: Admin Security & Privacy Settings Modal ── */}
      <AnimatePresence>
        {showSecurityModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202c33] w-full max-w-md rounded-3xl border border-[#2a3942] p-6 shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Group Privacy & Security</h3>
                    <p className="text-[11px] text-[#8696a0]">Admin Controls for {data.group.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="text-xs font-bold text-[#8696a0] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Secret Conversation Switch */}
                <div className="p-3.5 rounded-2xl bg-[#111b21] border border-[#2a3942] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Secret Conversation Mode</span>
                    </div>
                    <button
                      disabled={updatingSecurity}
                      onClick={() =>
                        handleUpdateSecurity({ isSecretMode: !data.group.isSecretMode })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        data.group.isSecretMode ? "bg-amber-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          data.group.isSecretMode ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8696a0] leading-relaxed">
                    When enabled, older messages vanish after 48 hours to protect confidential discussions.
                  </p>
                </div>

                {/* Screenshot Permission Switch */}
                <div className="p-3.5 rounded-2xl bg-[#111b21] border border-[#2a3942] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">Allow Screenshots</span>
                    </div>
                    <button
                      disabled={updatingSecurity}
                      onClick={() =>
                        handleUpdateSecurity({ allowScreenshot: !data.group.allowScreenshot })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        data.group.allowScreenshot ? "bg-[#00a884]" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          data.group.allowScreenshot ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8696a0] leading-relaxed">
                    When OFF, screenshots are blocked and attempts announce who took a screenshot to the group.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSecurityModal(false)}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold rounded-xl transition shadow-md"
              >
                Save Settings
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 3: Post Job In Group Modal ── */}
      <AnimatePresence>
        {showShareJobModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202c33] w-full max-w-sm rounded-3xl border border-[#2a3942] p-5 shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Post Job in Group</h3>
                </div>
                <button
                  onClick={() => setShowShareJobModal(false)}
                  className="text-xs font-bold text-[#8696a0] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#8696a0]">Role Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Full Stack Developer"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full mt-1 bg-[#111b21] text-xs text-white rounded-xl p-2.5 border border-[#2a3942] focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8696a0]">Company *</label>
                  <input
                    type="text"
                    placeholder="e.g. Swiggy / Google / TCS"
                    value={jobForm.company}
                    onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })}
                    className="w-full mt-1 bg-[#111b21] text-xs text-white rounded-xl p-2.5 border border-[#2a3942] focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8696a0]">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru / Kolkata / Remote"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full mt-1 bg-[#111b21] text-xs text-white rounded-xl p-2.5 border border-[#2a3942] focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleShareJob}
                  disabled={!jobForm.title || !jobForm.company}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-md"
                >
                  Broadcast Job to Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 4: Offer Mentorship In Group Modal ── */}
      <AnimatePresence>
        {showShareMentorshipModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202c33] w-full max-w-sm rounded-3xl border border-[#2a3942] p-5 shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Offer Mentorship in Group</h3>
                </div>
                <button
                  onClick={() => setShowShareMentorshipModal(false)}
                  className="text-xs font-bold text-[#8696a0] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#8696a0]">Topic You Can Help With</label>
                  <select
                    value={mentorForm.topic}
                    onChange={(e) => setMentorForm({ ...mentorForm, topic: e.target.value })}
                    className="w-full mt-1 bg-[#111b21] text-xs text-white rounded-xl p-2.5 border border-[#2a3942] focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Resume Review & ATS Optimization">Resume Review & ATS Optimization</option>
                    <option value="Mock Technical Interview & DSA">Mock Technical Interview & DSA</option>
                    <option value="Switching from Service to Product Tech">Switching from Service to Product Tech</option>
                    <option value="Career & Higher Studies Guidance">Career & Higher Studies Guidance</option>
                  </select>
                </div>

                <button
                  onClick={handleShareMentorship}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
                >
                  Post Mentorship in Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 5: Spotify / Gaana / Apple Music Player Modal ── */}
      <AnimatePresence>
        {showStreamingModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202c33] w-full max-w-sm rounded-3xl border border-[#2a3942] p-5 shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                    <Music className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Music Streaming Player</h3>
                </div>
                <button
                  onClick={() => setShowStreamingModal(false)}
                  className="text-xs font-bold text-[#8696a0] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#8696a0]">Choose Music App</label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(["SPOTIFY", "GAANA", "APPLE_MUSIC"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStreamService(s)}
                        className={`py-2 text-[11px] font-bold rounded-xl border transition ${
                          streamService === s
                            ? "bg-[#00a884] text-white border-[#00a884]"
                            : "bg-[#111b21] text-[#8696a0] border-[#2a3942] hover:text-white"
                        }`}
                      >
                        {s === "SPOTIFY" ? "Spotify" : s === "GAANA" ? "Gaana" : "Apple Music"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8696a0]">Song / Playlist Link</label>
                  <input
                    type="url"
                    placeholder={`Paste ${streamService === "SPOTIFY" ? "open.spotify.com" : streamService === "GAANA" ? "gaana.com" : "music.apple.com"} track link...`}
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    className="w-full mt-1 bg-[#111b21] text-xs text-white rounded-xl p-2.5 border border-[#2a3942] focus:border-[#00a884] focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleShareStreamingTrack}
                  disabled={!streamUrl.trim()}
                  className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-md"
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
