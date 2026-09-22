"use client";

import React from "react";
import { motion } from "framer-motion";

export default function TypingIndicator({ name }: { name?: string }) {
  const dotVariants = {
    initial: { y: 0, opacity: 0.4 },
    animate: { y: -5, opacity: 1 },
  };

  return (
    <div className="flex items-center gap-2 py-1 px-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-2xs w-fit">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{
              duration: 0.5,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
              delay: i * 0.15,
            }}
            className="w-1.5 h-1.5 rounded-full bg-blue-600"
          />
        ))}
      </div>
      <span className="text-[11px] font-medium text-slate-500">
        {name ? `${name} is typing...` : "Typing..."}
      </span>
    </div>
  );
}
