"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Send,
  Mic,
  Plus,
  Flame,
  X,
  Camera,
  Image as ImageIcon,
  FileText,
  MapPin,
  QrCode,
  Trash2,
} from "lucide-react";
import { MOTION_SPRINGS, triggerHaptic } from "@/lib/motion/tokens";
import { VaultMessage } from "@/lib/e2ee/vault";

export type MessagePrivacyMode =
  | "NORMAL"
  | "VIEW_ONCE"
  | "DISAPPEAR_30S"
  | "DISAPPEAR_5M"
  | "DISAPPEAR_1H"
  | "DISAPPEAR_24H";

interface MessageComposerProps {
  inputText: string;
  onInputChange: (val: string) => void;
  onSend: (text: string) => void;
  replyingTo: VaultMessage | null;
  onCancelReply: () => void;
  privacyMode: MessagePrivacyMode;
  onPrivacyModeChange: (mode: MessagePrivacyMode) => void;
  disabled?: boolean;
}

export default function MessageComposer({
  inputText,
  onInputChange,
  onSend,
  replyingTo,
  onCancelReply,
  privacyMode,
  onPrivacyModeChange,
  disabled = false,
}: MessageComposerProps) {
  const [showAttachments, setShowAttachments] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cancelDragX, setCancelDragX] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || disabled) return;
    triggerHaptic("medium");
    onSend(inputText.trim());
    onInputChange("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleMicPressStart = () => {
    if (inputText.trim()) return;
    triggerHaptic("heavy");
    setIsRecording(true);
  };

  const handleMicDrag = (_: any, info: PanInfo) => {
    if (info.offset.x < 0) {
      setCancelDragX(info.offset.x);
    }
  };

  const handleMicRelease = (_: any, info: PanInfo) => {
    if (!isRecording) return;
    if (info.offset.x < -80) {
      // Cancelled
      triggerHaptic("error");
      setIsRecording(false);
      setCancelDragX(0);
    } else {
      // Sent audio note
      triggerHaptic("success");
      setIsRecording(false);
      setCancelDragX(0);
      onSend(`🎙️ Voice Message (${recordingSeconds}s)`);
    }
  };

  const handleMicSimpleRelease = () => {
    if (!isRecording) return;
    triggerHaptic("success");
    setIsRecording(false);
    setCancelDragX(0);
    onSend(`🎙️ Voice Message (${recordingSeconds}s)`);
  };

  const attachments = [
    { label: "Camera", icon: Camera, color: "bg-rose-50 text-rose-600" },
    { label: "Gallery", icon: ImageIcon, color: "bg-blue-50 text-blue-600" },
    { label: "Document", icon: FileText, color: "bg-amber-50 text-amber-600" },
    { label: "Location", icon: MapPin, color: "bg-emerald-50 text-emerald-600" },
    { label: "Scan QR", icon: QrCode, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <footer className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 p-2 sm:p-3 space-y-2">
      {/* Replying-To Preview Banner */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            transition={MOTION_SPRINGS.snappy}
            className="flex items-center justify-between p-2.5 bg-blue-50/90 rounded-2xl border border-blue-200/70 text-xs"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-1 h-7 bg-blue-600 rounded-full shrink-0" />
              <div className="truncate">
                <p className="font-bold text-blue-900 text-[11px]">Replying to message</p>
                <p className="text-slate-600 text-[11px] truncate">{replyingTo.text}</p>
              </div>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1.5 rounded-full hover:bg-blue-100 text-slate-500 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ephemeral Privacy Selector Strip */}
      <AnimatePresence>
        {showPrivacyPicker && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={MOTION_SPRINGS.snappy}
            className="p-2 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-slate-700"
          >
            <span className="text-slate-400 shrink-0 text-[10px] uppercase font-bold pl-1">
              Privacy Mode:
            </span>
            {[
              { id: "NORMAL" as MessagePrivacyMode, label: "Standard E2EE" },
              { id: "VIEW_ONCE" as MessagePrivacyMode, label: "🔥 View Once" },
              { id: "DISAPPEAR_30S" as MessagePrivacyMode, label: "30s" },
              { id: "DISAPPEAR_5M" as MessagePrivacyMode, label: "5m" },
              { id: "DISAPPEAR_1H" as MessagePrivacyMode, label: "1h" },
              { id: "DISAPPEAR_24H" as MessagePrivacyMode, label: "24h" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onPrivacyModeChange(opt.id);
                  setShowPrivacyPicker(false);
                }}
                className={`py-1 px-2.5 rounded-xl transition shrink-0 ${
                  privacyMode === opt.id
                    ? "bg-blue-600 text-white font-bold shadow-2xs"
                    : "hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Radial Attachment Tray */}
      <AnimatePresence>
        {showAttachments && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={MOTION_SPRINGS.snappy}
            className="p-3 bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-xl grid grid-cols-5 gap-2 text-center"
          >
            {attachments.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, ...MOTION_SPRINGS.bouncy }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    triggerHaptic("light");
                    setShowAttachments(false);
                    onSend(`[Attached ${item.label}]`);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-2xl hover:bg-slate-50 transition"
                >
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Composer Bar */}
      <div className="flex items-end gap-2">
        {/* Privacy Selector Toggle Button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            triggerHaptic("light");
            setShowPrivacyPicker(!showPrivacyPicker);
          }}
          className={`h-10 w-10 rounded-2xl flex items-center justify-center transition shrink-0 ${
            privacyMode !== "NORMAL"
              ? "bg-amber-100 text-amber-800 font-bold border border-amber-300"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          title="Change Disappearing / View-Once Setting"
        >
          <Flame className="w-4 h-4" />
        </motion.button>

        {/* Attachment Toggle Button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: showAttachments ? 45 : 0 }}
          transition={MOTION_SPRINGS.snappy}
          onClick={() => {
            triggerHaptic("light");
            setShowAttachments(!showAttachments);
          }}
          className="h-10 w-10 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition shrink-0"
        >
          <Plus className="w-4 h-4" />
        </motion.button>

        {/* Text Input or Voice Recording Waveform */}
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 h-10 px-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-600 font-bold"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
              <span>
                {Math.floor(recordingSeconds / 60)}:
                {String(recordingSeconds % 60).padStart(2, "0")}
              </span>
            </div>

            {/* Pulsing simulated audio bars */}
            <div className="flex items-center gap-1">
              {[8, 16, 12, 20, 14, 18, 10].map((h, i) => (
                <motion.span
                  key={i}
                  animate={{ height: [h * 0.4, h, h * 0.5] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.08 }}
                  className="w-1 bg-rose-500 rounded-full"
                />
              ))}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <span>← Slide to cancel</span>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={disabled ? "Chat request pending..." : "End-to-End Encrypted Message..."}
              disabled={disabled}
              className="w-full bg-slate-100 text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm rounded-2xl px-4 py-2.5 border border-slate-200/80 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none max-h-32 min-h-[40px] leading-relaxed"
            />
          </div>
        )}

        {/* Send Button or Voice Record Mic */}
        {inputText.trim() ? (
          <motion.button
            whileTap={{ scale: 0.92 }}
            transition={MOTION_SPRINGS.snappy}
            onClick={() => handleSubmit()}
            disabled={disabled}
            className="h-10 w-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0 transition"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </motion.button>
        ) : (
          <motion.div
            drag="x"
            dragConstraints={{ left: -120, right: 0 }}
            dragElastic={0.2}
            onDrag={handleMicDrag}
            onDragEnd={handleMicRelease}
            className="shrink-0"
          >
            <motion.button
              type="button"
              onTouchStart={handleMicPressStart}
              onMouseDown={handleMicPressStart}
              onTouchEnd={handleMicSimpleRelease}
              onMouseUp={handleMicSimpleRelease}
              whileTap={{ scale: 1.25 }}
              transition={MOTION_SPRINGS.bouncy}
              className={`h-10 w-10 rounded-2xl flex items-center justify-center transition shadow-2xs ${
                isRecording
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-500/30 ring-4 ring-rose-200"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Mic className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </div>
    </footer>
  );
}
