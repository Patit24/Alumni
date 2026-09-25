"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Copy,
  Check,
  Share2,
  X,
  Scan,
  ShieldCheck,
  ArrowRight,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner?: () => void;
  currentUser?: {
    id?: string;
    name?: string;
    username?: string | null;
    batchYear?: number | null;
    institutionName?: string | null;
  } | null;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  onOpenScanner,
  currentUser,
}: QRCodeModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"MY_CODE" | "SCAN_CONNECT">("MY_CODE");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const displayName = currentUser?.name?.trim() || "Alumni Member";
  const username = (currentUser?.username?.trim() || "alumni").replace(/^@/, "");
  const batchYear = currentUser?.batchYear || new Date().getFullYear();

  const [connectUrl, setConnectUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/profile/${currentUser?.id || username}?connect=true`;
    }
    return `https://alumni-pink.vercel.app/profile/${currentUser?.id || username}?connect=true`;
  });

  // Fetch LAN IP for cross-mobile scanning if testing on localhost
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      fetch("/api/network-info")
        .then((r) => r.json())
        .then((data) => {
          if (data.lanOrigin) {
            setConnectUrl(`${data.lanOrigin}/profile/${currentUser?.id || username}?connect=true`);
          }
        })
        .catch(() => {});
    } else {
      setConnectUrl(`${window.location.origin}/profile/${currentUser?.id || username}?connect=true`);
    }
  }, [currentUser?.id, username]);

  const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(connectUrl)}`;

  // Generate QR Code vector SVG or use instant fallback
  useEffect(() => {
    if (!isOpen || !connectUrl) return;

    try {
      const qrcodeLib = QRCode as any;
      const toStringFn = qrcodeLib?.toString || qrcodeLib?.default?.toString;

      if (typeof toStringFn === "function") {
        toStringFn(connectUrl, {
          type: "svg",
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        })
          .then((svg: string) => {
            if (svg && svg.includes("<svg")) {
              setQrDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
            }
          })
          .catch((err: unknown) => {
            console.warn("SVG QR generation fallback:", err);
          });
      }
    } catch (e: unknown) {
      console.warn("QR generation error:", e);
    }
  }, [isOpen, connectUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("Copy failed:", e);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Connect with ${displayName} on Alumni Network`,
          text: `Scan my QR code or tap this link to start an encrypted direct chat with @${username}:`,
          url: connectUrl,
        });
      } catch (e) {
        console.warn("Share aborted:", e);
      }
    } else {
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  const handleConnectManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;

    setResolving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let target = clean;
    if (target.includes("connect=")) {
      const match = target.match(/connect=([^&]+)/);
      if (match && match[1]) target = decodeURIComponent(match[1]);
    }
    target = target.replace(/^@/, "").trim();

    try {
      // 1. Direct username lookup
      let res = await fetch(`/api/directory?username=${encodeURIComponent(target)}&batchScope=all&institutionScope=all`);
      let data = await res.json();
      let peer = data.alumni?.[0];

      // 2. Fallback query search by ID, phone, or name
      if (!peer) {
        res = await fetch(`/api/directory?q=${encodeURIComponent(target)}&batchScope=all&institutionScope=all`);
        data = await res.json();
        peer = data.alumni?.[0];
      }

      if (peer) {
        setSuccessMessage(`Found ${peer.name} (@${peer.username || "alumni"})! Opening profile...`);
        setTimeout(() => {
          onClose();
          router.push(`/profile/${peer.id}`);
        }, 400);
      } else {
        setErrorMessage(`No alumni found with username or name "@${target}". Check the spelling or ask them to share their QR code.`);
        setResolving(false);
      }
    } catch (err: any) {
      console.error("Connect error:", err);
      setErrorMessage("Network error while resolving profile. Please check connection.");
      setResolving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#0a0f1d] rounded-3xl border border-white/10 p-6 shadow-2xl space-y-4 text-white backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/30 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">QR Code Connect</h2>
              <p className="text-[10px] text-slate-400">In-Person & Instant Key Exchange</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition font-bold text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-white/5 p-1 rounded-2xl text-xs font-semibold border border-white/10">
          <button
            type="button"
            onClick={() => setTab("MY_CODE")}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === "MY_CODE"
                ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white font-bold shadow-md shadow-[#ff9933]/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            My QR Code
          </button>
          <button
            type="button"
            onClick={() => setTab("SCAN_CONNECT")}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === "SCAN_CONNECT"
                ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white font-bold shadow-md shadow-[#ff9933]/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Scan & Connect
          </button>
        </div>

        {/* TAB 1: My QR Code */}
        {tab === "MY_CODE" && (
          <div className="space-y-4 text-center">
            <div className="p-3.5 bg-white rounded-2xl border border-white/20 shadow-lg inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl || fallbackQrUrl}
                alt="My Connect QR Code"
                className="w-56 h-56 mx-auto rounded-xl bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-sm font-bold text-white">{displayName}</p>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-xs font-mono font-semibold text-blue-300 mt-0.5">
                @{username}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Class of {batchYear} • End-to-End Encrypted
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="btn-saffron flex-1 py-2 px-3 rounded-xl text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-[#ff9933]/20"
              >
                <Share2 className="w-3.5 h-3.5" /> Share QR
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-300 text-left flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Scanning your QR code allows peers to view your profile and start an end-to-end encrypted chat instantly.
              </span>
            </div>

            {/* Separated Button for Scanning a Batchmate's QR */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  if (onOpenScanner) {
                    onClose();
                    onOpenScanner();
                  } else {
                    setTab("SCAN_CONNECT");
                  }
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition flex items-center justify-center gap-2 border border-white/10 cursor-pointer active:scale-98 shadow-sm"
              >
                <Scan className="w-4 h-4 text-[#FF9933]" />
                <span>Scan Batchmate&apos;s QR Code</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Scan / Connect by Username or Link */}
        {tab === "SCAN_CONNECT" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter any batchmate&apos;s <strong className="text-white">@username</strong> or paste their connect link to start a secure encrypted chat:
            </p>

            <form onSubmit={handleConnectManual} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Username or Connect Link:
                </label>
                <input
                  type="text"
                  placeholder="@patit_7x92 or https://alumni.../messages?connect=..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] font-mono transition"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!manualInput.trim() || resolving}
                className="btn-saffron w-full py-2.5 rounded-2xl text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-[#ff9933]/20 disabled:opacity-50"
              >
                {resolving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resolving Alumni Identity...</span>
                  </>
                ) : (
                  <>
                    <span>Connect & Start Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1.5">
              <p className="text-xs font-semibold text-white">In-Person Camera Scanning</p>
              <p className="text-[10px] text-slate-400">
                You can also point your mobile camera directly at any alumnus&apos;s QR Code to open their chat link instantly!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
