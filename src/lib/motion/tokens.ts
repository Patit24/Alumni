/**
 * 2026 Mobile Motion Design System Tokens & Utilities
 * Physics-based animation configurations and haptic feedback
 */

export const MOTION_DURATIONS = {
  FAST: 0.15,      // 150ms - Micro-interactions, button taps, toggles
  STANDARD: 0.25,  // 250ms - Cards, dialogs, standard transitions
  EMPHASIS: 0.35,  // 350ms - Modals, drawer sheets, full-screen changes
  DELIBERATE: 0.5, // 500ms - Long-press activation, celebrations
} as const;

export const MOTION_SPRINGS = {
  // Snappy: For buttons, active pills, toggles
  snappy: {
    type: "spring" as const,
    stiffness: 500,
    damping: 30,
    mass: 0.8,
  },
  // Bouncy: For reactions, badges, confirmations
  bouncy: {
    type: "spring" as const,
    stiffness: 400,
    damping: 20,
    mass: 1,
  },
  // Gentle: For bottom sheets, page transitions, drawers
  gentle: {
    type: "spring" as const,
    stiffness: 260,
    damping: 28,
    mass: 1,
  },
  // Fluid: For gesture dragging and physics release
  fluid: {
    type: "spring" as const,
    stiffness: 300,
    damping: 24,
  },
  // Heavy: For swipe-to-reply return
  heavy: {
    type: "spring" as const,
    stiffness: 350,
    damping: 32,
  },
};

export const MOTION_EASINGS = {
  easeOut: [0.16, 1, 0.3, 1],    // Starts instantly, settles softly
  easeIn: [0.7, 0, 0.84, 0],     // Exiting elements
  easeInOut: [0.65, 0, 0.35, 1], // Symmetrical movement
};

/**
 * Trigger light, non-intrusive mobile haptic feedback if supported by browser/device
 */
export function triggerHaptic(type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    switch (type) {
      case "light":
        navigator.vibrate(8);
        break;
      case "medium":
        navigator.vibrate(18);
        break;
      case "heavy":
        navigator.vibrate(28);
        break;
      case "success":
        navigator.vibrate([10, 30, 15]);
        break;
      case "warning":
        navigator.vibrate([15, 40, 20]);
        break;
      case "error":
        navigator.vibrate([20, 50, 20, 50, 30]);
        break;
    }
  } catch {
    // Gracefully ignore if blocked by browser permissions
  }
}
