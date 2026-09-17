import { CheckCircle2, Database, ShieldCheck, Smartphone, Users, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Alumni Network</h1>
            <p className="text-sm text-slate-500">Connect • Mentor • Refer • Celebrate</p>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-emerald-900">Phase 0 Initialized Successfully</h2>
            <p className="text-xs text-emerald-700 mt-0.5">
              Next.js 16 App Router, TypeScript, Tailwind CSS, PWA manifest, and Prisma ORM are configured and ready.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Foundation Architecture</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-slate-800">Phone-OTP Ready</p>
                <p className="text-[11px] text-slate-500">Dev mock + SMS adapter</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <Database className="w-4 h-4 text-indigo-600" />
              <div>
                <p className="text-xs font-medium text-slate-800">Relational DB</p>
                <p className="text-[11px] text-slate-500">PostgreSQL + Prisma</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-medium text-slate-800">Passive Verification</p>
                <p className="text-[11px] text-slate-500">Batchmate peer vouching</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-xs font-medium text-slate-800">PWA Mobile-First</p>
                <p className="text-[11px] text-slate-500">Installable web app</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Ready for Phase 1: Data Model & Auth</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            v0.1.0 Live
          </span>
        </div>
      </div>
    </main>
  );
}
