/* Offline support for the installed app. Online: always fetch the newest version and refresh the saved copy.
   Offline: fall back to the saved copy. Outside libraries (fonts, d3) are cache-first since they never change. */
const CACHE = "sl-v10";
const SHELL = ["./", "index.html", "app.css", "app.js", "config.js", "community.js", "diary.js", "today.js", "you.js", "mix.js", "share.js", "player.js", "wrapped.js", "social.js", "tree.js", "map.js", "cities.js", "games.js", "spotify.js",
  "data/artists.json", "data/artists_ext.json", "data/sources_ext.json", "data/releases.json", "data/albums.json", "data/samples.json", "data/journeys.json", "data/sources.json", "data/geo.json", "data/scenes.json", "data/world.json", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url), same = u.origin === location.origin, lib = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (lib) { e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))); return; }
  if (!same) return; // previews, lookups and the API always go straight to the network
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))));
});
