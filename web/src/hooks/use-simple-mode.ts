import { useEffect, useState, useCallback } from "react";

import { setCookie, getCookie } from "@/lib/cookies";

const KEY = "nexus.simpleMode";
const EVT = "nexus:simpleModeChange";

function read(): boolean {
  if (typeof window === "undefined") return false;
  let v = getCookie(KEY);
  if (v === null) {
    v = window.localStorage.getItem(KEY);
  }
  return v === null ? false : v === "1";
}

export function useSimpleMode(): [boolean, (v: boolean) => void] {
  // Always start with the SSR-stable default to avoid hydration mismatch.
  const [simple, setSimple] = useState<boolean>(false);

  useEffect(() => {
    // Sync from localStorage after hydration.
    setSimple(read());
    const onLocal = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      setSimple(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSimple(e.newValue !== "0");
    };
    window.addEventListener(EVT, onLocal as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onLocal as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = useCallback((v: boolean) => {
    setSimple(v);
    if (typeof window !== "undefined") {
      const val = v ? "1" : "0";
      window.localStorage.setItem(KEY, val);
      setCookie(KEY, val);
      // Broadcast to all hook instances in the SAME tab (storage event only fires across tabs).
      window.dispatchEvent(new CustomEvent<boolean>(EVT, { detail: v }));
    }
  }, []);

  return [simple, set];
}

/** Pick label based on simple-mode preference. */
export function label(simple: boolean, plain: string, cinematic: string): string {
  return simple ? plain : cinematic;
}
