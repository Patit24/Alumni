"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  Compass, 
  Users, 
  QrCode, 
  Sparkles, 
  Filter, 
  ShieldCheck, 
  Zap,
  ArrowRight,
  Lock
} from "lucide-react";
import CommunityCard from "@/components/communities/CommunityCard";

const CATEGORIES = [
  { id: "ALL", label: "All Hubs" },
  { id: "SPORTS", label: "Sports & Teams" },
  { id: "ORGANIZATION", label: "Corporate & Dept" },
  { id: "EDUCATION", label: "Education & Campus" },
  { id: "GAMING", label: "Gaming & Esports" },
  { id: "CLUB", label: "Clubs & Societies" },
  { id: "NGO", label: "NGO & Causes" },
  { id: "EVENT", label: "Events & Summits" },
  { id: "FRIENDS", label: "Friends & Circles" },
];

export default function CommunitiesHubPage() {
  const [activeTab, setActiveTab] = useState<"joined" | "discover">("joined");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedCommunities, setJoinedCommunities] = useState<any[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/communities");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load communities");

      setJoinedCommunities(data.joined || []);
      setDiscoverCommunities(data.discover || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const listToDisplay = activeTab === "joined" ? joinedCommunities : discoverCommunities;

  const filteredList = listToDisplay.filter((comm) => {
    const matchesCategory = selectedCategory === "ALL" || comm.type === selectedCategory;
    const matchesSearch =
      comm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.description && comm.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col pb-24">
      {/* Top Banner / Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white tracking-tight">Communities & Orgs</h1>
              <p className="text-[11px] text-zinc-400">Zero-knowledge group collaboration</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/communities/create"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Community</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 pt-6 flex flex-col gap-6">
        {/* Search & Tabs Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Active Tabs (Joined vs Discover) */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("joined")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "joined"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              My Communities ({joinedCommunities.length})
            </button>
            <button
              onClick={() => setActiveTab("discover")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "discover"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Discover ({discoverCommunities.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, tags, or description..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>
        </div>

        {/* Categories Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full border whitespace-nowrap font-medium transition-all ${
                selectedCategory === cat.id
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                  : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-xs">Loading communities...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400 text-xs">
            {error}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 text-zinc-500 mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-base text-zinc-200">
              {activeTab === "joined" ? "No communities joined yet" : "No communities found"}
            </h3>
            <p className="mt-1 text-xs text-zinc-400 text-center">
              {activeTab === "joined"
                ? "Join an existing group from Discover or create a tailored community for your team."
                : "Try adjusting your category or search term to discover public hubs."}
            </p>
            {activeTab === "joined" && (
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setActiveTab("discover")}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all"
                >
                  Explore Public Hubs
                </button>
                <Link
                  href="/communities/create"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition-all"
                >
                  Create One
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((comm) => (
              <CommunityCard key={comm.id} community={comm} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
