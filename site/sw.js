/* Offline support for the installed app: serve the shell and data from cache, refresh in the background. */
const CACHE = "sl-v8";
const SHELL = ["./", "index.html", "app.css", "app.js", "today.js", "you.js", "mix.js", "share.js", "player.js", "wrapped.js", "social.js", "tree.js", "map.js", "cities.js", "games.js", "spotify.js",
  "data/artists.json", "data/artists_ext.json", "data/sources_ext.json", "data/releases.json", "data/albums.json", "data/samples.json", "data/journeys.json", "data/sources.json", "data/geo.json", "data/scenes.json", "data/world.json", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const same = u.origin === location.origin, lib = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (!same && !lib) return; // previews and lookups always go to the network
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: same });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
