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
  RefreshCw,
  Wifi,
} from "lucide-react";
import { MOTION_SPRINGS, triggerHaptic } from "@/lib/motion/tokens";

interface CallOverlayProps {
  isOpen: boolean;
  peerName: string;
  peerRole?: string | null;
  peerAvatar?: string | null;
  isVideo: boolean;
  isCaller: boolean;
  callStatus: "CONNECTING" | "RINGING" | "CONNECTED" | "RECONNECTING" | "ENDED";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEndCall: () => void;
  onAcceptCall?: () => void;
  onToggleMute: (isMuted: boolean) => void;
  onToggleVideo: (isVideoOff: boolean) => void;
  onFlipCamera?: () => void;
}

export default function CallOverlay({
  isOpen,
  peerName,
  peerRole,
  peerAvatar,
  isVideo,
  isCaller,
  callStatus,
  localStream,
  remoteStream,
  onEndCall,
  onAcceptCall,
  onToggleMute,
  onToggleVideo,
  onFlipCamera,
}: CallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isOpen, isVideoOff]);

  // Dedicated Remote Audio handling for WebRTC Audio
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = !isSpeakerOn;
      const playPromise = remoteAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("CallOverlay remote audio autoplay prevented by browser:", err);
        });
      }
    }
  }, [remoteStream, isOpen, isSpeakerOn]);

  // Dedicated Remote Video handling for Video Calls
  useEffect(() => {
    if (isVideo && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = !isSpeakerOn;
      const playPromise = remoteVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("CallOverlay remote video autoplay prevented by browser:", err);
        });
      }
    }
  }, [remoteStream, isOpen, isVideo, isSpeakerOn]);

  // Sync speaker toggle across media elements
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn]);

  const ensureAudioPlaying = () => {
    if (remoteAudioRef.current && remoteStream && remoteAudioRef.current.paused) {
      remoteAudioRef.current.play().catch(() => {});
    }
  };

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "CONNECTED":
        return formatDuration(callDuration);
      case "RECONNECTING":
        return "Reconnecting...";
      case "RINGING":
        return isCaller ? "Ringing..." : `Incoming ${isVideo ? "Video" : "Voice"} Call`;
      case "CONNECTING":
        return "Connecting P2P line...";
      default:
        return "Calling...";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MOTION_SPRINGS.gentle}
        className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none"
      >
        {/* Ambient Blurred Background (Based on peer avatar or modern gradient aura) */}
        {peerAvatar ? (
          <div
            className="absolute inset-0 z-0 bg-cover bg-center filter blur-3xl opacity-20 scale-125 pointer-events-none transition-opacity duration-1000"
            style={{ backgroundImage: `url(${peerAvatar})` }}
          />
        ) : (
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        )}

        {/* Remote Video Stream (if video call) */}
        {isVideo && remoteStream ? (
          <div className="absolute inset-0 z-0">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Subtle Gradient Overlays for UI contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/85 pointer-events-none" />
          </div>
        ) : null}

        {/* Dedicated Universal Audio Element for WebRTC Voice & Video Audio */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          style={{ display: "none" }}
        />

        {/* Top Header with Safe Area Inset Support */}
        <div className="relative z-10 flex items-center justify-between pt-[max(1.25rem,env(safe-area-inset-top))] px-6 pb-2">
          {/* Security & Protocol Pill */}
          <div className="flex items-center gap-2 bg-slate-900/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-medium text-slate-200 shadow-lg">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tracking-wide">P2P {isVideo ? "Video" : "Voice"}</span>
          </div>

          {/* Status & Duration Pill */}
          <div className="flex items-center gap-2 bg-slate-900/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-semibold shadow-lg">
            {callStatus === "CONNECTED" ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : callStatus === "RECONNECTING" ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
            <span
              className={
                callStatus === "CONNECTED"
                  ? "text-emerald-300 font-mono tracking-wider font-bold"
                  : callStatus === "RECONNECTING"
                  ? "text-amber-300"
                  : "text-slate-300"
              }
            >
              {getStatusText()}
            </span>
          </div>
        </div>

        {/* Center Section: Peer Avatar & Details (for voice calls, or before video stream connects) */}
        {(!isVideo || !remoteStream) && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="relative flex items-center justify-center">
              {/* Concentric Pulsing Soundwave / Ringing Rings */}
              {(callStatus === "CONNECTED" || callStatus === "RINGING" || callStatus === "CONNECTING") && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0, 0.35] }}
                    transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                    className={`absolute h-44 w-44 rounded-full border ${
                      !isCaller && callStatus === "RINGING"
                        ? "border-emerald-400/40"
                        : "border-blue-400/30"
                    }`}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.85, 1], opacity: [0.22, 0, 0.22] }}
                    transition={{ repeat: Infinity, duration: 2.6, delay: 0.5, ease: "easeInOut" }}
                    className={`absolute h-44 w-44 rounded-full border ${
                      !isCaller && callStatus === "RINGING"
                        ? "border-emerald-500/30"
                        : "border-indigo-400/25"
                    }`}
                  />
                </>
              )}

              {/* Avatar Box */}
              <motion.div
                animate={callStatus === "RINGING" ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/15 ring-offset-4 ring-offset-slate-950 bg-slate-800 flex items-center justify-center"
              >
                {peerAvatar ? (
                  <img
                    src={peerAvatar}
                    alt={peerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center text-4xl sm:text-5xl font-extrabold text-white ${
                      !isCaller && callStatus === "RINGING"
                        ? "bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-600"
                        : "bg-gradient-to-tr from-blue-600 to-indigo-600"
                    }`}
                  >
                    {peerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Peer Name & Role Details */}
            <div className="mt-6 max-w-sm">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
                {peerName}
              </h2>
              {peerRole && (
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 font-medium line-clamp-1">
                  {peerRole}
                </p>
              )}

              {/* Status Note */}
              {!isCaller && callStatus === "RINGING" ? (
                <motion.div
                  animate={{ scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-lg shadow-emerald-500/10"
                >
                  <PhoneCall className="w-3.5 h-3.5 animate-bounce text-emerald-400" />
                  <span>Incoming {isVideo ? "Video" : "Voice"} Call</span>
                </motion.div>
              ) : callStatus === "CONNECTED" ? (
                <p className="text-xs font-medium text-emerald-400/90 mt-3 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Direct WebRTC • End-to-End Encrypted</span>
                </p>
              ) : callStatus === "RECONNECTING" ? (
                <p className="text-xs font-medium text-amber-400/90 mt-3 flex items-center justify-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  <span>Re-establishing direct connection...</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-3 font-medium">
                  {isCaller ? (callStatus === "RINGING" ? "Ringing..." : "Connecting...") : "Connecting..."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Video Call Name Overlay (when remote video is active) */}
        {isVideo && remoteStream && (
          <div className="relative z-10 flex-1 flex flex-col justify-end p-6">
            <div className="bg-slate-950/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 max-w-fit">
              <h3 className="text-lg font-bold text-white leading-snug">{peerName}</h3>
              {peerRole && <p className="text-xs text-slate-300">{peerRole}</p>}
            </div>
          </div>
        )}

        {/* Draggable Picture-in-Picture Local Video (Self Preview) */}
        {isVideo && (
          <motion.div
            drag
            dragConstraints={{ left: 16, right: 260, top: 70, bottom: 420 }}
            whileTap={{ scale: 0.97 }}
            className="absolute top-20 right-5 z-20 h-40 w-28 sm:h-48 sm:w-34 rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl bg-slate-900 cursor-grab active:cursor-grabbing backdrop-blur-md"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-center p-2 text-slate-400">
                <VideoOff className="w-6 h-6 mb-1 text-slate-500" />
                <span className="text-[10px] font-semibold">Camera Off</span>
              </div>
            )}
            {/* Quick Flip Camera button on PiP preview */}
            {onFlipCamera && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic("light");
                  onFlipCamera();
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition cursor-pointer"
                title="Flip Camera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        )}

        {/* Bottom Call Controls with Mobile Safe Area Inset Support */}
        <div className="relative z-10 px-6 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] flex items-center justify-center">
          {!isCaller && (callStatus === "RINGING" || callStatus === "CONNECTING") ? (
            /* Incoming Call Controls: Decline vs Receive */
            <div className="flex items-center justify-center gap-12 sm:gap-16">
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
                    ensureAudioPlaying();
                    onAcceptCall?.();
                  }}
                  className="h-16 w-16 sm:h-18 sm:w-18 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/50 ring-4 ring-emerald-400/40 border-2 border-emerald-300 transition cursor-pointer animate-pulse"
                  title="Receive Call"
                >
                  <PhoneCall className="w-7 h-7 sm:w-8 sm:h-8 animate-bounce" />
                </motion.button>
                <span className="text-xs font-extrabold text-emerald-400 tracking-wide">Answer</span>
              </div>
            </div>
          ) : (
            /* Active / Outgoing In-Call Floating Glass Dock */
            <div className="flex items-center justify-center gap-3 sm:gap-5 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-3 shadow-2xl">
              {/* Mute Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("medium");
                    ensureAudioPlaying();
                    const nextState = !isMuted;
                    setIsMuted(nextState);
                    onToggleMute(nextState);
                  }}
                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition border cursor-pointer ${
                    isMuted
                      ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30"
                      : "bg-white/10 text-white hover:bg-white/20 border-white/15"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                </motion.button>
              </div>

              {/* Video Toggle Button (if video call) */}
              {isVideo && (
                <div className="flex flex-col items-center">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={MOTION_SPRINGS.snappy}
                    onClick={() => {
                      triggerHaptic("medium");
                      ensureAudioPlaying();
                      const nextState = !isVideoOff;
                      setIsVideoOff(nextState);
                      onToggleVideo(nextState);
                    }}
                    className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition border cursor-pointer ${
                      isVideoOff
                        ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30"
                        : "bg-white/10 text-white hover:bg-white/20 border-white/15"
                    }`}
                    title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                  >
                    {isVideoOff ? (
                      <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </motion.button>
                </div>
              )}

              {/* Flip Camera Button (if video call) */}
              {isVideo && onFlipCamera && (
                <div className="flex flex-col items-center">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={MOTION_SPRINGS.snappy}
                    onClick={() => {
                      triggerHaptic("light");
                      ensureAudioPlaying();
                      onFlipCamera();
                    }}
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition border cursor-pointer bg-white/10 text-white hover:bg-white/20 border-white/15"
                    title="Flip Camera"
                  >
                    <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
                  </motion.button>
                </div>
              )}

              {/* Speaker Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("light");
                    const nextSpeaker = !isSpeakerOn;
                    setIsSpeakerOn(nextSpeaker);
                    if (nextSpeaker) {
                      ensureAudioPlaying();
                    }
                  }}
                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition border cursor-pointer ${
                    !isSpeakerOn
                      ? "bg-white/5 text-slate-400 border-white/10"
                      : "bg-white/10 text-white hover:bg-white/20 border-white/15"
                  }`}
                  title={isSpeakerOn ? "Speaker On" : "Speaker Off"}
                >
                  {isSpeakerOn ? (
                    <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </motion.button>
              </div>

              {/* End Call Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={MOTION_SPRINGS.snappy}
                  onClick={() => {
                    triggerHaptic("heavy");
                    onEndCall();
                  }}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/50 border border-rose-400 transition cursor-pointer"
                  title="End Call"
                >
                  <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
