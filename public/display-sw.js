// Service worker for the public TV display (/display/:code).
// Caches the app shell + recently-played media so screens keep showing content
// when the internet drops. Only registered from the DisplayScreen page.
const CACHE = "doctorsbuddy-display-v1";
const SHELL = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache Supabase API/auth/realtime
  if (url.hostname.includes("supabase.co") && !url.pathname.startsWith("/storage/")) return;

  // Cache-first for media (videos/images), network-first for everything else
  const isMedia = /\.(mp4|webm|jpg|jpeg|png|webp|gif|svg|woff2?)$/i.test(url.pathname)
    || url.pathname.includes("/storage/v1/object/public/");

  if (isMedia) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && req.mode === "navigate") {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch {
      const cached = await caches.match(req);
      return cached || caches.match("/index.html");
    }
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
  if (e.data === "clear-cache") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
