"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Camera,
  Upload,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { addLocalConnectedPeer } from "@/lib/e2ee/vault";
import jsQR from "jsqr";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMyQr?: () => void;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onOpenMyQr,
}: QRScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [scannedPeer, setScannedPeer] = useState<{
    id: string;
    name: string;
    username?: string | null;
    currentRole?: string | null;
    currentCompany?: string | null;
    batchYear?: number | null;
    avatarUrl?: string | null;
  } | null>(null);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Handle scanned raw string (URL or username or JSON)
  const handleScannedData = useCallback(async (rawValue: string) => {
    const raw = rawValue.trim();
    if (!raw) return;

    // Stop scanning once code detected
    stopCamera();
    setResolving(true);
    setCameraError(null);

    let target = raw;

    // Check if it is a profile URL: e.g. /profile/:id or https://.../profile/:id?connect=true
    if (target.includes("/profile/")) {
      const match = target.match(/\/profile\/([^/?#]+)/);
      if (match && match[1]) {
        target = decodeURIComponent(match[1]);
      }
    } else if (target.includes("connect=")) {
      const match = target.match(/connect=([^&]+)/);
      if (match && match[1]) {
        target = decodeURIComponent(match[1]);
      }
    }

    target = target.replace(/^@/, "").trim();

    try {
      // 1. Try finding by ID directly
      let res = await fetch(`/api/directory?id=${encodeURIComponent(target)}&batchScope=all&institutionScope=all`);
      let data = await res.json();
      let peer = data.alumni?.[0];

      // 2. Try by username
      if (!peer) {
        res = await fetch(`/api/directory?username=${encodeURIComponent(target)}&batchScope=all&institutionScope=all`);
        data = await res.json();
        peer = data.alumni?.[0];
      }

      // 3. Fallback search
      if (!peer) {
        res = await fetch(`/api/directory?q=${encodeURIComponent(target)}&batchScope=all&institutionScope=all`);
        data = await res.json();
        peer = data.alumni?.[0];
      }

      if (peer) {
        setScannedPeer(peer);
      } else {
        setCameraError(`Could not find alumni matching "${target}". Check if the QR code is valid.`);
      }
    } catch (err: any) {
      console.error("Failed to resolve scanned QR code:", err);
      setCameraError("Network error while resolving profile. Please try again.");
    } finally {
      setResolving(false);
    }
  }, [stopCamera]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScannedPeer(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by your browser. You can upload a QR image or enter username below.");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
      }

      // Start detection loop with universal jsQR + BarcodeDetector fallback
      const detector =
        typeof window !== "undefined" && "BarcodeDetector" in window
          ? new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          : null;

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const video = videoRef.current;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return;

        try {
          // 1. Try native BarcodeDetector if available
          if (detector) {
            try {
              const barcodes = await detector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleScannedData(barcodes[0].rawValue);
                return;
              }
            } catch {
              // fallback to jsQR
            }
          }

          // 2. Universal jsQR decoder (runs on all mobile/desktop browsers)
          if (!canvasRef.current) {
            canvasRef.current = document.createElement("canvas");
          }
          const canvas = canvasRef.current;
          // Scale down slightly for ultra-fast 60fps scanning performance
          const targetW = Math.min(width, 640);
          const targetH = Math.min(height, 640);
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetW, targetH);
            const imageData = ctx.getImageData(0, 0, targetW, targetH);
            const qrCode = jsQR(imageData.data, targetW, targetH, {
              inversionAttempts: "dontInvert",
            });
            if (qrCode && qrCode.data) {
              handleScannedData(qrCode.data);
            }
          }
        } catch {
          // Silent catch frame reading errors
        }
      }, 250);
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setCameraError("Unable to access camera. Please allow camera permissions in your browser or upload an image.");
      setCameraActive(false);
    }
  }, [facingMode, handleScannedData, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setScannedPeer(null);
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Handle Image File Upload (e.g. from photo album or saved screenshot)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResolving(true);
    setCameraError(null);

    try {
      const img = new Image();
      img.onload = async () => {
        try {
          // 1. Try BarcodeDetector if present
          if ("BarcodeDetector" in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
              const barcodes = await detector.detect(img);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleScannedData(barcodes[0].rawValue);
                return;
              }
            } catch {
              // fallback to jsQR
            }
          }

          // 2. jsQR canvas decode
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qrCode = jsQR(imageData.data, canvas.width, canvas.height);
            if (qrCode && qrCode.data) {
              handleScannedData(qrCode.data);
              return;
            }
          }
        } catch (decodeErr) {
          console.warn("QR file decode error:", decodeErr);
        }

        setCameraError("No clear QR code was detected in this image. Please try another photo.");
        setResolving(false);
      };
      img.onerror = () => {
        setCameraError("Failed to load selected image file.");
        setResolving(false);
      };
      img.src = URL.createObjectURL(file);
    } catch {
      setCameraError("Could not process image file.");
      setResolving(false);
    }
  };

  const handleConnectAndChat = async (peer: { id: string }) => {
    try {
      addLocalConnectedPeer(peer.id);
      fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: peer.id, action: "REQUEST" }),
      }).catch(() => {});
    } catch (e) {
      console.warn("Failed to connect peer:", e);
    }
    onClose();
    router.push(`/messages/${peer.id}`);
  };

  const handleViewProfile = (peer: { id: string }) => {
    onClose();
    router.push(`/profile/${peer.id}`);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Scan Alumni QR</h2>
              <p className="text-[10px] text-slate-400">Point at any peer&apos;s QR code to connect</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Successful Scan Card */}
        {scannedPeer ? (
          <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-3xl space-y-4 text-center">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md overflow-hidden">
              {scannedPeer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scannedPeer.avatarUrl} alt={scannedPeer.name} className="w-full h-full object-cover" />
              ) : (
                scannedPeer.name.charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <div className="inline-flex items-center gap-1 text-emerald-800 text-xs font-bold bg-emerald-100/80 px-2.5 py-0.5 rounded-full mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Alumni Verified & Found
              </div>
              <h3 className="text-base font-black text-slate-900">{scannedPeer.name}</h3>
              {scannedPeer.username && (
                <p className="text-xs font-mono font-semibold text-blue-600">@{scannedPeer.username}</p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                {scannedPeer.currentRole && scannedPeer.currentCompany
                  ? `${scannedPeer.currentRole} at ${scannedPeer.currentCompany}`
                  : `Class of ${scannedPeer.batchYear || 2026}`}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleConnectAndChat(scannedPeer)}
                className="w-full py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25 cursor-pointer active:scale-98"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Connect for Chat</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleViewProfile(scannedPeer)}
                className="w-full py-2 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer active:scale-98"
              >
                View Full Profile
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Camera Viewfinder */}
            <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Viewfinder Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-white/70 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br" />
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                </div>
              </div>

              {/* Camera Switch button */}
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
                className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/50 text-white/90 backdrop-blur-md hover:bg-black/70 transition"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {resolving && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-xs font-semibold">Resolving Scanned Alumni...</p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Alternative Actions: Upload or Show My QR */}
            <div className="grid grid-cols-2 gap-2">
              <label className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload QR</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {onOpenMyQr ? (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onOpenMyQr();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/80 transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <span>Show My QR</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restart Camera</span>
                </button>
              )}
            </div>

            {/* Manual input fallback */}
            <div className="pt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualInput.trim()) handleScannedData(manualInput);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Or enter @username / link..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="flex-1 p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim() || resolving}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-40"
                >
                  Go
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
