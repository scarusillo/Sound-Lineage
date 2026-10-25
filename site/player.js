/* The player: 30-second previews from Apple's public iTunes catalog, queued in lineage order,
   so you hear where a sound came from and where it went. Cover art comes back with each preview.
   Inside Claude the page can't reach outside audio, so the same queue opens songs in Spotify instead. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const enc = encodeURIComponent;
  const canPreview = () => !window.claude?.use;
  const audio = new Audio();
  audio.preload = "auto"; audio.crossOrigin = "anonymous";
  let Q = [], idx = -1, title = "", busy = 0;

  /* ---------- lookups ---------- */
  const cache = () => C().store.get("sl.pv", {});
  const ckey = (name, song) => `${C().norm(name)}|${C().norm(song || "")}`;
  async function lookup(name, song) {
    const k = ckey(name, song), all = cache();
    if (all[k] !== undefined) return all[k];
    let hit = null;
    try {
      const term = song ? `${name} ${song}` : name;
      const r = await fetch(`https://itunes.apple.com/search?term=${enc(term)}&entity=song&limit=8&media=music`);
      const d = await r.json(), n = C().norm(name);
      const res = (d.results || []).filter((x) => x.previewUrl);
      const same = res.filter((x) => C().norm(x.artistName).includes(n) || n.includes(C().norm(x.artistName)));
      const pick = (song && same.find((x) => C().norm(x.trackName).startsWith(C().norm(song)))) || same[0] || (song ? null : res[0]);
      if (pick) hit = { u: pick.previewUrl, art: (pick.artworkUrl100 || "").replace("100x100bb", "300x300bb"), t: pick.trackName, a: pick.artistName, al: pick.collectionName, link: pick.trackViewUrl, y: (pick.releaseDate || "").slice(0, 4) };
    } catch { return null; }
    const now = cache(); now[k] = hit; const keys = Object.keys(now); if (keys.length > 1500) delete now[keys[0]];
    C().store.set("sl.pv", now);
    return hit;
  }
  const artLookup = (id) => { const a = C().A[id]; return a ? lookup(a.name, (a.songs || [])[0]) : Promise.resolve(null); };

  /* ---------- queues ---------- */
  function lineageItems(id) {
    const ctx = C(), A = ctx.A, a = A[id];
    const byDec = (x, y) => ctx.decIdx(A[x.id].decade) - ctx.decIdx(A[y.id].decade);
    const roots = ctx.sortRel(a.up).filter((r) => !A[r.id].role).slice(0, 4).sort(byDec);
    const heirs = ctx.sortRel(a.down).filter((r) => !A[r.id].role).slice(0, 5).sort(byDec);
    return [...roots.map((r) => ({ id: r.id, why: `shaped ${a.name}` })), { id, why: "the center of this tree" }, ...heirs.map((r) => ({ id: r.id, why: `shaped by ${a.name}` }))];
  }
  function play(items, t) {
    const A = C().A;
    Q = items.filter((x) => A[x.id]).map((x) => ({ ...x, song: x.song || (A[x.id].songs || [])[0] || "" }));
    if (!Q.length) return;
    title = t || "Lineage"; idx = -1;
    $("#player").hidden = false; document.body.classList.add("has-player");
    if (!canPreview()) { idx = 0; draw(); openQueue(); return; }
    next();
    (async () => { const mine = Q; for (const x of mine.slice(1)) { if (Q !== mine) return; await lookup(A[x.id].name, x.song); await new Promise((r) => setTimeout(r, 350)); } })(); // warm the rest, one at a time
  }
  async function go(i) {
    if (i < 0 || i >= Q.length) { stop(); return; }
    idx = i; const my = ++busy, x = Q[i], a = C().A[x.id];
    draw("loading");
    const hit = await lookup(a.name, x.song);
    if (my !== busy) return;
    if (!hit) { x.missing = true; draw(); setTimeout(() => { if (my === busy) go(i + 1); }, 900); return; }
    x.hit = hit;
    audio.src = hit.u;
    try { await audio.play(); } catch { if (my === busy) draw("paused"); return; }
    if (my !== busy) return;
    draw();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: hit.t, artist: hit.a, album: `${title} · Sound Lineage`, artwork: hit.art ? [{ src: hit.art, sizes: "300x300", type: "image/jpeg" }] : [] });
    }
  }
  const next = () => go(idx + 1);
  const prev = () => go(Math.max(0, idx - (audio.currentTime > 3 ? 0 : 1)));
  function stop() { busy++; audio.pause(); $("#player").hidden = true; document.body.classList.remove("has-player"); closeQueue(); }
  audio.addEventListener("ended", next);
  audio.addEventListener("timeupdate", () => { const b = $("#pprog"); if (b && audio.duration) b.style.width = `${(audio.currentTime / audio.duration) * 100}%`; });
  audio.addEventListener("play", () => draw()); audio.addEventListener("pause", () => draw());
  if ("mediaSession" in navigator) {
    try { navigator.mediaSession.setActionHandler("nexttrack", next); navigator.mediaSession.setActionHandler("previoustrack", prev); } catch { /* unsupported */ }
  }

  /* ---------- UI ---------- */
  function draw(state) {
    const el = $("#player"); if (!el || idx < 0) return;
    const ctx = C(), x = Q[idx], a = ctx.A[x.id], hit = x.hit;
    const playing = !audio.paused && !state;
    const art = hit?.art ? `<img src="${esc(hit.art)}" alt="" width="48" height="48">` : ctx.vinyl(x.id);
    const spot = `https://open.spotify.com/search/${enc(`${x.song} ${a.name}`)}`;
    el.innerHTML = `<span class="pl-bar"><i id="pprog"></i></span>
      <button class="pl-art" data-plqueue aria-label="Show the queue" style="--vs:48px">${art}</button>
      <button class="pl-txt" data-plqueue><span class="t">${esc(hit?.t || x.song || a.name)}</span><span class="s">${esc(a.name)} · ${esc(a.decade)}${x.why ? ` · ${esc(x.why)}` : ""}</span><span class="k">${esc(title)} · ${idx + 1} of ${Q.length}${state === "loading" ? " · finding preview…" : x.missing ? " · no preview, skipping" : ""}</span></button>
      ${canPreview() ? `<button class="ibtn" data-plprev aria-label="Previous"><svg><use href="#i-back"/></svg></button>
      <button class="ibtn pl-main" data-pltoggle aria-label="${playing ? "Pause" : "Play"}">${playing ? `<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>` : `<svg><use href="#i-play"/></svg>`}</button>
      <button class="ibtn pl-next" data-plnext aria-label="Next"><svg><use href="#i-back"/></svg></button>`
      : `<a class="spot-btn" target="_blank" rel="noopener" href="${esc(spot)}"><span class="sp" aria-hidden="true"></span>Play</a>`}
      <button class="ibtn" data-plclose aria-label="Close player"><svg><use href="#i-close"/></svg></button>`;
    if (!$("#queuesheet").hidden) drawQueue();
  }
  function drawQueue() {
    const ctx = C(), A = ctx.A;
    $("#queuebody").innerHTML = `${canPreview() ? "" : `<p class="notice">Previews play on the public site. Here, tap a song to open it in Spotify, or save the whole lineage as a playlist.</p>`}
      <div class="gbtns" data-spotbox style="margin:12px 0">${window.SL_SPOT.saveBtn(`data-spotsave="" data-title="${esc(title)}" data-songs="${esc(JSON.stringify(Q.map((x) => `${x.song} by ${A[x.id].name}`)))}"`)}${canPreview() ? `<button class="ghost" data-plvideo>Make a video</button>` : ""}<span data-spotout class="qmeta"></span></div>
      <ol class="tracks">${Q.map((x, i) => `<li class="trk${i === idx ? " now" : ""}"><span class="n">${i === idx ? "▶" : i + 1}</span>${x.hit?.art ? `<img class="cov" src="${esc(x.hit.art)}" alt="" width="44" height="44">` : ctx.vinyl(x.id)}<span style="min-width:0"><span class="t">${esc(x.hit?.t || x.song || A[x.id].name)}</span><button class="lnk a" data-open="${x.id}">${esc(A[x.id].name)}</button> <span class="qmeta" style="font-size:.76rem">${esc(A[x.id].decade)}</span><span class="w">${esc(x.why || "")}</span></span>${canPreview() ? `<button class="playbtn" data-plgo="${i}" aria-label="Play"><svg><use href="#i-play"/></svg></button>` : `<a class="playbtn" target="_blank" rel="noopener" href="https://open.spotify.com/search/${enc(`${x.song} ${A[x.id].name}`)}" aria-label="Open in Spotify"><svg><use href="#i-play"/></svg></a>`}</li>`).join("")}</ol>
      <p class="qmeta" style="font-size:.78rem">Previews and cover art courtesy of Apple Music. Full songs play in Spotify, Apple Music or YouTube.</p>`;
  }
  function openQueue() { $("#queuesheet .sheet-t").textContent = title; drawQueue(); $("#queuesheet").hidden = false; $("#scrim").hidden = false; document.body.classList.add("lock"); }
  window.SL_PLAYER_CLOSE = () => closeQueue();
  function closeQueue() { $("#queuesheet").hidden = true; if ($("#panel").hidden && $("#sharesheet").hidden) { $("#scrim").hidden = true; document.body.classList.remove("lock"); } }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-playline],[data-playitems],[data-plqueue],[data-pltoggle],[data-plnext],[data-plprev],[data-plclose],[data-plgo],[data-closequeue],[data-plvideo]");
    if (!t) return;
    e.preventDefault();
    const A = C().A;
    if (t.dataset.playline) { const id = t.dataset.playline; play(lineageItems(id), `The lineage of ${A[id].name}`); }
    else if (t.dataset.playitems) play(JSON.parse(t.dataset.playitems), t.dataset.ptitle);
    else if (t.matches("[data-plqueue]")) openQueue();
    else if (t.matches("[data-pltoggle]")) { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
    else if (t.matches("[data-plnext]")) next();
    else if (t.matches("[data-plprev]")) prev();
    else if (t.matches("[data-plclose]")) stop();
    else if (t.matches("[data-closequeue]")) closeQueue();
    else if (t.dataset.plgo) go(+t.dataset.plgo);
    else if (t.matches("[data-plvideo]")) window.SL_SHARE.video(Q.map((x) => ({ ...x })), title);
  });

  window.SL_PLAYER = { play, lineageItems, lookup, artLookup, canPreview, get queue() { return Q; } };
})();
