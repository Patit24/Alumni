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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Directory
          </Link>

          {isOwnProfile ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                Your Profile
              </span>
              <LogoutButton showTextOnMobile={true} />
            </div>
          ) : (
            <Link
              href={`/messages/${user.id}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
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
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" /> Mentorship & Advice
            </h2>
            {user.isOpenToMentor ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
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
              <p className="text-xs text-slate-600">
                {user.name} is open to assisting juniors and batchmates with:
              </p>
              <div className="flex flex-wrap gap-2">
                {mentorTopicsList.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs font-medium px-3 py-1 rounded-xl bg-purple-50/80 text-purple-900 border border-purple-200/70"
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
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-500" /> Privacy & Visibility Settings
            </h2>
            <span className="text-[10px] text-slate-400">
              {isOwnProfile ? "Manage your privacy" : "Public view"}
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <p className="font-semibold text-slate-800">Phone Number Visibility</p>
                <p className="text-[11px] text-slate-500">
                  {user.isPhoneVisible
                    ? "Visible to batchmates and verified members"
                    : "Hidden from public directory"}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  user.isPhoneVisible
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {user.isPhoneVisible ? "Public" : "Private"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <p className="font-semibold text-slate-800">Cross-Institution Visibility</p>
                <p className="text-[11px] text-slate-500">
                  {user.mentorScope === "ALL"
                    ? "Profile discoverable by alumni across all colleges"
                    : `Scoped strictly to ${user.institution.name}`}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {user.mentorScope === "ALL" ? "All Colleges" : "My College Only"}
              </span>
            </div>
          </div>
        </div>

        {/* Account Session & Sign Out */}
        {isOwnProfile && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-800">Account Session</p>
              <p className="text-[11px] text-slate-500">Sign out of your account on this device</p>
            </div>
            <LogoutButton variant="prominent" />
          </div>
        )}
      </main>
    </div>
  );
}
