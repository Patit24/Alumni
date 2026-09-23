"use client";

import { useState, useEffect } from "react";

export default function NavbarUserAvatar({
  name,
  userId,
  initialAvatarUrl,
}: {
  name: string;
  userId: string;
  initialAvatarUrl?: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined" && userId) {
      return initialAvatarUrl || localStorage.getItem(`alumni_avatar_${userId}`) || null;
    }
    return initialAvatarUrl || null;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    const cached = localStorage.getItem(`alumni_avatar_${userId}`);
    if (cached) setAvatarUrl(cached);

    const onUpdate = (e: any) => {
      if (e.detail?.avatarUrl) {
        setAvatarUrl(e.detail.avatarUrl);
      }
    };
    window.addEventListener("profile-updated", onUpdate);
    return () => window.removeEventListener("profile-updated", onUpdate);
  }, [userId, initialAvatarUrl]);

  return (
    <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
