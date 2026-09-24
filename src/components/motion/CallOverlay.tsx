"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Volume2,
  VolumeX,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { MOTION_SPRINGS, triggerHaptic } from "@/lib/motion/tokens";

interface CallOverlayProps {
  isOpen: boolean;
  peerName: string;
  peerRole?: string | null;
  isVideo: boolean;
  isCaller: boolean;
  callStatus: "CONNECTING" | "RINGING" | "CONNECTED" | "ENDED";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEndCall: () => void;
  onAcceptCall?: () => void;
  onToggleMute: (isMuted: boolean) => void;
  onToggleVideo: (isVideoOff: boolean) => void;
}

export default function CallOverlay({
  isOpen,
  peerName,
  peerRole,
  isVideo,
  isCaller,
  callStatus,
  localStream,
  remoteStream,
  onEndCall,
  onAcceptCall,
  onToggleMute,
  onToggleVideo,
}: CallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Call duration counter
  useEffect(() => {
    if (callStatus !== "CONNECTED") return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      setCallDuration(0);
    };
  }, [callStatus]);

  // Attach video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isOpen]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isOpen]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={MOTION_SPRINGS.gentle}
        className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden"
      >
        {/* Remote Video Stream (if video call) */}
        {isVideo && remoteStream ? (
          <div className="absolute inset-0 z-0">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80 pointer-events-none" />
          </div>
        ) : null}

        {/* Top Bar: Security Badge & Call State */}
        <div className="relative z-10 flex items-center justify-between p-6">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>P2P E2EE {isVideo ? "Video" : "Voice"}</span>
          </div>

          <span className="text-xs font-bold text-slate-300">
            {callStatus === "CONNECTED"
              ? formatDuration(callDuration)
              : !isCaller
              ? `Incoming ${isVideo ? "Video" : "Voice"} Call...`
              : callStatus === "RINGING"
              ? "Ringing..."
              : "Securing Connection..."}
          </span>
        </div>

        {/* Center: Large Avatar with Audio Rings (Voice) or Draggable PiP (Video) */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          {!isVideo ? (
            <div className="relative flex items-center justify-center">
              {/* Concentric Animated Audio Rings */}
              {(callStatus === "CONNECTED" || (!isCaller && callStatus === "RINGING")) && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.35, 0, 0.35] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className={`absolute h-40 w-40 rounded-full border ${
                      !isCaller && callStatus !== "CONNECTED"
                        ? "border-emerald-400/50"
                        : "border-blue-400/40"
                    }`}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.75, 1], opacity: [0.25, 0, 0.25] }}
                    transition={{ repeat: Infinity, duration: 2.2, delay: 0.4, ease: "easeInOut" }}
                    className={`absolute h-40 w-40 rounded-full border ${
                      !isCaller && callStatus !== "CONNECTED"
                        ? "border-emerald-500/40"
                        : "border-blue-500/30"
                    }`}
                  />
                </>
              )}

              {/* Avatar Box */}
              <motion.div
                animate={callStatus === "RINGING" ? { scale: [1, 1.08, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className={`h-28 w-28 rounded-3xl text-white flex items-center justify-center text-4xl font-extrabold shadow-2xl border-2 ${
                  !isCaller && callStatus !== "CONNECTED"
                    ? "bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-600 shadow-emerald-500/30 border-emerald-400/40"
                    : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/30 border-white/20"
                }`}
              >
                {peerName.charAt(0).toUpperCase()}
              </motion.div>
            </div>
          ) : null}

          {/* Peer details */}
          <div className="mt-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">{peerName}</h2>
            {peerRole && (
              <p className="text-xs text-slate-400 mt-1 font-medium">{peerRole}</p>
            )}

            {!isCaller && callStatus !== "CONNECTED" ? (
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-lg shadow-emerald-500/10"
              >
                <PhoneCall className="w-3.5 h-3.5 animate-bounce text-emerald-400" />
                <span>Incoming {isVideo ? "Video" : "Voice"} Call • Tap Receive below</span>
              </motion.div>
            ) : isCaller && callStatus !== "CONNECTED" ? (
              <p className="text-xs text-slate-400 mt-2 font-medium">
                {callStatus === "RINGING" ? "Ringing..." : "Connecting direct P2P line..."}
              </p>
            ) : (
              <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero server recording • Direct WebRTC</span>
              </p>
            )}
          </div>
        </div>

        {/* Draggable Picture-in-Picture Local Video (Self Preview) */}
        {isVideo && (
          <motion.div
            drag
            dragConstraints={{ left: 16, right: 280, top: 80, bottom: 400 }}
            whileTap={{ scale: 0.96 }}
            className="absolute top-20 right-6 z-20 h-36 w-28 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-900 cursor-grab active:cursor-grabbing"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                Camera Off
              </div>
            )}
          </motion.div>
        )}

        {/* Bottom Call Action Controls */}
        <div className="relative z-10 p-8 pb-12 flex items-center justify-center bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
          {!isCaller && callStatus !== "CONNECTED" ? (
            /* Incoming Call Controls: Decline vs Receive */
            <div className="flex items-center justify-center gap-10 sm:gap-16">
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("heavy");
                    onEndCall();
                  }}
                  className="h-16 w-16 sm:h-18 sm:w-18 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 border border-rose-400 transition cursor-pointer"
                  title="Decline"
                >
                  <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8" />
                </motion.button>
                <span className="text-xs font-bold text-rose-300 tracking-wide">Decline</span>
              </div>

              {/* Receive / Answer Button */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.08 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("success");
                    onAcceptCall?.();
                  }}
                  className="h-16 w-16 sm:h-18 sm:w-18 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/50 ring-4 ring-emerald-400/40 border-2 border-emerald-300 transition cursor-pointer animate-pulse"
                  title="Receive Call"
                >
                  <PhoneCall className="w-7 h-7 sm:w-8 sm:h-8 animate-bounce" />
                </motion.button>
                <span className="text-xs font-extrabold text-emerald-400 tracking-wide">Receive</span>
              </div>
            </div>
          ) : (
            /* Active / Outgoing In-Call Controls */
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              {/* Mute Button */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("medium");
                    const nextState = !isMuted;
                    setIsMuted(nextState);
                    onToggleMute(nextState);
                  }}
                  className={`h-14 w-14 rounded-full flex items-center justify-center transition border cursor-pointer ${
                    isMuted
                      ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30"
                      : "bg-white/15 text-white hover:bg-white/25 border-white/20 backdrop-blur-md"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </motion.button>
                <span className="text-[11px] font-medium text-slate-400">{isMuted ? "Unmute" : "Mute"}</span>
              </div>

              {/* Toggle Video Button (if video call) */}
              {isVideo && (
                <div className="flex flex-col items-center gap-1.5">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={MOTION_SPRINGS.snappy}
                    onClick={() => {
                      triggerHaptic("medium");
                      const nextState = !isVideoOff;
                      setIsVideoOff(nextState);
                      onToggleVideo(nextState);
                    }}
                    className={`h-14 w-14 rounded-full flex items-center justify-center transition border cursor-pointer ${
                      isVideoOff
                        ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30"
                        : "bg-white/15 text-white hover:bg-white/25 border-white/20 backdrop-blur-md"
                    }`}
                    title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                  >
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
                  </motion.button>
                  <span className="text-[11px] font-medium text-slate-400">{isVideoOff ? "Camera Off" : "Camera"}</span>
                </div>
              )}

              {/* Speaker Button */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("light");
                    setIsSpeakerOn(!isSpeakerOn);
                  }}
                  className={`h-14 w-14 rounded-full flex items-center justify-center transition border cursor-pointer ${
                    !isSpeakerOn
                      ? "bg-white/10 text-slate-400 border-white/10"
                      : "bg-white/15 text-white hover:bg-white/25 border-white/20 backdrop-blur-md"
                  }`}
                  title="Speaker"
                >
                  {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </motion.button>
                <span className="text-[11px] font-medium text-slate-400">Speaker</span>
              </div>

              {/* End Call Button */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("heavy");
                    onEndCall();
                  }}
                  className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 border border-rose-400 transition cursor-pointer"
                  title="End Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </motion.button>
                <span className="text-[11px] font-medium text-rose-400">{callStatus === "CONNECTED" ? "End" : "Cancel"}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
