import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Database, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupabaseDemoPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Attempt to fetch from 'todos' as specified in supabase quickstart
  const { data: todos, error } = await supabase.from("todos").select();

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Supabase Connected
          </span>
        </div>

        <div className="space-y-2">
          <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Supabase SSR Integration</h1>
          <p className="text-xs text-slate-500">
            Connected to project <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">tinoesrmhzgelxiykcgq.supabase.co</code>
          </p>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Todos Query Result
          </h2>
          {error ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-bold">Notice from Supabase query:</p>
              <p>{error.message}</p>
              <p className="text-[11px] text-amber-600 mt-1">
                (If you haven&apos;t created the <code>todos</code> table in your Supabase project dashboard yet, you can create it with <code>id</code> and <code>name</code> columns, or we can use Supabase tables for your real-time alumni feed!)
              </p>
            </div>
          ) : !todos || todos.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
              Table &quot;todos&quot; is connected and returned 0 items. Add a row in your Supabase table editor to see it populate here!
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {todos.map((todo: { id: string | number; name?: string; title?: string }) => (
                <li key={todo.id} className="p-3 text-xs font-medium text-slate-800 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  {todo.name || todo.title || JSON.stringify(todo)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
