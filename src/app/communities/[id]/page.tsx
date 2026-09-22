"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Settings, 
  Share2, 
  Users, 
  MessageSquare, 
  Megaphone, 
  Calendar, 
  BarChart2, 
  FileText, 
  PhoneCall, 
  Plus, 
  Lock, 
  Globe, 
  QrCode, 
  ChevronRight,
  ShieldCheck,
  Check,
  Clock,
  Pin,
  MapPin,
  ExternalLink,
  Vote,
  Sparkles
} from "lucide-react";
import { typeBadges } from "@/components/communities/CommunityCard";

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params?.id as string;

  const [community, setCommunity] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("channels");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals / Actions
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newChannelModalOpen, setNewChannelModalOpen] = useState(false);
  const [newAnnouncementModalOpen, setNewAnnouncementModalOpen] = useState(false);
  const [newEventModalOpen, setNewEventModalOpen] = useState(false);
  const [newPollModalOpen, setNewPollModalOpen] = useState(false);

  // Invite state
  const [inviteLink, setInviteLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Form states
  const [channelName, setChannelName] = useState("");
  const [channelTopic, setChannelTopic] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  useEffect(() => {
    if (communityId) {
      loadCommunityDetails();
    }
  }, [communityId]);

  const loadCommunityDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch community & permissions
      const res = await fetch(`/api/communities/${communityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load community");

      setCommunity(data);

      // 2. Fetch sub-modules concurrently if joined
      if (data.isMember) {
        const [chRes, annRes, evRes, plRes, mbRes] = await Promise.all([
          fetch(`/api/communities/${communityId}/channels`),
          fetch(`/api/communities/${communityId}/announcements`),
          fetch(`/api/communities/${communityId}/events`),
          fetch(`/api/communities/${communityId}/polls`),
          fetch(`/api/communities/${communityId}/members`),
        ]);

        if (chRes.ok) {
          const chData = await chRes.json();
          setChannels(chData.channels || []);
        }
        if (annRes.ok) {
          const annData = await annRes.json();
          setAnnouncements(annData.announcements || []);
        }
        if (evRes.ok) {
          const evData = await evRes.json();
          setEvents(evData.events || []);
        }
        if (plRes.ok) {
          const plData = await plRes.json();
          setPolls(plData.polls || []);
        }
        if (mbRes.ok) {
          const mbData = await mbRes.json();
          setMembers(mbData.members || []);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      const res = await fetch("/api/communities/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      loadCommunityDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const createInvite = async () => {
    try {
      const res = await fetch(`/api/communities/${communityId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses: 100 }),
      });
      const data = await res.json();
      if (data.inviteUrl) {
        setInviteLink(data.inviteUrl);
        setInviteModalOpen(true);
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate invite");
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    try {
      const res = await fetch(`/api/communities/${communityId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: channelName.trim().toLowerCase().replace(/\s+/g, "-"),
          topic: channelTopic.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create channel");
      setChannels([...channels, data.channel]);
      setChannelName("");
      setChannelTopic("");
      setNewChannelModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    try {
      const res = await fetch(`/api/communities/${communityId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          isPinned: announcementPinned,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post announcement");
      setAnnouncements([data.announcement, ...announcements]);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementPinned(false);
      setNewAnnouncementModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;

    try {
      const res = await fetch(`/api/communities/${communityId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle.trim(),
          startDate: new Date(eventDate).toISOString(),
          location: eventLocation.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      setEvents([...events, data.event]);
      setEventTitle("");
      setEventDate("");
      setEventLocation("");
      setNewEventModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = pollOptions.filter((o) => o.trim().length > 0);
    if (!pollQuestion.trim() || validOptions.length < 2) {
      alert("Please provide a question and at least 2 options.");
      return;
    }

    try {
      const res = await fetch(`/api/communities/${communityId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: pollQuestion.trim(),
          options: validOptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create poll");
      setPolls([data.poll, ...polls]);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setNewPollModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/communities/${communityId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", pollId, optionId }),
      });
      if (res.ok) {
        // Refresh polls
        const plRes = await fetch(`/api/communities/${communityId}/polls`);
        if (plRes.ok) {
          const plData = await plRes.json();
          setPolls(plData.polls || []);
        }
      }
    } catch (err: any) {
      console.error("Voting error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center">
        <div className="h-7 w-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4">
        <p className="text-red-400 text-sm mb-4">{error || "Community not found"}</p>
        <Link
          href="/communities"
          className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold"
        >
          Back to Hub
        </Link>
      </div>
    );
  }

  const { community: comm, isMember, member, permissions } = community;
  const badge = typeBadges[comm.type] || typeBadges.CUSTOM;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col pb-24">
      {/* Cover Header */}
      <div className="relative h-44 sm:h-60 w-full overflow-hidden bg-zinc-900 border-b border-white/10">
        {comm.coverUrl ? (
          <img
            src={comm.coverUrl}
            alt={comm.name}
            className="h-full w-full object-cover opacity-60"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-cyan-950/30 via-zinc-900 to-blue-950/30" />
        )}

        {/* Top bar over cover */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <Link
            href="/communities"
            className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2">
            {isMember && (
              <>
                <button
                  onClick={createInvite}
                  className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80 transition-all flex items-center gap-1.5 text-xs font-medium"
                >
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Invite</span>
                </button>

                {(permissions.isOwner || permissions.manageSettings) && (
                  <Link
                    href={`/communities/${communityId}/settings`}
                    className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80 transition-all"
                  >
                    <Settings className="w-4 h-4 text-zinc-300" />
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile Bar / Info */}
      <div className="max-w-5xl w-full mx-auto px-4 -mt-12 sm:-mt-16 z-20 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-3.5">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-4 border-black bg-zinc-800 shadow-2xl overflow-hidden flex items-center justify-center font-bold text-2xl text-white">
              {comm.avatarUrl ? (
                <img src={comm.avatarUrl} alt={comm.name} className="h-full w-full object-cover" />
              ) : (
                <span className="bg-gradient-to-tr from-cyan-500 to-blue-600 w-full h-full flex items-center justify-center">
                  {comm.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="mb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {comm.name}
                </h1>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                <span>{comm._count?.members || 1} members</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {comm.isPrivate ? <Lock className="w-3 h-3 text-amber-400" /> : <Globe className="w-3 h-3 text-emerald-400" />}
                  {comm.isPrivate ? "Private" : "Public"}
                </span>
              </p>
            </div>
          </div>

          {/* Join / Status Action */}
          <div>
            {!isMember ? (
              <button
                onClick={handleJoin}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20"
              >
                Join Community
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-medium text-cyan-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{member?.role?.name || "Member"}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {comm.description && (
          <p className="mt-4 text-xs text-zinc-300 max-w-2xl leading-relaxed">
            {comm.description}
          </p>
        )}

        {/* Modules Navigation Tabs */}
        {isMember ? (
          <div className="mt-6 border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: "channels", label: "Channels", icon: MessageSquare, count: channels.length },
              { id: "announcements", label: "Announcements", icon: Megaphone, count: announcements.length },
              { id: "events", label: "Events", icon: Calendar, count: events.length },
              { id: "polls", label: "Polls", icon: BarChart2, count: polls.length },
              { id: "members", label: "Members", icon: Users, count: members.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                    isActive
                      ? "border-cyan-400 text-cyan-400"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-zinc-300">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 p-8 rounded-2xl bg-zinc-900/60 border border-white/10 text-center max-w-md mx-auto">
            <Lock className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
            <h3 className="font-semibold text-sm text-white">Member Access Required</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Join this community to access encrypted channels, announcements, events, and voice rooms.
            </p>
            <button
              onClick={handleJoin}
              className="mt-4 px-6 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all"
            >
              Join Now
            </button>
          </div>
        )}

        {/* Tab Content Display */}
        {isMember && (
          <div className="mt-6">
            {/* 1. CHANNELS TAB */}
            {activeTab === "channels" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Communication Channels
                  </h3>
                  {permissions.manageChannels && (
                    <button
                      onClick={() => setNewChannelModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Channel</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {channels.map((channel) => (
                    <Link
                      key={channel.id}
                      href={`/communities/${communityId}/channels/${channel.id}`}
                      className="group flex items-center justify-between p-4 rounded-xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-cyan-500/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white/5 text-zinc-400 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">
                            #{channel.name}
                          </span>
                          {channel.topic && (
                            <p className="text-xs text-zinc-400 line-clamp-1">{channel.topic}</p>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 2. ANNOUNCEMENTS TAB */}
            {activeTab === "announcements" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Official Broadcasts
                  </h3>
                  {permissions.postAnnouncement && (
                    <button
                      onClick={() => setNewAnnouncementModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post Announcement</span>
                    </button>
                  )}
                </div>

                {announcements.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-500">
                    No announcements published yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-5 rounded-2xl border border-white/10 bg-zinc-900/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {ann.isPinned && (
                              <span className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Pin className="w-3 h-3" />
                              </span>
                            )}
                            <h4 className="font-semibold text-sm text-white">{ann.title}</h4>
                          </div>
                          <span className="text-[11px] text-zinc-500">
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {ann.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. EVENTS TAB */}
            {activeTab === "events" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Schedule & Events
                  </h3>
                  {permissions.manageEvents && (
                    <button
                      onClick={() => setNewEventModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Event</span>
                    </button>
                  )}
                </div>

                {events.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-500">
                    No upcoming events on the calendar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-xl border border-white/10 bg-zinc-900/50 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-cyan-400 text-xs font-medium mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{new Date(ev.startDate).toLocaleString()}</span>
                          </div>
                          <h4 className="font-semibold text-sm text-white">{ev.title}</h4>
                          {ev.location && (
                            <p className="mt-1 text-xs text-zinc-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-zinc-500" />
                              <span>{ev.location}</span>
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            {ev.rsvps?.length || 0} Attending
                          </span>
                          <button
                            onClick={async () => {
                              await fetch(`/api/communities/${communityId}/events`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "rsvp", eventId: ev.id, status: "GOING" }),
                              });
                              loadCommunityDetails();
                            }}
                            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-cyan-500 hover:text-black font-semibold text-zinc-200 transition-all text-[11px]"
                          >
                            RSVP Going
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. POLLS TAB */}
            {activeTab === "polls" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Community Polls
                  </h3>
                  {permissions.createPolls && (
                    <button
                      onClick={() => setNewPollModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Poll</span>
                    </button>
                  )}
                </div>

                {polls.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-500">
                    No active polls.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {polls.map((poll) => (
                      <div
                        key={poll.id}
                        className="p-5 rounded-2xl border border-white/10 bg-zinc-900/50 flex flex-col justify-between"
                      >
                        <div>
                          <h4 className="font-semibold text-sm text-white mb-3">
                            {poll.question}
                          </h4>

                          <div className="space-y-2">
                            {poll.options.map((opt: any) => {
                              const pct = poll.totalVotes > 0 
                                ? Math.round((opt.voteCount / poll.totalVotes) * 100) 
                                : 0;

                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => handleVote(poll.id, opt.id)}
                                  className={`relative w-full overflow-hidden p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                                    opt.votedByMe
                                      ? "border-cyan-500/60 bg-cyan-500/10 text-white font-medium"
                                      : "border-white/10 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800"
                                  }`}
                                >
                                  {/* Progress bar fill */}
                                  <div
                                    className="absolute inset-y-0 left-0 bg-white/5 pointer-events-none transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                  <span className="relative z-10 flex items-center gap-1.5">
                                    {opt.votedByMe && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                    {opt.text}
                                  </span>
                                  <span className="relative z-10 text-[11px] text-zinc-400">
                                    {pct}% ({opt.voteCount})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{poll.totalVotes} total votes</span>
                          <span>{poll.isMultiple ? "Multiple choice" : "Single choice"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. MEMBERS TAB */}
            {activeTab === "members" && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Member Directory ({members.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl border border-white/10 bg-zinc-900/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-xs text-white overflow-hidden">
                          {m.user?.image ? (
                            <img src={m.user.image} alt={m.user.name || ""} className="h-full w-full object-cover" />
                          ) : (
                            <span>{m.user?.name?.slice(0, 2).toUpperCase() || "??"}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-white line-clamp-1">
                            {m.user?.name || "Anonymous User"}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            @{m.user?.username || "user"}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/10">
                        {m.role?.name || "Member"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Invite Members to {comm.name}</h3>
            <p className="text-xs text-zinc-400">
              Share this secure link or QR code with prospective members to join.
            </p>

            <div className="p-3 rounded-xl bg-black border border-white/10 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-300 font-mono truncate">{inviteLink}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* QR Code Canvas */}
            <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center mx-auto max-w-[200px]">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteLink)}`}
                alt="Community QR Code"
                className="w-40 h-40 object-contain"
              />
              <span className="text-[10px] text-zinc-600 mt-2 font-medium">Scan to join immediately</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Channel Modal */}
      {newChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Create Communication Channel</h3>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Channel Name *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">#</span>
                  <input
                    type="text"
                    required
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="match-day, general, announcements"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Topic (Optional)</label>
                <input
                  type="text"
                  value={channelTopic}
                  onChange={(e) => setChannelTopic(e.target.value)}
                  placeholder="What is this channel about?"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewChannelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Announcement Modal */}
      {newAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Post Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Quarterly town hall / Match update"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Content *</label>
                <textarea
                  rows={4}
                  required
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="Write the message for your community..."
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={announcementPinned}
                  onChange={(e) => setAnnouncementPinned(e.target.checked)}
                  className="rounded bg-zinc-800 border-white/20 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Pin this announcement to top</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewAnnouncementModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all"
                >
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {newEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Schedule Community Event</h3>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Match vs Rivals / Team Sync"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Location or Link (Optional)</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Stadium Pitch / Voice Room"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all"
                >
                  Schedule Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Poll Modal */}
      {newPollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Create Community Poll</h3>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Question *</label>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="What time should we practice on Saturday?"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-400">Options *</label>
                {pollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                ))}

                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    + Add option
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewPollModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all"
                >
                  Launch Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
