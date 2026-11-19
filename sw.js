/* Iron Bunker – offline support. Online hone pe hamesha latest version load hota hai. */
const CACHE = "ib-cache-v2";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(key, res) {
  if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return; // cloud sync, Telegram etc. seedha network pe

  // Pages + config: network first, offline me cache
  if (req.mode === "navigate" || (sameOrigin && url.pathname.endsWith("config.json"))) {
    const key = url.origin + url.pathname;
    e.respondWith(
      fetch(req).then(res => put(key, res)).catch(() =>
        caches.match(key).then(r => r ||
          (req.mode === "navigate" && /\/(index\.html)?$/.test(url.pathname) ? caches.match("./index.html") : undefined) ||
          Response.error())
      )
    );
    return;
  }

  // Fonts, icons: cache first, background refresh
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
