import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alumni.app",
  appName: "Alumni",
  webDir: "public",
  server: {
    url: "https://alumni-pink.vercel.app",
    cleartext: false,
  },
  plugins: {
    PrivacyScreen: {
      enable: true,
    },
  },
};

export default config;
