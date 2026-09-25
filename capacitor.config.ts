import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alumni.app",
  appName: "Samparka",
  webDir: "public",
  server: {
    url: "https://alumni-pink.vercel.app",
    cleartext: false,
  },
  plugins: {
    PrivacyScreen: {
      enable: true,
      preventScreenshots: true,
    },
  },
};

export default config;
