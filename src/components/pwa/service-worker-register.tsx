"use client";

import { useEffect } from "react";

/** Registra o service worker apenas em produção (em dev o cache atrapalharia o HMR). */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      console.error("Falha ao registrar o service worker", error);
    });
  }, []);
  return null;
}
