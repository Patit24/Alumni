"use client";

import { triggerHaptic } from "@/lib/motion/tokens";
import { Sparkles } from "lucide-react";

export default function MadeInIndiaBadge() {
  const handleClick = () => {
    triggerHaptic("medium");
    window.dispatchEvent(new CustomEvent("open-made-in-india-splash"));
  };

  return (
    <div className="flex items-center justify-center pt-6 pb-4">
      <button
        onClick={handleClick}
        className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-100/80 border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-700 transition active:scale-95"
        title="View Made in India Splash Screen"
      >
        <span className="text-sm">🇮🇳</span>
        <span className="bg-gradient-to-r from-orange-600 via-slate-800 to-emerald-700 bg-clip-text text-transparent font-bold">
          Proudly Made in India
        </span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span className="text-[11px] text-slate-500 group-hover:text-blue-600 flex items-center gap-1 font-normal">
          <span>Splash Screen</span>
          <Sparkles className="w-3 h-3 text-amber-500" />
        </span>
      </button>
    </div>
  );
}
