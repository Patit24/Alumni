"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Lock,
  ShieldCheck,
  Minimize2,
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
    let interval: NodeJS.Timeout | null = null;
    if (callStatus === "CONNECTED") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
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
              {callStatus === "CONNECTED" && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    className="absolute h-40 w-40 rounded-full border border-blue-400/40"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.7, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2.5, delay: 0.4, ease: "easeInOut" }}
                    className="absolute h-40 w-40 rounded-full border border-blue-500/30"
                  />
                </>
              )}

              {/* Avatar Box */}
              <motion.div
                animate={callStatus === "RINGING" ? { scale: [1, 1.06, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="h-28 w-28 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-4xl font-extrabold shadow-2xl shadow-blue-500/30 border-2 border-white/20"
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
            <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero server recording • Direct WebRTC</span>
            </p>
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
        <div className="relative z-10 p-8 pb-12 flex items-center justify-center gap-4 sm:gap-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
          {/* Mute Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={MOTION_SPRINGS.snappy}
            onClick={() => {
              triggerHaptic("medium");
              const nextState = !isMuted;
              setIsMuted(nextState);
              onToggleMute(nextState);
            }}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition border ${
              isMuted
                ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30"
                : "bg-white/15 text-white hover:bg-white/25 border-white/20 backdrop-blur-md"
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </motion.button>

          {/* Toggle Video Button (if video call) */}
          {isVideo && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={MOTION_SPRINGS.snappy}
              onClick={() => {
                triggerHaptic("medium");
                const nextState = !isVideoOff;
                setIsVideoOff(nextState);
                onToggleVideo(nextState);
              }}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition border ${
                isVideoOff
                  ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30"
                  : "bg-white/15 text-white hover:bg-white/25 border-white/20 backdrop-blur-md"
              }`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
            </motion.button>
          )}

          {/* Speaker Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={MOTION_SPRINGS.snappy}
            onClick={() => {
              triggerHaptic("light");
              setIsSpeakerOn(!isSpeakerOn);
            }}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition border ${
              !isSpeakerOn
                ? "bg-white/10 text-slate-400 border-white/10"
                : "bg-white/15 text-white hover:bg-white/25 border-white/20 backdrop-blur-md"
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </motion.button>

          {/* End Call Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={MOTION_SPRINGS.snappy}
            onClick={() => {
              triggerHaptic("heavy");
              onEndCall();
            }}
            className="h-16 w-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 border border-rose-400 transition"
          >
            <PhoneOff className="w-7 h-7" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
