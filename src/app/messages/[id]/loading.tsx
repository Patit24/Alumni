export default function ChatLoading() {
  return (
    <div className="h-[100dvh] flex flex-col bg-[#080811] text-white animate-pulse">
      {/* Chat Header Skeleton */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-[#0f172a]/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-10 h-10 rounded-2xl bg-white/10" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 bg-white/10 rounded" />
            <div className="h-3 w-16 bg-white/5 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-8 h-8 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Messages Stream Skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        <div className="flex justify-start">
          <div className="h-12 w-48 bg-white/5 rounded-2xl rounded-tl-sm" />
        </div>
        <div className="flex justify-end">
          <div className="h-14 w-56 bg-orange-500/10 rounded-2xl rounded-tr-sm" />
        </div>
        <div className="flex justify-start">
          <div className="h-10 w-40 bg-white/5 rounded-2xl rounded-tl-sm" />
        </div>
        <div className="flex justify-end">
          <div className="h-16 w-64 bg-orange-500/10 rounded-2xl rounded-tr-sm" />
        </div>
      </div>

      {/* Input Bar Skeleton */}
      <div className="p-3 border-t border-white/5 bg-[#0a0f1d]/80">
        <div className="h-12 w-full bg-white/5 rounded-2xl border border-white/5" />
      </div>
    </div>
  );
}
