"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { realtimeSignaling } from "@/lib/e2ee/signaling";
import {
  getOrCreateDeviceIdentity,
  addLocalConnectedPeer,
  setActiveVaultUser,
  VaultMessage,
} from "@/lib/e2ee/vault";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, UserPlus, CheckCircle2, X } from "lucide-react";
import { triggerHaptic } from "@/lib/motion/tokens";

interface ToastNotification {
  id: string;
  type: "MESSAGE" | "CONNECTION_REQUEST" | "CONNECTION_ACCEPTED";
  title: string;
  subtitle: string;
  actionUrl?: string;
  actionLabel?: string;
  senderId?: string;
  senderUsername?: string | null;
  senderName?: string;
}

export default function GlobalRealtimeProvider() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [activeToast, setActiveToast] = useState<ToastNotification | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotificationToast = (toast: ToastNotification, durationMs = 6000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    triggerHaptic("medium");
    setActiveToast(toast);
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, durationMs);
  };

  const handleToastAccept = async (e: React.MouseEvent, senderId: string, senderName: string) => {
    e.stopPropagation();
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: senderId, action: "ACCEPT" }),
      });
      if (res.ok) {
        addLocalConnectedPeer(senderId);
        triggerHaptic("success");
        window.dispatchEvent(new CustomEvent("connection-requests-updated"));
        window.dispatchEvent(new CustomEvent("vault-messages-updated", { detail: { peerId: senderId } }));

        showNotificationToast({
          id: `acc_${Date.now()}`,
          type: "CONNECTION_ACCEPTED",
          title: "Connected!",
          subtitle: `You and ${senderName} can now exchange encrypted messages.`,
          actionUrl: `/messages/${senderId}`,
          actionLabel: "Chat",
        }, 5000);
      }
    } catch (err) {
      console.error("Accept from toast error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToastReject = async (e: React.MouseEvent, senderId: string) => {
    e.stopPropagation();
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: senderId, action: "REJECT" }),
      });
      triggerHaptic("light");
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
      setActiveToast(null);
    } catch (err) {
      console.error("Reject from toast error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToastViewProfile = (e: React.MouseEvent, senderUsername?: string | null, senderId?: string) => {
    e.stopPropagation();
    if (senderUsername) {
      router.push(`/profile/${senderUsername}`);
    } else if (senderId) {
      router.push(`/profile/${senderId}`);
    } else {
      router.push("/messages");
    }
    setActiveToast(null);
  };

  // One-time bootstrap ref — prevents re-running on navigation (pathname changes).
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;

    let unsubs: (() => void)[] = [];

    async function bootstrapRealtime() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) return;
        const meData = await meRes.json();
        if (!meData.authenticated || !meData.user) return;

        const user = meData.user;
        setActiveVaultUser(user.id);
        setCurrentUser({ id: user.id, name: user.name });

        // 1. Get or create cryptographic identity
        const localIdentity = await getOrCreateDeviceIdentity(user.id);

        // 2. Register device public key on server for asynchronous E2EE key discovery
        fetch("/api/messages/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: localIdentity.deviceId,
            deviceName: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 50) : "Web Device",
            publicKey: localIdentity.publicKeySpki,
          }),
        }).catch(() => {});

        // 3. Initialize Realtime Signaling channel (subscribed globally across whole app)
        realtimeSignaling.init(user.id, user.name, localIdentity.privateKey);

        // 4. Drain any pending offline messages from server queue
        await realtimeSignaling.drainPendingQueue();

        // 0. Register Service Worker & Request Notification Permission for offline mobile alerts
        if (typeof window !== "undefined") {
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(() => {});
          }
          if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
          }
        }

        // 5. Global Message Received Listener
        // Read window.location.pathname live so we never need to re-subscribe on navigation.
        const unsubMsg = realtimeSignaling.onMessageReceived((msg: VaultMessage) => {
          addLocalConnectedPeer(msg.senderId);

          // Dispatch event so messages hub / conversations list refreshes
          window.dispatchEvent(new CustomEvent("vault-messages-updated", { detail: { peerId: msg.senderId } }));

          // If user is NOT currently inside the specific chat with this sender
          const isCurrentlyInChat = window.location.pathname === `/messages/${msg.senderId}`;
          if (!isCurrentlyInChat) {
            const senderName = msg.senderName || "A user";
            const notificationTitle = `${senderName} is sms you`;
            const notificationBody = "Tap and see sms";

            // In-app interactive toast
            showNotificationToast({
              id: `toast_${Date.now()}`,
              type: "MESSAGE",
              title: notificationTitle,
              subtitle: notificationBody,
              actionUrl: `/messages/${msg.senderId}`,
              actionLabel: "Open",
            });

            // Native mobile OS notification
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(notificationTitle, {
                    body: notificationBody,
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/icon-192x192.png",
                    vibrate: [200, 100, 200],
                    tag: `chat_${msg.senderId}`,
                    renotify: true,
                    data: {
                      url: `/messages/${msg.senderId}`,
                    },
                  } as any);
                }).catch(() => {
                  try {
                    const notif = new Notification(notificationTitle, {
                      body: notificationBody,
                      icon: "/icons/icon-192x192.png",
                    });
                    notif.onclick = () => {
                      window.focus();
                      router.push(`/messages/${msg.senderId}`);
                    };
                  } catch {}
                });
              } else {
                try {
                  const notif = new Notification(notificationTitle, {
                    body: notificationBody,
                    icon: "/icons/icon-192x192.png",
                  });
                  notif.onclick = () => {
                    window.focus();
                    router.push(`/messages/${msg.senderId}`);
                  };
                } catch {}
              }
            }
          }
        });
        unsubs.push(unsubMsg);

        // 6. Global Connection Request Listener
        const unsubReq = realtimeSignaling.onConnectionRequest((req) => {
          window.dispatchEvent(new CustomEvent("connection-requests-updated"));
          showNotificationToast({
            id: `req_${Date.now()}`,
            type: "CONNECTION_REQUEST",
            title: "New Connection Request",
            subtitle: `${req.senderName} sent you a connection request.`,
            senderId: req.senderId,
            senderUsername: req.senderUsername,
            senderName: req.senderName,
            actionUrl: req.senderUsername ? `/profile/${req.senderUsername}` : `/profile/${req.senderId}`,
            actionLabel: "View",
          }, 10000); // 10s display for actionable request
        });
        unsubs.push(unsubReq);

        // 7. Global Connection Accepted Listener (unsubs.push was missing before — fixed!)
        const unsubAcc = realtimeSignaling.onConnectionAccepted((acc) => {
          addLocalConnectedPeer(acc.peerId);
          window.dispatchEvent(new CustomEvent("connection-requests-updated"));
          window.dispatchEvent(new CustomEvent("vault-messages-updated", { detail: { peerId: acc.peerId } }));

          showNotificationToast({
            id: `acc_${Date.now()}`,
            type: "CONNECTION_ACCEPTED",
            title: "Connection Accepted",
            subtitle: `You are now connected with ${acc.peerName}.`,
            actionUrl: `/messages/${acc.peerId}`,
            actionLabel: "Chat",
          });
        });
        unsubs.push(unsubAcc); // ← was missing, causing listener leak

        // 8. Auto-drain queue on focus and network reconnect
        const handleFocusOrOnline = () => {
          realtimeSignaling.drainPendingQueue().catch(() => {});
          window.dispatchEvent(new CustomEvent("connection-requests-updated"));
        };
        window.addEventListener("focus", handleFocusOrOnline);
        window.addEventListener("online", handleFocusOrOnline);
        unsubs.push(() => {
          window.removeEventListener("focus", handleFocusOrOnline);
          window.removeEventListener("online", handleFocusOrOnline);
        });

        bootstrappedRef.current = true;
      } catch (err) {
        console.warn("Global realtime bootstrap notice:", err);
      }
    }

    bootstrapRealtime();

    return () => {
      unsubs.forEach((fn) => fn());
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []); // ← empty deps: run once on mount only, not on every pathname change

  return (
    <AnimatePresence>
      {activeToast && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900/95 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md border border-slate-700/80 cursor-pointer ${
            activeToast.type === "CONNECTION_REQUEST" ? "space-y-3" : "flex items-center justify-between gap-3"
          }`}
          onClick={() => {
            if (activeToast.actionUrl) {
              router.push(activeToast.actionUrl);
              setActiveToast(null);
            }
          }}
        >
          {activeToast.type === "CONNECTION_REQUEST" ? (
            /* Connection Request Card with View Profile, Accept, and Reject */
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-100 truncate">{activeToast.title}</p>
                    <p className="text-[12px] text-slate-300 font-medium truncate">{activeToast.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveToast(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Buttons: [View Profile] [Reject] [Accept] */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => handleToastViewProfile(e, activeToast.senderUsername, activeToast.senderId)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/80 transition text-center"
                >
                  View Profile
                </button>
                {activeToast.senderId && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={(e) => handleToastReject(e, activeToast.senderId!)}
                      className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 text-xs font-semibold border border-slate-700/60 transition"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={(e) => handleToastAccept(e, activeToast.senderId!, activeToast.senderName || "User")}
                      className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/40 transition active:scale-95"
                    >
                      Accept
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            /* Regular Message & Accepted Toast Card */
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                  {activeToast.type === "MESSAGE" && <MessageSquare className="w-5 h-5 text-blue-400" />}
                  {activeToast.type === "CONNECTION_ACCEPTED" && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-100 truncate">{activeToast.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{activeToast.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeToast.actionLabel && (
                  <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-800/80 px-2.5 py-1 rounded-lg">
                    {activeToast.actionLabel}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveToast(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
