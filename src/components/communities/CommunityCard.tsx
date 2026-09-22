"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Users, 
  Lock, 
  Globe, 
  MessageSquare, 
  Calendar, 
  BarChart2, 
  ChevronRight,
  ShieldCheck
} from "lucide-react";

interface CommunityCardProps {
  community: {
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    type: string;
    isPrivate: boolean;
    _count?: {
      members?: number;
      channels?: number;
      events?: number;
    };
    members?: Array<{ role?: { name: string } | null; status: string }>;
  };
  compact?: boolean;
}

export const typeBadges: Record<string, { label: string; color: string }> = {
  SPORTS: { label: "Sports & Club", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  ORGANIZATION: { label: "Corporate / Org", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  EDUCATION: { label: "Education & Academy", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  GAMING: { label: "Gaming / Esports", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  CLUB: { label: "Club / Society", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  NGO: { label: "NGO / Social", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  EVENT: { label: "Event / Summit", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  FRIENDS: { label: "Friends & Social", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  PRIVATE: { label: "Private Syndicate", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  CUSTOM: { label: "Community", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
};

export default function CommunityCard({ community, compact = false }: CommunityCardProps) {
  const badge = typeBadges[community.type] || typeBadges.CUSTOM;
  const memberCount = community._count?.members ?? 0;
  const channelCount = community._count?.channels ?? 0;
  const eventCount = community._count?.events ?? 0;

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur-xl shadow-lg transition-all hover:border-white/20 hover:shadow-cyan-500/5"
    >
      <Link href={`/communities/${community.id}`} className="flex flex-col h-full">
        {/* Cover banner */}
        <div className="relative h-24 w-full overflow-hidden bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800">
          {community.coverUrl ? (
            <img
              src={community.coverUrl}
              alt={community.name}
              className="h-full w-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-emerald-950/20" />
          )}

          {/* Privacy Tag */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md border bg-black/40 border-white/10 text-zinc-300">
            {community.isPrivate ? (
              <>
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Private</span>
              </>
            ) : (
              <>
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Public</span>
              </>
            )}
          </div>
        </div>

        {/* Content Container */}
        <div className="relative p-4 pt-0 flex flex-col flex-grow">
          {/* Avatar floating */}
          <div className="-mt-8 mb-2 flex items-end justify-between">
            <div className="relative h-14 w-14 rounded-2xl border-2 border-zinc-900 bg-zinc-800 shadow-md overflow-hidden flex items-center justify-center font-bold text-xl text-white">
              {community.avatarUrl ? (
                <img
                  src={community.avatarUrl}
                  alt={community.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="bg-gradient-to-tr from-cyan-500 to-blue-600 w-full h-full flex items-center justify-center text-white">
                  {community.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Type badge */}
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${badge.color}`}>
              {badge.label}
            </span>
          </div>

          {/* Title & Desc */}
          <h3 className="font-semibold text-base text-zinc-100 line-clamp-1 group-hover:text-cyan-400 transition-colors">
            {community.name}
          </h3>

          <p className="mt-1 text-xs text-zinc-400 line-clamp-2 min-h-[32px]">
            {community.description || "A secure, end-to-end encrypted hub for collaboration, media, and real-time events."}
          </p>

          {/* Stats Bar */}
          <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                {memberCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                {channelCount}
              </span>
              {eventCount > 0 && (
                <span className="flex items-center gap-1 text-cyan-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {eventCount}
                </span>
              )}
            </div>

            <div className="flex items-center text-zinc-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all text-xs font-medium">
              <span>Enter</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
