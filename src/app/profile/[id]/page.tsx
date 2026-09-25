import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ArrowLeft,
  Sparkles,
  Eye,
} from "lucide-react";
import ProfileHeaderCard from "@/components/ProfileHeaderCard";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isConnectAction = resolvedSearchParams?.connect === "true";

  const currentUser = await getCurrentUser();

  // Find user by ID or by username
  let user = await db.user.findUnique({
    where: { id },
    include: {
      institution: true,
      department: true,
      batch: true,
    },
  });

  if (!user) {
    user = await db.user.findFirst({
      where: { username: id },
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });
  }

  if (!user) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === user.id;

  // Ensure own profile always reflects current authenticated session's institution
  if (isOwnProfile && (currentUser as any)?.institution?.name) {
    user.institution = {
      ...user.institution,
      name: (currentUser as any).institution.name,
    };
  }

  // Parse mentor topics if any
  const mentorTopicsList = user.mentorTopics
    ? user.mentorTopics.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col pb-28 sm:pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#0a0f1d]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-8 shadow-lg shadow-black/40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Directory
          </Link>

          {isOwnProfile ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/30 shadow-xs shadow-[#ff9933]/15">
                Your Profile
              </span>
              <LogoutButton showTextOnMobile={true} />
            </div>
          ) : (
            <Link
              href={`/messages/${user.id}`}
              className="text-xs font-bold text-[#FF9933] hover:text-orange-400 transition"
            >
              Direct Messages →
            </Link>
          )}
        </div>
      </header>

      {/* Profile Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Main Profile Header Card (With Cover, Avatar, QR, Scanner & Connect for Chat, and Education & Batch Details) */}
        <ProfileHeaderCard
          user={user as any}
          currentUser={currentUser ? { id: currentUser.id, name: currentUser.name } : null}
          autoConnect={isConnectAction}
        />

        {/* Mentorship Section */}
        <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-6 shadow-xl shadow-black/40 backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" /> Mentorship & Advice
            </h2>
            {user.isOpenToMentor ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Available to Mentor
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400">
                Not actively mentoring
              </span>
            )}
          </div>

          {user.isOpenToMentor && mentorTopicsList.length > 0 ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-300">
                {user.name} is open to assisting juniors and batchmates with:
              </p>
              <div className="flex flex-wrap gap-2">
                {mentorTopicsList.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs font-medium px-3 py-1 rounded-xl bg-purple-500/15 text-purple-200 border border-purple-500/30"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              This member hasn&apos;t set specific mentoring topics yet.
            </p>
          )}
        </div>

        {/* Privacy & Settings */}
        <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-6 shadow-xl shadow-black/40 backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-400" /> Privacy & Visibility Settings
            </h2>
            <span className="text-[10px] text-slate-400">
              {isOwnProfile ? "Manage your privacy" : "Public view"}
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/8 text-xs">
              <div>
                <p className="font-bold text-white">Phone Number Visibility</p>
                <p className="text-[11px] text-slate-400">
                  {user.isPhoneVisible
                    ? "Visible to batchmates and verified members"
                    : "Hidden from public directory"}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                  user.isPhoneVisible
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-white/10 text-slate-300 border-white/15"
                }`}
              >
                {user.isPhoneVisible ? "Public" : "Private"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/8 text-xs">
              <div>
                <p className="font-bold text-white">Cross-Institution Visibility</p>
                <p className="text-[11px] text-slate-400">
                  {user.mentorScope === "ALL"
                    ? "Profile discoverable by alumni across all colleges"
                    : `Scoped strictly to ${user.institution.name}`}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30">
                {user.mentorScope === "ALL" ? "All Colleges" : "My College Only"}
              </span>
            </div>
          </div>
        </div>

        {/* Account Session & Sign Out */}
        {isOwnProfile && (
          <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-5 shadow-xl shadow-black/40 backdrop-blur-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white">Account Session</p>
              <p className="text-[11px] text-slate-400">Sign out of your account on this device</p>
            </div>
            <LogoutButton variant="prominent" />
          </div>
        )}
      </main>
    </div>
  );
}
