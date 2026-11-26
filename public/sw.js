/* Service worker do IGREJAQUA (docs/SECURITY.md §9).
 * Cacheia SOMENTE: shell estático (/_next/static, /icons), a página /offline e as páginas do Modo Palco
 * que o usuário abriu. Nenhuma outra resposta autenticada é guardada. O logout envia CLEAR_CACHES. */
const VERSION = "v1";
const STATIC_CACHE = `iq-static-${VERSION}`;
const STAGE_CACHE = `iq-stage-${VERSION}`;
const OFFLINE_URL = "/offline";
const STAGE_PATH = /^\/palco\/[0-9a-f-]{36}$/i;
const MAX_STAGE_ENTRIES = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("iq-") && k !== STATIC_CACHE && k !== STAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("iq-")).map((k) => caches.delete(k)))).then(() => caches.open(STATIC_CACHE)).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))).catch(() => undefined));
  }
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function offlineFallback() {
  const cache = await caches.open(STATIC_CACHE);
  return (await cache.match(OFFLINE_URL)) || Response.error();
}

async function stageNetworkFirst(request) {
  const cache = await caches.open(STAGE_CACHE);
  try {
    const response = await fetch(request);
    // Só guarda resposta autêntica da própria página (sem redirecionamento para o login).
    if (response.ok && !response.redirected) {
      await cache.put(request, response.clone());
      await trimCache(STAGE_CACHE, MAX_STAGE_ENTRIES);
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await offlineFallback());
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    if (STAGE_PATH.test(url.pathname)) {
      event.respondWith(stageNetworkFirst(request));
      return;
    }
    event.respondWith(fetch(request).catch(offlineFallback));
  }
});
