/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.obylon.sentinel",
  appName: "Obylon",
  // Built by `node scripts/build-mobile.mjs` — flat folder containing index.html.
  webDir: "dist-mobile",
  backgroundColor: "#1A1918",
  android: {
    backgroundColor: "#1A1918",
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#1A1918",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
