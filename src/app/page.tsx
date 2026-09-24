import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  GraduationCap,
  Users,
  ShieldAlert,
  ShieldCheck,
  Briefcase,
  Sparkles,
  ArrowRight,
  MapPin,
  Building,
  Music,
  PartyPopper,
  Lock,
  CheckCircle2,
  QrCode,
  Compass,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import FeedSection from "@/components/FeedSection";
import ClientAuthRedirect from "@/components/ClientAuthRedirect";
import AlumniPassportCard from "@/components/AlumniPassportCard";
import InstitutionDiscoverySection from "@/components/InstitutionDiscoverySection";
import NavbarUserAvatar from "@/components/NavbarUserAvatar";

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();

  const searchParams = props.searchParams ? await props.searchParams : {};
  const code = searchParams?.code;

  if (typeof code === "string" && code && !user) {
    redirect(`/api/auth/callback?code=${encodeURIComponent(code)}`);
  }

  if (!user) {
    // ── Samparka Premium Landing — 2026 "Made in India" Design ──
    return (
      <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#080810]">
        <ClientAuthRedirect />

        {/* ── Ambient gradient blobs ── */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-orange-500/18 blur-[140px]" style={{ animation: "pulse 7s ease-in-out infinite" }} />
          <div className="absolute top-1/2 -right-48 h-[500px] w-[500px] rounded-full bg-indigo-600/18 blur-[130px]" style={{ animation: "pulse 9s ease-in-out infinite", animationDelay: "2s" }} />
          <div className="absolute -bottom-32 left-1/3 h-[440px] w-[440px] rounded-full bg-emerald-600/14 blur-[120px]" style={{ animation: "pulse 11s ease-in-out infinite", animationDelay: "1s" }} />
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
        </div>

        {/* ── Indian tricolor top bar ── */}
        <div aria-hidden className="absolute top-0 inset-x-0 z-20 h-[3px] flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white/70" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* ── Main content ── */}
        <div className="relative z-10 w-full max-w-sm mx-auto px-5 py-12 sm:py-16 flex flex-col items-center text-center gap-7">

          {/* App identity pills */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/7 border border-white/10 text-white/85 text-[11px] font-bold tracking-[0.16em] uppercase">
              <span className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              Samparka
            </div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-400 text-[11px] font-bold">
              🇮🇳 Made in India
            </div>
          </div>

          {/* Hero headline */}
          <div className="space-y-2 w-full">
            <p className="text-white/38 text-[10px] font-semibold tracking-[0.22em] uppercase mb-1">
              India&apos;s Secure Connection Platform
            </p>
            <h1 className="text-[clamp(2.6rem,11vw,3.8rem)] font-black leading-[1.06] tracking-[-0.02em] text-white">
              Connect with
              <br />
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage:
                    "linear-gradient(110deg, #FF9933 0%, #ffd4a0 38%, #ffffff 55%, #a8f0b8 72%, #138808 100%)",
                  WebkitBackgroundClip: "text",
                }}
              >
                People.
              </span>
            </h1>
            <p className="text-[clamp(1rem,4vw,1.25rem)] font-semibold text-white/55 leading-snug mt-1">
              Chat without limits.
            </p>
          </div>

          {/* Sub copy */}
          <p className="text-[13px] text-white/42 leading-relaxed max-w-[280px]">
            One secure place to connect, communicate, and build meaningful
            relationships — engineered with pride in India.
          </p>

          {/* Primary CTA */}
          <Link
            href="/auth"
            id="landing-get-started-btn"
            className="group relative inline-flex items-center justify-center gap-2.5 w-full rounded-[18px] text-white font-extrabold py-[15px] px-8 text-[15px] overflow-hidden transition-all duration-200 active:scale-[0.97]"
            style={{
              background:
                "linear-gradient(130deg, #FF9933 0%, #cc5a00 45%, #138808 100%)",
              boxShadow:
                "0 0 0 1px rgba(255,153,51,0.3), 0 8px 32px rgba(255,120,0,0.4), 0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
            </span>
          </Link>

          {/* Trust strip */}
          <div className="flex items-center justify-center gap-3 flex-wrap text-[10px] text-white/35 font-semibold">
            <span className="flex items-center gap-1">
              <Lock className="w-[10px] h-[10px] text-emerald-400" /> Encrypted
            </span>
            <span className="text-white/15">•</span>
            <span>⚡ Instant</span>
            <span className="text-white/15">•</span>
            <span>👥 Verified</span>
            <span className="text-white/15">•</span>
            <span>🇮🇳 India First</span>
          </div>

          {/* Feature bento grid */}
          <div className="w-full grid grid-cols-2 gap-2 mt-1">
            {[
              { icon: "🔐", title: "Private Chat", desc: "E2E encrypted", color: "#818cf8" },
              { icon: "👥", title: "Discover People", desc: "Verified profiles", color: "#38bdf8" },
              { icon: "💬", title: "Messaging", desc: "Text, voice & media", color: "#34d399" },
              { icon: "🏘️", title: "Communities", desc: "Groups & interests", color: "#fbbf24" },
              { icon: "📞", title: "Voice & Video", desc: "Clear P2P calls", color: "#f472b6" },
              { icon: "🔔", title: "Notifications", desc: "Real-time alerts", color: "#a78bfa" },
            ].map((f) => (
              <div
                key={f.title}
                className="relative group p-3.5 rounded-xl border border-white/7 bg-white/[0.035] hover:bg-white/[0.065] hover:border-white/14 transition-all duration-200 text-left overflow-hidden"
              >
                <div
                  aria-hidden
                  className="absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-0 group-hover:opacity-25 blur-2xl transition-opacity duration-300"
                  style={{ background: f.color }}
                />
                <p className="text-[18px] mb-2 leading-none">{f.icon}</p>
                <p className="text-[11px] font-bold text-white/85 leading-none">{f.title}</p>
                <p className="text-[10px] text-white/38 mt-1 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Made in India pride card */}
          <div
            className="w-full rounded-xl border border-amber-500/20 p-4 flex items-center gap-3 text-left"
            style={{
              background:
                "linear-gradient(120deg, rgba(255,153,51,0.08) 0%, rgba(255,255,255,0.03) 50%, rgba(19,136,8,0.08) 100%)",
            }}
          >
            <span className="text-3xl select-none leading-none">🇮🇳</span>
            <div>
              <p className="text-[12px] font-black text-white/90 tracking-tight leading-tight">
                Proudly Made in India
              </p>
              <p className="text-[10px] text-white/40 mt-1 leading-snug">
                Indian privacy standards · Local data residency · National pride
              </p>
            </div>
          </div>

          {/* Secondary link */}
          <p className="text-[11px] text-white/30">
            Already on Samparka?{" "}
            <Link
              href="/auth"
              className="text-white/65 font-bold underline underline-offset-2 hover:text-white transition-colors"
            >
              Sign In →
            </Link>
          </p>
        </div>

        {/* ── Bottom tricolor bar ── */}
        <div aria-hidden className="absolute bottom-0 inset-x-0 z-20 h-[3px] flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white/50" />
          <div className="flex-1 bg-[#138808]" />
        </div>
      </main>
    );
  }

  // Authenticated Alumni Dashboard
  const isVerified = user.verificationStatus === "VERIFIED";

  // Formatted city in Title Case
  const formattedCity = user.city
    ? user.city
        .trim()
        .toLowerCase()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;

  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col pb-28 sm:pb-16">
      {/* Global Floating Sticky Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0f1d]/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Alma Mater Identity */}
          <Link href="/" className="flex items-center gap-3 group min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#000080] via-[#000066] to-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/30 shrink-0 group-hover:scale-105 transition-transform duration-200 border border-blue-500/30">
              <GraduationCap className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white tracking-tight truncate group-hover:text-[#FF9933] transition">
                  {user.institution.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Class of {user.batchYear} {user.department ? `• ${user.department.name}` : ""}
              </p>
            </div>
          </Link>

          {/* Action Header Nav */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/messages"
              className="h-9 px-3.5 sm:px-4 rounded-xl btn-saffron text-white flex items-center gap-2 text-xs font-bold transition shadow-md shadow-[#ff9933]/20 active:scale-95 shrink-0"
              title="End-to-End Encrypted Messages & Calls"
            >
              <div className="relative flex items-center justify-center">
                <Lock className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-[#FF9933] animate-pulse" />
              </div>
              <span className="tracking-tight">Messages</span>
            </Link>

            <Link
              href={`/profile/${user.id}`}
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center gap-2 text-xs font-semibold transition shrink-0"
              title="My Profile"
            >
              <NavbarUserAvatar
                name={user.name}
                userId={user.id}
                initialAvatarUrl={user.avatarUrl}
              />
              <span className="hidden sm:inline font-medium">Profile</span>
            </Link>

            <LogoutButton showTextOnMobile={true} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Alumni Identity Passport Card */}
        <AlumniPassportCard user={user as any} />

        {/* People from User's College / University / School Discovery Section */}
        <InstitutionDiscoverySection
          institutionId={user.institutionId}
          initialInstitutionName={user.institution?.name}
        />

        {/* Quick 1-Click Feature Shortcuts Hub */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Campus Hub
            </h2>
            <Link
              href="/explore"
              className="text-xs font-bold text-[#FF9933] hover:text-orange-400 flex items-center gap-1 transition"
            >
              <span>All Features</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Alumni Directory */}
            <Link
              href="/directory"
              className="p-3.5 rounded-2xl bg-[#111726]/80 border border-white/10 hover:border-[#FF9933]/40 hover:bg-white/[0.04] transition group flex items-center gap-3 backdrop-blur-xl"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-[#FF9933] transition truncate">
                  Network
                </p>
                <p className="text-[11px] text-slate-400 truncate">Find Alumni</p>
              </div>
            </Link>

            {/* Jobs & Referrals */}
            <Link
              href="/jobs"
              className="p-3.5 rounded-2xl bg-[#111726]/80 border border-white/10 hover:border-purple-400/40 hover:bg-white/[0.04] transition group flex items-center gap-3 backdrop-blur-xl"
            >
              <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-purple-300 transition truncate">
                  Jobs
                </p>
                <p className="text-[11px] text-slate-400 truncate">Referrals</p>
              </div>
            </Link>

            {/* Senior Mentorship */}
            <Link
              href="/mentorship"
              className="p-3.5 rounded-2xl bg-[#111726]/80 border border-white/10 hover:border-emerald-400/40 hover:bg-white/[0.04] transition group flex items-center gap-3 backdrop-blur-xl"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate">
                  Mentorship
                </p>
                <p className="text-[11px] text-slate-400 truncate">1-on-1 Help</p>
              </div>
            </Link>

            {/* Explore Hub */}
            <Link
              href="/explore"
              className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FF9933] via-orange-600 to-[#138808] text-white shadow-md shadow-[#ff9933]/20 hover:opacity-95 transition group flex items-center gap-3 active:scale-95"
            >
              <div className="h-10 w-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white transition truncate">
                  Explore Hub
                </p>
                <p className="text-[11px] text-orange-100 truncate">More Features</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Campus & Alumni Feed */}
        <section className="pt-2">
          <FeedSection
            currentUserId={user.id}
            currentUserName={user.name}
            currentUserRole={user.currentRole}
            currentUserCompany={user.currentCompany}
            currentUserVerified={isVerified}
            batchYear={user.batchYear}
            currentUserAvatar={user.avatarUrl}
          />
        </section>
      </main>
    </div>
  );
}
