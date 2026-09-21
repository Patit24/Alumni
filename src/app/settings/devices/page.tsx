"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Smartphone,
  Laptop,
  ShieldCheck,
  Trash2,
  Lock,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface DeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  lastActiveAt: string;
  createdAt: string;
}

export default function DevicesManagementPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/messages/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error("Error loading devices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevokeDevice = async (deviceId: string) => {
    if (confirm("Revoke this device? It will no longer be able to send or receive encrypted messages.")) {
      setRevokingId(deviceId);
      try {
        const res = await fetch(`/api/messages/devices?deviceId=${deviceId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
        }
      } catch (err) {
        console.error("Error revoking device:", err);
      } finally {
        setRevokingId(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings/privacy"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Linked Devices</h1>
              <p className="text-[11px] text-slate-400">Cryptographic identity keys & active sessions</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Info Card */}
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-900 leading-relaxed">
            Each active device generates and securely stores its own unique private key in local storage.
            Revoking a device permanently prevents it from receiving new encrypted messages.
          </p>
        </div>

        {/* Devices List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Loading active devices...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold">No registered devices</p>
              <p className="text-[11px] mt-1">Open a direct chat to register your current device</p>
            </div>
          ) : (
            devices.map((device, idx) => {
              const isDesktop = device.deviceName.toLowerCase().includes("mac") ||
                device.deviceName.toLowerCase().includes("win") ||
                device.deviceName.toLowerCase().includes("linux");

              return (
                <div key={device.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      {isDesktop ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {device.deviceName.slice(0, 35)}
                        </p>
                        {idx === 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                            Current Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                        ID: {device.deviceId}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Active: {new Date(device.lastActiveAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {idx !== 0 && (
                    <button
                      onClick={() => handleRevokeDevice(device.deviceId)}
                      disabled={revokingId === device.deviceId}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition shrink-0 flex items-center gap-1"
                    >
                      {revokingId === device.deviceId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Revoke
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
