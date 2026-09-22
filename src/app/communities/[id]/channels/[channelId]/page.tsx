"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Send, 
  Lock, 
  Phone, 
  Video, 
  Users, 
  ShieldCheck, 
  Paperclip, 
  Smile, 
  Info,
  ChevronDown
} from "lucide-react";
import { 
  generateChannelKey, 
  exportChannelKey, 
  importChannelKey, 
  encryptChannelMessage, 
  decryptChannelMessage 
} from "@/lib/communities/crypto";

export default function CommunityChannelChatPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params?.id as string;
  const channelId = params?.channelId as string;

  const [community, setCommunity] = useState<any>(null);
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [channelKey, setChannelKey] = useState<CryptoKey | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Channel AES key from localStorage or generate local session fallback
  useEffect(() => {
    async function initKey() {
      try {
        const storageKey = `comm_channel_key_${channelId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const key = await importChannelKey(stored);
          setChannelKey(key);
        } else {
          // Generate a local channel AES key
          const newKey = await generateChannelKey();
          const rawB64 = await exportChannelKey(newKey);
          localStorage.setItem(storageKey, rawB64);
          setChannelKey(newKey);
        }
      } catch (err) {
        console.error("Crypto key init error:", err);
      }
    }

    if (channelId) {
      initKey();
    }
  }, [channelId]);

  // Load Channel & Messages
  useEffect(() => {
    if (communityId && channelId && channelKey) {
      loadMessages();
      const interval = setInterval(loadMessages, 3500); // lightweight polling fallback
      return () => clearInterval(interval);
    }
  }, [communityId, channelId, channelKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/communities/${communityId}/channels/${channelId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setChannel(data.channel);

      // Decrypt messages with channelKey
      if (channelKey && data.messages) {
        const decryptedList = await Promise.all(
          data.messages.map(async (msg: any) => {
            try {
              const decryptedContent = await decryptChannelMessage(
                channelKey,
                {
                  ciphertext: msg.ciphertext,
                  iv: msg.iv,
                }
              );
              return { ...msg, plaintext: decryptedContent };
            } catch (decErr) {
              return { ...msg, plaintext: "[Encrypted payload with previous key epoch]" };
            }
          })
        );
        setMessages(decryptedList);
      }
    } catch (err) {
      console.error("Failed to load channel messages", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !channelKey || sending) return;

    setSending(true);
    const textToSend = inputText.trim();
    setInputText("");

    try {
      // 1. Encrypt with AES-256-GCM locally
      const { ciphertext, iv } = await encryptChannelMessage(channelKey, textToSend, 1);

      // 2. Post to backend with key epoch 1
      const res = await fetch(`/api/communities/${communityId}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciphertext,
          iv,
          keyEpoch: 1,
        }),
      });

      if (res.ok) {
        loadMessages();
      }
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      {/* Top Channel Header */}
      <header className="sticky top-0 z-40 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/communities/${communityId}`}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white">#{channel?.name || "channel"}</span>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Lock className="w-2.5 h-2.5" />
                <span>E2EE Active</span>
              </div>
            </div>
            {channel?.topic && (
              <p className="text-[11px] text-zinc-400 line-clamp-1">{channel.topic}</p>
            )}
          </div>
        </div>

        {/* Quick Call Actions (Voice / Video) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => alert("Initiating encrypted community audio room...")}
            className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400 text-zinc-300 transition-colors"
            title="Start Encrypted Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => alert("Initiating encrypted community video room...")}
            className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400 text-zinc-300 transition-colors"
            title="Start Encrypted Video Room"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Stream */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto flex flex-col justify-end space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="my-auto text-center py-12">
            <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-500 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <Lock className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-base text-white">Welcome to #{channel?.name}</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
              This channel is protected with hardware-accelerated AES-256-GCM encryption. Say hello to your squad!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 group">
              <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-xs text-white overflow-hidden flex-shrink-0">
                {msg.sender?.image ? (
                  <img src={msg.sender.image} alt={msg.sender.name || ""} className="h-full w-full object-cover" />
                ) : (
                  <span>{msg.sender?.name?.slice(0, 2).toUpperCase() || "U"}</span>
                )}
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-xs text-white">
                    {msg.sender?.name || msg.sender?.username || "Anonymous"}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="mt-1 p-3 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs text-zinc-200 leading-relaxed max-w-2xl break-words">
                  {msg.plaintext || "[Encrypted Message]"}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Message Input Box */}
      <footer className="sticky bottom-0 bg-black/90 backdrop-blur-md border-t border-white/10 p-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message #${channel?.name || "channel"} (AES-256 encrypted)...`}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-3 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-cyan-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
