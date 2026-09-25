"use client";

import { useEffect, useState } from "react";
import {
  webrtcManager,
  CallState,
  CallSession,
} from "@/lib/webrtc/call-manager";
import CallOverlay from "@/components/motion/CallOverlay";

export default function CallModal() {
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [session, setSession] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Listen to WebRTC state transitions
    const unsubState = webrtcManager.onStateChange((state, curSession) => {
      setCallState(state);
      setSession(curSession ? { ...curSession } : null);
      setLocalStream(webrtcManager.getLocalStream());
      setRemoteStream(webrtcManager.getRemoteStream());
    });

    // Listen to remote audio/video stream
    const unsubStream = webrtcManager.onRemoteStream((stream) => {
      setRemoteStream(stream);
    });

    return () => {
      unsubState();
      unsubStream();
    };
  }, []);

  const isOpen = callState !== "IDLE" && session !== null;

  return (
    <CallOverlay
      isOpen={isOpen}
      peerName={session?.peerName || "Alumni Contact"}
      peerRole={session?.peerRole}
      isVideo={session?.callType === "VIDEO"}
      isCaller={!session?.isIncoming}
      callStatus={
        callState === "CALLING" || callState === "RINGING"
          ? "RINGING"
          : callState === "CONNECTED"
          ? "CONNECTED"
          : "CONNECTING"
      }
      localStream={localStream}
      remoteStream={remoteStream}
      onEndCall={() => webrtcManager.endCall(true)}
      onAcceptCall={() => webrtcManager.acceptCall()}
      onToggleMute={() => webrtcManager.toggleMute()}
      onToggleVideo={() => webrtcManager.toggleVideo()}
      onFlipCamera={() => webrtcManager.flipCamera()}
    />
  );
}
