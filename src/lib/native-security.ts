import { Capacitor } from "@capacitor/core";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";

export async function setNativeScreenshotAllowed(allowed: boolean) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (allowed) {
      await PrivacyScreen.disable();
    } else {
      await PrivacyScreen.enable();
    }
  } catch (err) {
    console.error("Native privacy screen error:", err);
  }
}
