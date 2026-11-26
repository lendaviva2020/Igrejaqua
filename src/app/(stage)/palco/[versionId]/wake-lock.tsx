"use client";

import { useEffect } from "react";

/** Mantém a tela acesa enquanto o Stage está aberto (Wake Lock API, quando disponível). */
export function WakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async (): Promise<void> => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          const s = await navigator.wakeLock.request("screen");
          if (cancelled) await s.release();
          else sentinel = s;
        }
      } catch {
        // Negado pelo navegador ou bateria baixa: o Stage continua funcionando.
      }
    };
    void acquire();
    const onVisible = (): void => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); void sentinel?.release(); };
  }, []);
  return null;
}
