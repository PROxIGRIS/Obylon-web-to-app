import { useEffect, useState } from "react";

/**
 * Detects whether the dashboard is running inside a native shell
 * (Capacitor APK or Electron desktop wrapper) so the UI can adjust
 * safe-area padding, hide browser-only chrome, etc.
 */
export type NativeShell = "web" | "capacitor" | "electron";

function detect(): NativeShell {
  if (typeof window === "undefined") return "web";
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
    process?: { versions?: { electron?: string } };
  };
  if (w.Capacitor?.isNativePlatform?.()) return "capacitor";
  if (w.process?.versions?.electron) return "electron";
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) return "electron";
  return "web";
}

export function useNativeShell(): NativeShell {
  const [shell, setShell] = useState<NativeShell>("web");
  useEffect(() => {
    setShell(detect());
  }, []);
  return shell;
}
