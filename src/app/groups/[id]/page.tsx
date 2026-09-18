"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Music,
  Play,
  Pause,
  Volume2,
  Share2,
  Users,
  ShieldCheck,
  Building,
  GraduationCap,
  RefreshCw,
  FolderOpen,
  Radio,
  Sparkles,
} from "lucide-react";

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
  };
  messages: Message[];
}

// Built-in campus radio & chill ambient tracks
const PRESET_TRACKS = [
  {
    title: "Campus Study Lo-Fi Beats",
    artist: "Alumni Chill Radio",
    src: "https://actions.google.com/sounds/v1/weather/rain_heavy.ogg", // Royalty-free soothing rain ambient
  },
  {
    title: "Late Night Coding Stream",
    artist: "University Tech Society",
    src: "https://actions.google.com/sounds/v1/science_fiction/deep_space_drone.ogg", // Space ambient
  },
  {
    title: "Acoustic Campus Breeze",
    artist: "Brainware Music Jam",
    src: "https://actions.google.com/sounds/v1/weather/gentle_stream.ogg", // Gentle river vibe
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
  const [showMembers, setShowMembers] = useState(false);

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
    return () => {
      ignore = true;
    };
  }, [groupId]);

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
          <p className="text-xs text-slate-500 font-medium">Entering group chat room...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isBatch = data.group.scope === "SAME_BATCH";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen">
      {/* Hidden Mobile Audio File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleDeviceFilePick}
        className="hidden"
      />

      {/* Chat Room Top Nav */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/groups"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-2.5">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                  isBatch
                    ? "bg-gradient-to-tr from-pink-500 to-rose-600"
                    : "bg-gradient-to-tr from-indigo-500 to-purple-600"
                }`}
              >
                {isBatch ? <GraduationCap className="w-4 h-4" /> : <Building className="w-4 h-4" />}
              </div>

              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  {data.group.name}
                </h1>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>{data.group.institutionName}</span>
                  <span>•</span>
                  <button
                    onClick={() => setShowMembers(!showMembers)}
                    className="text-pink-600 hover:underline font-medium"
                  >
                    {data.group.memberCount} members
                  </button>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMusicDock(!showMusicDock)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
                showMusicDock
                  ? "bg-pink-100 text-pink-700 border border-pink-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Music className={`w-3.5 h-3.5 ${isPlaying ? "animate-bounce" : ""}`} />
              <span>{isPlaying ? "Playing..." : "Music Player"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* In-App Mobile & Preset Music Player Bar */}
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
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Device Mobile Audio Picker */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition border border-white/10"
              >
                <FolderOpen className="w-3.5 h-3.5 text-pink-400" />
                <span>Play from Device</span>
              </button>

              {/* Campus Lo-Fi Preset */}
              <button
                onClick={() => playPresetTrack(PRESET_TRACKS[0])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition border border-white/10"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Campus Beats</span>
              </button>

              {/* Share what you're playing to chat */}
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

      {/* Main Chat Stream */}
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
              return (
                <div key={msg.id} className="text-center my-3">
                  <span className="text-[11px] bg-slate-200/80 text-slate-600 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }

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
                </div>

                <div
                  className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Chat Message Input Bar */}
      <footer className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 shadow-xs">
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
            className="p-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white rounded-2xl transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
