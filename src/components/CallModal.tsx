"use client";

import { useEffect, useRef, useState } from "react";
import {
  webrtcManager,
  CallState,
  CallSession,
  CallType,
} from "@/lib/webrtc/call-manager";
import { realtimeSignaling } from "@/lib/e2ee/signaling";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  RefreshCw,
  Maximize2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function CallModal() {
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [session, setSession] = useState<CallSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Listen to WebRTC state transitions
    webrtcManager.setCallbacks({
      onStateChange: (state, curSession) => {
        setCallState(state);
        setSession(curSession ? { ...curSession } : null);
        if (state === "IDLE") {
          setDuration(0);
          setIsMuted(false);
          setIsVideoOff(false);
        }
      },
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onSendSignal: (msg) => {
        const cur = webrtcManager.getCurrentSession();
        if (cur?.peerId) {
          realtimeSignaling.sendSignalToPeer(cur.peerId, msg);
        }
      },
    });

    // Duration interval listener
    const timer = setInterval(() => {
      const cur = webrtcManager.getCurrentSession();
      if (cur) {
        setDuration(cur.duration);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update local video element when stream is ready
  useEffect(() => {
    const localStream = webrtcManager.getLocalStream();
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [callState]);

  if (callState === "IDLE" || !session) {
    return null;
  }

  // 1. INCOMING CALL SCREEN
  if (callState === "RINGING" && session.isIncoming) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
        >
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center shadow-2xl text-white">
            <div className="relative mx-auto h-24 w-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-3xl font-bold mb-5 shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/20 animate-pulse">
              {session.peerName.charAt(0).toUpperCase()}
            </div>

            <h2 className="text-xl font-bold text-slate-100">{session.peerName}</h2>
            <p className="text-xs text-blue-400 mt-1 uppercase tracking-wider font-semibold">
              Incoming {session.callType === "VIDEO" ? "Video" : "Voice"} Call...
            </p>

            <div className="mt-8 flex items-center justify-center gap-10">
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => webrtcManager.rejectCall("DECLINED")}
                  className="h-16 w-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition transform active:scale-95 cursor-pointer"
                  title="Decline"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-xs font-bold text-rose-300">Decline</span>
              </div>

              {/* Receive / Accept Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => webrtcManager.acceptCall()}
                  className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-400/30 transition transform active:scale-95 animate-bounce cursor-pointer"
                  title="Receive Call"
                >
                  <PhoneCall className="w-7 h-7" />
                </button>
                <span className="text-xs font-extrabold text-emerald-400">Receive</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 2. ACTIVE / OUTGOING VOICE CALL SCREEN
  if (session.callType === "VOICE") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-slate-950 text-white select-none">
        {/* Top Header */}
        <div className="text-center pt-8">
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full uppercase tracking-wider">
            End-to-End Encrypted Voice
          </span>
          <h2 className="text-2xl font-bold text-slate-100 mt-4">{session.peerName}</h2>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            {callState === "CALLING" && "Calling..."}
            {callState === "CONNECTING" && "Connecting..."}
            {callState === "CONNECTED" && formatDuration(duration)}
            {callState === "RECONNECTING" && "Connection lost. Reconnecting..."}
          </p>
        </div>

        {/* Center Avatar Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-32 w-32 sm:h-40 sm:w-40 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-5xl font-bold shadow-2xl shadow-blue-500/20 ring-4 ring-white/10">
            {session.peerName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="w-full max-w-sm pb-8 flex items-center justify-center gap-5">
          {/* Mute Mic */}
          <button
            onClick={() => setIsMuted(webrtcManager.toggleMute())}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition ${
              isMuted ? "bg-rose-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title="Mute"
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* End Call */}
          <button
            onClick={() => webrtcManager.endCall(true)}
            className="h-16 w-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Speaker Mute */}
          <button
            onClick={() => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
                setIsSpeakerMuted(remoteVideoRef.current.muted);
              }
            }}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition ${
              isSpeakerMuted ? "bg-rose-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title="Speaker"
          >
            {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

        {/* Hidden Audio Element for Remote Stream */}
        <audio ref={remoteVideoRef} autoPlay playsInline />
      </div>
    );
  }

  // 3. ACTIVE / OUTGOING VIDEO CALL SCREEN
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none overflow-hidden">
      {/* Remote Fullscreen Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Top Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10">
        <div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            E2EE Video Call
          </span>
          <h2 className="text-lg font-bold text-white mt-1 drop-shadow">{session.peerName}</h2>
          <p className="text-xs text-slate-300 font-medium">
            {callState === "CALLING" && "Calling..."}
            {callState === "CONNECTING" && "Connecting..."}
            {callState === "CONNECTED" && formatDuration(duration)}
            {callState === "RECONNECTING" && "Reconnecting..."}
          </p>
        </div>
      </div>

      {/* Floating Local Camera PiP Preview */}
      <div className="absolute bottom-28 right-4 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900 z-20">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
      </div>

      {/* Bottom Floating Glassmorphic Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-4 z-30">
        {/* Toggle Microphone */}
        <button
          onClick={() => setIsMuted(webrtcManager.toggleMute())}
          className={`h-13 w-13 rounded-full flex items-center justify-center backdrop-blur-md transition ${
            isMuted ? "bg-rose-600 text-white" : "bg-white/20 hover:bg-white/30 text-white"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={() => setIsVideoOff(!webrtcManager.toggleVideo())}
          className={`h-13 w-13 rounded-full flex items-center justify-center backdrop-blur-md transition ${
            isVideoOff ? "bg-rose-600 text-white" : "bg-white/20 hover:bg-white/30 text-white"
          }`}
          title={isVideoOff ? "Start Video" : "Stop Video"}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Flip Camera (Mobile Front/Rear) */}
        <button
          onClick={() => webrtcManager.flipCamera()}
          className="h-13 w-13 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center transition"
          title="Flip Camera"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          onClick={() => webrtcManager.endCall(true)}
          className="h-15 w-15 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition transform active:scale-95"
          title="End Video Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
