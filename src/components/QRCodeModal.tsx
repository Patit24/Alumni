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
import { addLocalConnectedPeer } from "@/lib/e2ee/vault";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    id?: string;
    name?: string;
    username?: string | null;
    batchYear?: number;
    institutionName?: string;
  } | null;
}

export default function QRCodeModal({
  isOpen,
  onClose,
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

  const connectPayload = typeof window !== "undefined"
    ? `${window.location.origin}/messages?connect=${encodeURIComponent(username)}`
    : `https://alumni-pink.vercel.app/messages?connect=${encodeURIComponent(username)}`;

  const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(connectPayload)}`;

  // Generate QR Code vector SVG or use instant fallback
  useEffect(() => {
    if (!isOpen) return;

    try {
      const qrcodeLib = QRCode as any;
      const toStringFn = qrcodeLib?.toString || qrcodeLib?.default?.toString;

      if (typeof toStringFn === "function") {
        toStringFn(connectPayload, {
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
  }, [isOpen, connectPayload]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectPayload);
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
          url: connectPayload,
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
        addLocalConnectedPeer(peer.id);
        setSuccessMessage(`Found ${peer.name} (@${peer.username || "alumni"})! Opening chat...`);
        setTimeout(() => {
          onClose();
          router.push(`/messages/${peer.id}`);
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">QR Code Connect</h2>
              <p className="text-[10px] text-slate-400">In-Person & Instant Key Exchange</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("MY_CODE")}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === "MY_CODE"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My QR Code
          </button>
          <button
            type="button"
            onClick={() => setTab("SCAN_CONNECT")}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === "SCAN_CONNECT"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Scan & Connect
          </button>
        </div>

        {/* TAB 1: My QR Code */}
        {tab === "MY_CODE" && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl || fallbackQrUrl}
                alt="My Connect QR Code"
                className="w-56 h-56 mx-auto rounded-xl bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-sm font-bold text-slate-900">{displayName}</p>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-mono font-semibold text-blue-600 mt-0.5">
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
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
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
                className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" /> Share QR
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 text-[11px] text-emerald-800 text-left flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Scanning your QR code allows peers to exchange identity keys and start an end-to-end encrypted session instantly without any phone numbers.
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: Scan / Connect by Username or Link */}
        {tab === "SCAN_CONNECT" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Enter any batchmate&apos;s <strong>@username</strong> or paste their connect link to start a secure encrypted chat:
            </p>

            <form onSubmit={handleConnectManual} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Username or Connect Link:
                </label>
                <input
                  type="text"
                  placeholder="@patit_7x92 or https://alumni.../messages?connect=..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!manualInput.trim() || resolving}
                className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
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

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">In-Person Camera Scanning</p>
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
