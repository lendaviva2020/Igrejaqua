/** Pede ao service worker que apague os caches (logout: docs/SECURITY.md §9). Nunca lança. */
export function clearOfflineCaches(): void {
  try {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHES" });
  } catch {
    /* sem service worker ativo: nada a limpar */
  }
}
