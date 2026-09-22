/**
 * WebRTC 1-to-1 Voice & Video Engine with Direct P2P & STUN/TURN fallback.
 * Operates purely peer-to-peer with zero server media storage or call recording.
 */

export type CallType = "VOICE" | "VIDEO";
export type CallState =
  | "IDLE"
  | "CALLING"
  | "RINGING"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ENDED";

export interface CallSession {
  callId: string;
  peerId: string;
  peerName: string;
  callType: CallType;
  isIncoming: boolean;
  startTime?: number;
  duration: number;
}

export interface WebRTCSignalingMessage {
  callId: string;
  senderId: string;
  senderName?: string;
  type: "REQUEST" | "ACCEPT" | "REJECT" | "OFFER" | "ANSWER" | "ICE" | "END";
  callType?: CallType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
}

// Built-in synthesized web audio tones for outgoing ringing and incoming calls
class ToneGenerator {
  private ctx: AudioContext | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Play outgoing ringing tone (two 440Hz+480Hz beeps followed by pause)
  startOutgoingRing() {
    this.stop();
    const playBeep = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      gain.gain.value = 0.08;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    };

    playBeep();
    this.intervalId = setInterval(playBeep, 3500);
  }

  // Play incoming ringtone (pleasant harmonic melody)
  startIncomingRing() {
    this.stop();
    const playChime = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.6);
      });
    };

    playChime();
    this.intervalId = setInterval(playChime, 2500);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const tones = new ToneGenerator();

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCall: CallSession | null = null;
  private callState: CallState = "IDLE";
  private currentFacingMode: "user" | "environment" = "user";
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];

  // Listeners
  private onStateChangeCb: ((state: CallState, session: CallSession | null) => void) | null = null;
  private onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  private onSendSignalCb: ((msg: WebRTCSignalingMessage) => void) | null = null;
  private durationTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Default constructor
  }

  setCallbacks(cbs: {
    onStateChange: (state: CallState, session: CallSession | null) => void;
    onRemoteStream: (stream: MediaStream) => void;
    onSendSignal: (msg: WebRTCSignalingMessage) => void;
  }) {
    this.onStateChangeCb = cbs.onStateChange;
    this.onRemoteStreamCb = cbs.onRemoteStream;
    this.onSendSignalCb = cbs.onSendSignal;
  }

  private setState(state: CallState) {
    this.callState = state;
    if (this.onStateChangeCb) {
      this.onStateChangeCb(state, this.currentCall);
    }
  }

  getCallState(): CallState {
    return this.callState;
  }

  getCurrentSession(): CallSession | null {
    return this.currentCall;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private getIceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ];

    // Optional configurable TURN server from environment
    if (process.env.NEXT_PUBLIC_TURN_URLS) {
      servers.push({
        urls: process.env.NEXT_PUBLIC_TURN_URLS.split(","),
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      });
    }

    return servers;
  }

  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
      iceCandidatePoolSize: 2,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentCall && this.onSendSignalCb) {
        this.onSendSignalCb({
          callId: this.currentCall.callId,
          senderId: "", // Filled by caller
          type: "ICE",
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) this.remoteStream = new MediaStream();
        this.remoteStream.addTrack(event.track);
      }

      if (this.onRemoteStreamCb && this.remoteStream) {
        this.onRemoteStreamCb(this.remoteStream);
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connecting":
          this.setState("CONNECTING");
          break;
        case "connected":
          tones.stop();
          this.setState("CONNECTED");
          this.startDurationTimer();
          break;
        case "disconnected":
          this.setState("RECONNECTING");
          break;
        case "failed":
        case "closed":
          this.endCall(false);
          break;
      }
    };

    this.pc = pc;
    return pc;
  }

  // Acquire local media streams
  async acquireMedia(callType: CallType): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        callType === "VIDEO"
          ? {
              facingMode: this.currentFacingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream = stream;
    return stream;
  }

  // Caller starts outgoing call
  async startCall(peerId: string, peerName: string, callType: CallType): Promise<void> {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.currentCall = {
      callId,
      peerId,
      peerName,
      callType,
      isIncoming: false,
      duration: 0,
    };

    this.setState("CALLING");
    tones.startOutgoingRing();

    // Signal callee about incoming call request
    if (this.onSendSignalCb) {
      this.onSendSignalCb({
        callId,
        senderId: "",
        type: "REQUEST",
        callType,
      });
    }
  }

  private isPrivacyLockActive: boolean = false;

  setPrivacyLock(active: boolean) {
    this.isPrivacyLockActive = active;
  }

  // Handle incoming call alert
  handleIncomingCall(callId: string, callerId: string, callerName: string, callType: CallType) {
    if (this.isPrivacyLockActive) {
      // Privacy Lock active: silently auto-reject call without ringing or exposing presence
      if (this.onSendSignalCb) {
        this.onSendSignalCb({
          callId,
          senderId: "",
          type: "REJECT",
          reason: "PRIVACY_LOCK",
        });
      }
      return;
    }

    if (this.callState !== "IDLE") {
      // Busy: reject incoming request
      if (this.onSendSignalCb) {
        this.onSendSignalCb({
          callId,
          senderId: "",
          type: "REJECT",
          reason: "BUSY",
        });
      }
      return;
    }

    this.currentCall = {
      callId,
      peerId: callerId,
      peerName: callerName,
      callType,
      isIncoming: true,
      duration: 0,
    };

    this.setState("RINGING");
    tones.startIncomingRing();
  }

  // Callee accepts incoming call
  async acceptCall(): Promise<void> {
    if (!this.currentCall) return;
    tones.stop();
    this.setState("CONNECTING");

    try {
      const stream = await this.acquireMedia(this.currentCall.callType);
      const pc = this.createPeerConnection();

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Signal caller that call has been accepted
      if (this.onSendSignalCb) {
        this.onSendSignalCb({
          callId: this.currentCall.callId,
          senderId: "",
          type: "ACCEPT",
        });
      }
    } catch (err) {
      console.error("Failed to accept call / acquire media:", err);
      this.endCall(true);
    }
  }

  // Callee or Caller rejects/declines call
  rejectCall(reason = "DECLINED"): void {
    tones.stop();
    if (this.currentCall && this.onSendSignalCb) {
      this.onSendSignalCb({
        callId: this.currentCall.callId,
        senderId: "",
        type: "REJECT",
        reason,
      });
    }
    this.endCall(false);
  }

  // Caller receives accept signal -> creates WebRTC Offer
  async handlePeerAccepted(): Promise<void> {
    if (!this.currentCall) return;
    tones.stop();
    this.setState("CONNECTING");

    try {
      const stream = await this.acquireMedia(this.currentCall.callType);
      const pc = this.createPeerConnection();

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.onSendSignalCb) {
        this.onSendSignalCb({
          callId: this.currentCall.callId,
          senderId: "",
          type: "OFFER",
          sdp: offer,
        });
      }
    } catch (err) {
      console.error("Error creating WebRTC offer:", err);
      this.endCall(true);
    }
  }

  // Callee receives WebRTC Offer -> creates WebRTC Answer
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc || !this.currentCall) return;

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Drain any queued ICE candidates
      while (this.iceCandidatesQueue.length > 0) {
        const cand = this.iceCandidatesQueue.shift();
        if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      }

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      if (this.onSendSignalCb) {
        this.onSendSignalCb({
          callId: this.currentCall.callId,
          senderId: "",
          type: "ANSWER",
          sdp: answer,
        });
      }
    } catch (err) {
      console.error("Error handling WebRTC offer:", err);
    }
  }

  // Caller receives WebRTC Answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Drain any queued ICE candidates
      while (this.iceCandidatesQueue.length > 0) {
        const cand = this.iceCandidatesQueue.shift();
        if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      }
    } catch (err) {
      console.error("Error handling WebRTC answer:", err);
    }
  }

  // Process incoming ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (this.pc && this.pc.remoteDescription) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.iceCandidatesQueue.push(candidate);
      }
    } catch (err) {
      console.warn("Error adding ICE candidate:", err);
    }
  }

  // Mute/Unmute microphone
  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // returns true if muted
    }
    return false;
  }

  // Turn camera on/off
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  // Switch between front and rear cameras (mobile Capacitor & responsive web)
  async flipCamera(): Promise<void> {
    if (!this.localStream || !this.pc) return;
    const currentTrack = this.localStream.getVideoTracks()[0];
    if (!currentTrack) return;

    this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
    currentTrack.stop();

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.currentFacingMode },
      });
      const newTrack = newStream.getVideoTracks()[0];

      // Replace track in RTCPeerConnection sender
      const senders = this.pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(newTrack);
      }

      this.localStream.removeTrack(currentTrack);
      this.localStream.addTrack(newTrack);
    } catch (err) {
      console.error("Camera flip error:", err);
    }
  }

  private startDurationTimer() {
    if (this.durationTimer) clearInterval(this.durationTimer);
    if (!this.currentCall) return;
    this.currentCall.startTime = Date.now();
    this.durationTimer = setInterval(() => {
      if (this.currentCall && this.currentCall.startTime) {
        this.currentCall.duration = Math.floor((Date.now() - this.currentCall.startTime) / 1000);
      }
    }, 1000);
  }

  // End call and cleanup
  endCall(notifyPeer = true): void {
    tones.stop();

    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }

    if (notifyPeer && this.currentCall && this.onSendSignalCb) {
      this.onSendSignalCb({
        callId: this.currentCall.callId,
        senderId: "",
        type: "END",
      });
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream = null;
    this.iceCandidatesQueue = [];

    const endedCall = this.currentCall;
    this.currentCall = null;
    this.setState("IDLE");

    // Optional callback for call logs
    if (endedCall) {
      // Returned for local vault saving
    }
  }
}

// Global Singleton WebRTC Instance
export const webrtcManager = new WebRTCManager();
