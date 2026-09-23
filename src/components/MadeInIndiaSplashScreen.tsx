"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Gauge, Smartphone, Heart } from "lucide-react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export default function MadeInIndiaSplashScreen() {
  const [showSplash, setShowSplash] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Only show on actual initial application launch in this browser session
    const hasLaunched = sessionStorage.getItem("alumni_app_launched");
    if (!hasLaunched) {
      setShowSplash(true);

      // Total splash duration: ~2.8 seconds before smooth transition
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, 2650);

      const finishTimer = setTimeout(() => {
        sessionStorage.setItem("alumni_app_launched", "true");
        setShowSplash(false);
      }, 3100);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(finishTimer);
      };
    }
  }, []);

  // Listen for manual preview trigger from footer / badge
  useEffect(() => {
    const handleManualOpen = () => {
      setIsExiting(false);
      setShowSplash(true);
      const exitTimer = setTimeout(() => setIsExiting(true), 2750);
      const finishTimer = setTimeout(() => setShowSplash(false), 3200);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(finishTimer);
      };
    };
    window.addEventListener("open-made-in-india-splash", handleManualOpen);
    return () => window.removeEventListener("open-made-in-india-splash", handleManualOpen);
  }, []);

  // Fast skip if user taps the screen
  const handleQuickSkip = () => {
    if (showSplash && !isExiting) {
      setIsExiting(true);
      setTimeout(() => {
        sessionStorage.setItem("alumni_app_launched", "true");
        setShowSplash(false);
      }, 300);
    }
  };

  if (!showSplash) return null;

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="made-in-india-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.45, ease: EASE_IN_OUT }}
          onClick={handleQuickSkip}
          className="fixed inset-0 z-[99999] flex flex-col justify-between items-center bg-[#FAF8F5] text-slate-900 select-none overflow-hidden touch-none"
        >
          {/* Subtle Ambient Background Lighting */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Soft saffron glow at top */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-80 rounded-full bg-gradient-to-b from-orange-400/12 via-amber-300/8 to-transparent blur-3xl" />
            {/* Soft emerald glow at bottom */}
            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[120%] h-72 rounded-full bg-gradient-to-t from-emerald-500/10 via-teal-400/6 to-transparent blur-3xl" />
            {/* Subtle center warm aura */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-amber-100/30 blur-2xl" />
          </div>

          {/* Safe Area Container */}
          <div className="relative w-full max-w-md h-full flex flex-col justify-between items-center px-4 sm:px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] z-10">

            {/* ── TOP SECTION: TYPOGRAPHY ── */}
            <div className="w-full text-center flex flex-col items-center pt-1 sm:pt-3">
              {/* Proudly Pill */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
                className="flex items-center justify-center gap-2.5 mb-1.5"
              >
                <span className="w-5 h-[2px] rounded-full bg-orange-500" />
                <span className="text-xs sm:text-sm font-semibold tracking-[0.26em] uppercase text-slate-500">
                  Proudly
                </span>
                <span className="w-5 h-[2px] rounded-full bg-emerald-600" />
              </motion.div>

              {/* Made in India Headline */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22, ease: EASE_OUT }}
                className="flex flex-col items-center"
              >
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] leading-tight">
                  Made in
                </h1>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-none bg-gradient-to-b from-[#EA580C] via-[#F97316] to-[#15803D] bg-clip-text text-transparent drop-shadow-xs">
                  India
                </h2>
              </motion.div>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.4 }}
                className="text-[10px] sm:text-[11px] font-medium tracking-wider uppercase text-slate-400 mt-2 flex items-center justify-center gap-1.5 flex-wrap"
              >
                <span>Indian Hearts</span>
                <span className="text-orange-400">•</span>
                <span>Indian Technology</span>
                <span className="text-emerald-500">•</span>
                <span>For a Better Tomorrow</span>
              </motion.p>
            </div>

            {/* ── CENTER SECTION: 3D MAP + BRUSHSTROKES + CHAKRA + LANDMARKS ── */}
            <div className="relative w-full flex-1 max-h-[38vh] sm:max-h-[42vh] flex items-center justify-center my-auto">

              {/* Background Flowing Tricolour Brush Strokes */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.85, delay: 0.35, ease: EASE_OUT }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <svg
                  viewBox="0 0 400 360"
                  className="w-full h-full max-w-[340px] max-h-[300px] overflow-visible"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="saffronBrush" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.85" />
                      <stop offset="60%" stopColor="#FB923C" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#FDBA74" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="greenBrush" x1="100%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#15803D" stopOpacity="0.8" />
                      <stop offset="60%" stopColor="#22C55E" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#86EFAC" stopOpacity="0" />
                    </linearGradient>
                    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="8" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Top-left swooshing saffron sweep */}
                  <path
                    d="M 60 180 C 70 110, 140 60, 240 70 C 310 75, 360 120, 370 140 C 340 100, 260 65, 170 80 C 100 90, 70 140, 60 180 Z"
                    fill="url(#saffronBrush)"
                    filter="url(#softGlow)"
                  />
                  {/* Bottom-left to right emerald sweep */}
                  <path
                    d="M 40 210 C 65 240, 110 280, 210 270 C 290 260, 340 210, 360 190 C 320 230, 250 260, 170 255 C 100 250, 60 225, 40 210 Z"
                    fill="url(#greenBrush)"
                    filter="url(#softGlow)"
                  />
                </svg>
              </motion.div>

              {/* 3D Map of India Vector Composition */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.45, ease: EASE_OUT }}
                className="relative z-10 w-full max-w-[280px] sm:max-w-[310px] aspect-[1/1.05] flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 320 340"
                  className="w-full h-full drop-shadow-[0_16px_24px_rgba(234,88,12,0.18)] drop-shadow-[0_4px_10px_rgba(15,23,42,0.08)]"
                >
                  <defs>
                    {/* Tricolour vertical gradient with 3D bevel lighting */}
                    <linearGradient id="mapTricolour" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#EA580C" />
                      <stop offset="34%" stopColor="#F97316" />
                      <stop offset="36%" stopColor="#FFFFFF" />
                      <stop offset="64%" stopColor="#FFFFFF" />
                      <stop offset="66%" stopColor="#16A34A" />
                      <stop offset="100%" stopColor="#15803D" />
                    </linearGradient>

                    {/* 3D Emboss Edge Highlights */}
                    <linearGradient id="mapBevel" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
                      <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
                      <stop offset="70%" stopColor="#0F172A" stopOpacity="0" />
                      <stop offset="100%" stopColor="#0F172A" stopOpacity="0.25" />
                    </linearGradient>

                    {/* Skyline warm sunset gradient */}
                    <linearGradient id="skylineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#D97706" stopOpacity="0.75" />
                      <stop offset="50%" stopColor="#92400E" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#78350F" stopOpacity="0.4" />
                    </linearGradient>

                    {/* Water reflection soft fade */}
                    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#FAF8F5" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* 3D Map Base Shadow Layer */}
                  <path
                    d="M 152 24 C 158 14, 168 14, 172 24 C 180 32, 192 36, 190 46 C 188 56, 176 66, 184 76 C 196 82, 218 80, 228 92 C 242 108, 270 106, 276 122 C 284 140, 268 152, 272 164 C 276 178, 252 188, 240 184 C 230 180, 224 190, 216 196 C 206 208, 202 230, 192 248 C 182 266, 174 290, 164 306 C 160 312, 154 312, 150 306 C 140 290, 132 266, 122 248 C 112 230, 108 208, 98 196 C 88 186, 74 180, 68 170 C 60 156, 52 144, 58 128 C 66 112, 84 116, 96 104 C 104 94, 120 90, 128 78 C 136 66, 144 38, 152 24 Z"
                    fill="#0F172A"
                    fillOpacity="0.06"
                    transform="translate(0, 6)"
                  />

                  {/* Main India Stylized 3D Map Body */}
                  <path
                    d="M 152 24 C 158 14, 168 14, 172 24 C 180 32, 192 36, 190 46 C 188 56, 176 66, 184 76 C 196 82, 218 80, 228 92 C 242 108, 270 106, 276 122 C 284 140, 268 152, 272 164 C 276 178, 252 188, 240 184 C 230 180, 224 190, 216 196 C 206 208, 202 230, 192 248 C 182 266, 174 290, 164 306 C 160 312, 154 312, 150 306 C 140 290, 132 266, 122 248 C 112 230, 108 208, 98 196 C 88 186, 74 180, 68 170 C 60 156, 52 144, 58 128 C 66 112, 84 116, 96 104 C 104 94, 120 90, 128 78 C 136 66, 144 38, 152 24 Z"
                    fill="url(#mapTricolour)"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />

                  {/* 3D Bevel Edge Overlay */}
                  <path
                    d="M 152 24 C 158 14, 168 14, 172 24 C 180 32, 192 36, 190 46 C 188 56, 176 66, 184 76 C 196 82, 218 80, 228 92 C 242 108, 270 106, 276 122 C 284 140, 268 152, 272 164 C 276 178, 252 188, 240 184 C 230 180, 224 190, 216 196 C 206 208, 202 230, 192 248 C 182 266, 174 290, 164 306 C 160 312, 154 312, 150 306 C 140 290, 132 266, 122 248 C 112 230, 108 208, 98 196 C 88 186, 74 180, 68 170 C 60 156, 52 144, 58 128 C 66 112, 84 116, 96 104 C 104 94, 120 90, 128 78 C 136 66, 144 38, 152 24 Z"
                    fill="url(#mapBevel)"
                    style={{ mixBlendMode: "overlay" }}
                  />

                  {/* Ashoka Chakra in Center (White Band) */}
                  <g transform="translate(160, 166)">
                    {/* Subtle outer navy ring */}
                    <circle cx="0" cy="0" r="17" fill="none" stroke="#000080" strokeWidth="1.6" />
                    {/* Inner navy hub */}
                    <circle cx="0" cy="0" r="3.2" fill="#000080" />
                    {/* 24 Precise Spokes */}
                    {Array.from({ length: 24 }).map((_, i) => {
                      const angle = (i * 15 * Math.PI) / 180;
                      const x2 = 16.5 * Math.cos(angle);
                      const y2 = 16.5 * Math.sin(angle);
                      return (
                        <line
                          key={i}
                          x1="0"
                          y1="0"
                          x2={x2}
                          y2={y2}
                          stroke="#000080"
                          strokeWidth="0.8"
                        />
                      );
                    })}
                  </g>

                  {/* ── INDIAN LANDMARK SILHOUETTE SKYLINE ── */}
                  <g transform="translate(0, 236)" opacity="0.88">
                    {/* Water base reflection */}
                    <rect x="20" y="52" width="280" height="24" fill="url(#waterGrad)" rx="6" />

                    {/* Qutub Minar Silhouette (Left) */}
                    <path
                      d="M 58 52 L 62 14 L 64 14 L 68 52 Z M 61 24 L 65 24 M 60 34 L 66 34 M 59 44 L 67 44"
                      fill="url(#skylineGrad)"
                      stroke="#78350F"
                      strokeWidth="0.5"
                    />

                    {/* Red Fort / Domes Silhouette Accent */}
                    <path
                      d="M 88 52 L 88 40 C 88 34, 96 34, 96 40 L 96 52 M 100 52 L 100 36 C 104 28, 114 28, 118 36 L 118 52"
                      fill="url(#skylineGrad)"
                    />

                    {/* India Gate (Center) */}
                    <g transform="translate(136, 0)">
                      {/* Top Attic & Cornice */}
                      <rect x="4" y="16" width="40" height="6" fill="url(#skylineGrad)" rx="1" />
                      <rect x="8" y="11" width="32" height="5" fill="url(#skylineGrad)" rx="0.5" />
                      {/* Left and right pillars */}
                      <rect x="6" y="22" width="10" height="30" fill="url(#skylineGrad)" />
                      <rect x="32" y="22" width="10" height="30" fill="url(#skylineGrad)" />
                      {/* Archway curved opening */}
                      <path
                        d="M 16 52 L 16 35 C 16 28, 32 28, 32 35 L 32 52 Z"
                        fill="#FAF8F5"
                        opacity="0.9"
                      />
                      {/* Warm golden light inside India Gate arch */}
                      <circle cx="24" cy="38" r="8" fill="#F59E0B" opacity="0.4" />
                    </g>

                    {/* Taj Mahal Silhouette (Right) */}
                    <g transform="translate(202, 10)">
                      {/* Left slender minaret */}
                      <path d="M 6 42 L 8 16 L 9 16 L 11 42 Z" fill="url(#skylineGrad)" />
                      {/* Right slender minaret */}
                      <path d="M 69 42 L 71 16 L 72 16 L 74 42 Z" fill="url(#skylineGrad)" />
                      {/* Main central building & plinth */}
                      <rect x="18" y="24" width="44" height="18" fill="url(#skylineGrad)" />
                      {/* Central iconic onion dome & finial */}
                      <path
                        d="M 32 24 C 30 14, 36 6, 40 2 C 44 6, 50 14, 48 24 Z"
                        fill="url(#skylineGrad)"
                      />
                      <line x1="40" y1="2" x2="40" y2="-3" stroke="#92400E" strokeWidth="1" />
                      {/* Side smaller domes */}
                      <path d="M 23 24 C 23 18, 29 18, 29 24 Z" fill="url(#skylineGrad)" />
                      <path d="M 51 24 C 51 18, 57 18, 57 24 Z" fill="url(#skylineGrad)" />
                      {/* Grand Arch doorway */}
                      <path d="M 34 42 L 34 32 C 34 28, 46 28, 46 32 L 46 42 Z" fill="#FAF8F5" opacity="0.8" />
                    </g>
                  </g>
                </svg>
              </motion.div>
            </div>

            {/* ── LOWER SECTION: SUPPORTING TEXT + 4 HIGHLIGHTS ── */}
            <div className="w-full flex flex-col items-center pb-2">

              {/* Supporting Text */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.65, ease: EASE_OUT }}
                className="text-center mb-4 sm:mb-5"
              >
                <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-snug">
                  Built by Indians,
                  <br />
                  <span className="text-slate-600 font-semibold">for the world.</span>
                </h3>

                {/* Subtle Tricolour Accent Line */}
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <span className="w-4 h-1 rounded-full bg-orange-500" />
                  <span className="w-4 h-1 rounded-full bg-white border border-slate-300/80 shadow-2xs" />
                  <span className="w-4 h-1 rounded-full bg-emerald-600" />
                </div>
              </motion.div>

              {/* 4 Feature Highlights Grid */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8, ease: EASE_OUT }}
                className="w-full max-w-sm grid grid-cols-4 gap-1.5 sm:gap-2 px-1 text-center"
              >
                {/* 1. Secure & Reliable */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center text-blue-600 mb-1">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                    Secure &amp; Reliable
                  </span>
                </div>

                {/* 2. Fast Performance */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center text-amber-600 mb-1">
                    <Gauge className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                    Fast Performance
                  </span>
                </div>

                {/* 3. Made for Indian Users */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center text-emerald-600 mb-1">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                    Made for Indian Users
                  </span>
                </div>

                {/* 4. Support Local Business */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center text-rose-500 mb-1">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-50" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                    Support Local
                  </span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── BOTTOM DECORATION: SMOOTH CURVED TRICOLOUR WAVE ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: EASE_OUT }}
            className="w-full relative h-10 sm:h-12 overflow-hidden pointer-events-none shrink-0"
          >
            <svg
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <defs>
                <linearGradient id="waveSaffron" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EA580C" />
                  <stop offset="50%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#FB923C" />
                </linearGradient>
                <linearGradient id="waveGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#15803D" />
                  <stop offset="50%" stopColor="#16A34A" />
                  <stop offset="100%" stopColor="#22C55E" />
                </linearGradient>
              </defs>

              {/* Bottom Green Layer */}
              <path
                d="M 0,60 C 300,10 600,90 900,40 C 1050,15 1150,50 1200,60 L 1200,120 L 0,120 Z"
                fill="url(#waveGreen)"
                opacity="0.95"
              />

              {/* Middle Crisp White Stripe */}
              <path
                d="M 0,42 C 300,-8 600,72 900,22 C 1050,-3 1150,32 1200,42 L 1200,58 C 1150,48 1050,13 900,38 C 600,88 300,8 0,58 Z"
                fill="#FFFFFF"
                opacity="0.98"
              />

              {/* Upper Saffron Layer */}
              <path
                d="M 0,25 C 300,-25 600,55 900,5 C 1050,-20 1150,15 1200,25 L 1200,42 C 1150,32 1050,-3 900,22 C 600,72 300,-8 0,42 Z"
                fill="url(#waveSaffron)"
                opacity="0.95"
              />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
