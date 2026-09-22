"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Reply,
  Copy,
  Trash2,
  Check,
  CheckCheck,
  Flame,
  Clock,
  CornerUpLeft,
} from "lucide-react";
import { VaultMessage } from "@/lib/e2ee/vault";
import { MOTION_SPRINGS, triggerHaptic } from "@/lib/motion/tokens";

interface MessageBubbleProps {
  message: VaultMessage;
  isMe: boolean;
  isViewOnce?: boolean;
  isBurned?: boolean;
  onRevealViewOnce?: (msg: VaultMessage) => void;
  onReply?: (msg: VaultMessage) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
}

const EMOJI_REACTIONS = ["❤️", "👍", "🔥", "😂", "😮", "🙏"];

export default function MessageBubble({
  message,
  isMe,
  isViewOnce = false,
  isBurned = false,
  onRevealViewOnce,
  onReply,
  onDelete,
  onReact,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [reactions, setReactions] = useState<string[]>([]);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleDrag = (_: any, info: PanInfo) => {
    // Only allow swipe to reply towards right
    if (info.offset.x > 0) {
      setDragX(info.offset.x);
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 50) {
      triggerHaptic("medium");
      onReply?.(message);
    }
    setDragX(0);
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      triggerHaptic("heavy");
      setShowMenu(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      triggerHaptic("light");
      setShowMenu(false);
    }
  };

  const handleAddReaction = (emoji: string) => {
    triggerHaptic("light");
    setReactions((prev) => (prev.includes(emoji) ? prev.filter((e) => e !== emoji) : [...prev, emoji]));
    onReact?.(message.id, emoji);
    setShowMenu(false);
  };

  return (
    <div className="relative group my-1.5 flex flex-col select-none">
      {/* Swipe to reply reveal icon behind bubble */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-600 transition-opacity pointer-events-none"
        style={{
          opacity: Math.min(1, dragX / 40),
          transform: `scale(${Math.min(1.2, 0.6 + dragX / 70)})`,
        }}
      >
        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center">
          <CornerUpLeft className="w-4 h-4 text-blue-600" />
        </div>
      </div>

      {/* Main Draggable Bubble */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 80 }}
        dragElastic={0.4}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        initial={isMe ? { scale: 0.95, opacity: 0 } : { y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1, x: 0 }}
        transition={MOTION_SPRINGS.snappy}
        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            triggerHaptic("medium");
            setShowMenu(true);
          }}
          className={`relative max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 text-xs transition-all ${
            isMe
              ? "bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-br-xs shadow-sm shadow-blue-500/15 border border-blue-400/20"
              : "bg-white/85 backdrop-blur-md text-slate-900 border border-white/70 shadow-xs rounded-bl-xs"
          } ${showMenu ? "ring-2 ring-blue-500/40 shadow-lg scale-[1.02]" : ""}`}
        >
          {/* View-Once Content or Standard Text */}
          {isViewOnce && !isMe ? (
            isBurned ? (
              <div className="flex items-center gap-1.5 italic text-slate-400 py-0.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>💥 Burned after viewing</span>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onRevealViewOnce?.(message)}
                className="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1.5 transition"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Tap to View Once</span>
              </motion.button>
            )
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
          )}

          {/* Time & Delivery Status Checkmarks */}
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
              isMe ? "text-blue-100" : "text-slate-400"
            }`}
          >
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {message.privacyMode === "VIEW_ONCE" && <span title="View Once">🔥</span>}
            {message.disappearingSeconds && (
              <span title={`Auto-deletes in ${message.disappearingSeconds}s`}>⏳</span>
            )}

            {isMe && (
              <span className="inline-flex items-center ml-1" title={message.status}>
                {message.status === "SENDING" && (
                  <Clock className="w-2.5 h-2.5 text-blue-200/80 animate-pulse" />
                )}
                {message.status === "SENT" && (
                  <Check className="w-3.5 h-3.5 text-blue-200/85" strokeWidth={2.4} />
                )}
                {message.status === "DELIVERED" && (
                  <CheckCheck className="w-3.5 h-3.5 text-blue-200/85" strokeWidth={2.4} />
                )}
                {message.status === "READ" && (
                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] drop-shadow-[0_0_2px_rgba(83,189,235,0.8)]" strokeWidth={2.6} />
                )}
              </span>
            )}
          </div>

          {/* Reaction badges stack */}
          {reactions.length > 0 && (
            <div
              className={`absolute -bottom-2.5 ${
                isMe ? "right-2" : "left-2"
              } flex items-center gap-0.5 bg-white border border-slate-200 shadow-2xs rounded-full px-1.5 py-0.5 text-[11px]`}
            >
              {reactions.map((emoji, idx) => (
                <motion.span
                  key={idx}
                  initial={{ scale: 0.7 }}
                  animate={{ scale: [0.7, 1.2, 1] }}
                  transition={MOTION_SPRINGS.bouncy}
                >
                  {emoji}
                </motion.span>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Long-Press Context Menu & Emoji Picker */}
      <AnimatePresence>
        {showMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dimmed backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={MOTION_SPRINGS.snappy}
              className="relative z-10 w-full max-w-xs bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-2xl p-3 space-y-3"
            >
              {/* Emoji Reaction Bar */}
              <div className="flex items-center justify-around py-1 px-1 bg-slate-50 rounded-2xl border border-slate-100">
                {EMOJI_REACTIONS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.85 }}
                    transition={MOTION_SPRINGS.bouncy}
                    onClick={() => handleAddReaction(emoji)}
                    className="text-lg p-1"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    onReply?.(message);
                    setShowMenu(false);
                  }}
                  className="w-full py-2.5 px-3 hover:bg-slate-50 flex items-center gap-2.5 rounded-xl transition text-left"
                >
                  <Reply className="w-4 h-4 text-blue-600" />
                  <span>Reply</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="w-full py-2.5 px-3 hover:bg-slate-50 flex items-center gap-2.5 rounded-xl transition text-left"
                >
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Copy Text</span>
                </button>

                {onDelete && (
                  <button
                    onClick={() => {
                      triggerHaptic("warning");
                      onDelete(message.id);
                      setShowMenu(false);
                    }}
                    className="w-full py-2.5 px-3 hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 rounded-xl transition text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Message</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
