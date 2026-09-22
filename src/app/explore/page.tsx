import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Compass,
  Users,
  Briefcase,
  Sparkles,
  PartyPopper,
  MessageSquare,
  Lock,
  ShieldCheck,
  UserCheck,
  Building,
  GraduationCap,
  ArrowRight,
  QrCode,
  Share2,
  Sliders,
  Search,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const primaryFeatures = [
    {
      title: "Alumni Directory",
      description: "Search classmates, seniors & peers across all batches",
      href: "/directory",
      icon: Users,
      color: "from-blue-600 to-indigo-600",
      badge: "Discovery",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      title: "Jobs & Referrals",
      description: "Discover internal openings & request referrals",
      href: "/jobs",
      icon: Briefcase,
      color: "from-purple-600 to-indigo-600",
      badge: "Careers",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      title: "Senior Mentorship",
      description: "1-on-1 guidance, career talks & peer vouches",
      href: "/mentorship",
      icon: Sparkles,
      color: "from-emerald-600 to-teal-600",
      badge: "Guidance",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      title: "Communities & Hubs",
      description: "Join official clubs, regional hubs & interest groups",
      href: "/communities",
      icon: Building,
      color: "from-cyan-600 to-blue-600",
      badge: "Social",
      badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    {
      title: "Batch Reunions",
      description: "Plan meetups, chapter gatherings & milestone events",
      href: "/reunions",
      icon: PartyPopper,
      color: "from-amber-500 to-orange-600",
      badge: "Events",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      title: "Private E2EE Messages",
      description: "Zero-knowledge encrypted direct chat & P2P calls",
      href: "/messages",
      icon: Lock,
      color: "from-slate-800 to-slate-950",
      badge: "Encrypted",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    },
  ];

  const quickActions = [
    {
      title: "My Profile & Passport",
      subtitle: "View & edit your alumni card",
      href: `/profile/${user.id}`,
      icon: GraduationCap,
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Privacy & Security",
      subtitle: "Ghost alerts, receipts & device keys",
      href: "/settings/privacy",
      icon: ShieldCheck,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Find Batchmates",
      subtitle: `Class of ${user.batchYear} alumni`,
      href: `/directory?batch=${user.batchYear}`,
      icon: UserCheck,
      color: "text-indigo-600 bg-indigo-50",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Explore Network</h1>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
                {user.institution?.name || "Campus Features"}
              </p>
            </div>
          </div>

          <Link
            href="/directory"
            className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 text-xs font-semibold transition"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-lg space-y-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold">
              One-Tap Access
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              All Alumni Features, Right Here.
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Every tool to connect, find career opportunities, and collaborate with your alma mater network.
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        </div>

        {/* Primary Feature Hub Grid */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            All Features & Hubs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {primaryFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.title}
                  href={f.href}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all duration-200 group flex items-start gap-3.5 active:scale-[0.99]"
                >
                  <div
                    className={`h-11 w-11 rounded-2xl bg-gradient-to-tr ${f.color} text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                        {f.title}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${f.badgeColor}`}
                      >
                        {f.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Quick Utility Actions */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Account & Utilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <Link
                  key={qa.title}
                  href={qa.href}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition flex items-center gap-3 group"
                >
                  <div className={`h-9 w-9 rounded-xl ${qa.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                      {qa.title}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{qa.subtitle}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
