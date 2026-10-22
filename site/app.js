/* Sound Lineage: shell, data, search, browse, artist panel. Map lives in map.js, the tree in tree.js. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const enc = encodeURIComponent;

  let FAMS = [], FAM = {}, DECADES = [], ARTISTS = [], A = {};
  let ALBUMS = [], AL = {}, SONGS = [], SO = {}, JOURNEYS = [], SRC = {};
  const famStyle = (f) => `style="--c:var(--f-${esc(f)})"`;
  const famColor = (f) => cssVar(`--f-${f}`) || cssVar("--muted");
  const decIdx = (d) => Math.max(0, DECADES.indexOf(d));
  async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); }

  /* ---------- graph ---------- */
  function wire(list, map) {
    for (const x of list) { map[x.id] = x; x.up = []; x.down = []; }
    for (const x of list) for (const e of x.influencedBy || []) {
      if (!map[e.id] || e.id === x.id) continue;
      x.up.push({ id: e.id, why: e.why, s: e.s || 2 });
      map[e.id].down.push({ id: x.id, why: e.why, s: e.s || 2 });
    }
  }
  function reach(map) {
    for (const id in map) {
      const seen = new Set([id]), q = [id];
      while (q.length) for (const d of map[q.shift()].down) if (!seen.has(d.id)) { seen.add(d.id); q.push(d.id); }
      map[id].reach = seen.size - 1;
    }
  }
  function shortestPath(from, to) {
    const prev = { [from]: null }, q = [from];
    while (q.length) { const c = q.shift(); if (c === to) break; for (const d of A[c].down) if (!(d.id in prev)) { prev[d.id] = c; q.push(d.id); } }
    if (!(to in prev)) return null;
    const p = []; for (let c = to; c; c = prev[c]) p.unshift(c); return p;
  }
  /* any direction: returns [{id, dir}] where dir is how we stepped INTO this node: "f" (was influenced by previous) or "b" (influenced previous) */
  function anyPath(from, to) {
    const prev = { [from]: null }, how = {}, q = [from];
    while (q.length) {
      const c = q.shift(); if (c === to) break;
      for (const d of A[c].down) if (!(d.id in prev)) { prev[d.id] = c; how[d.id] = "f"; q.push(d.id); }
      for (const u of A[c].up) if (!(u.id in prev)) { prev[u.id] = c; how[u.id] = "b"; q.push(u.id); }
    }
    if (!(to in prev)) return null;
    const p = []; for (let c = to; c; c = prev[c]) p.unshift({ id: c, dir: how[c] || null }); return p;
  }
  /* Genre DNA: what an artist is made of, from their own genre plus three generations of influences,
     each step weighted by how direct the link is and halved per generation. */
  const DNA = {};
  function dna(id) {
    if (DNA[id]) return DNA[id];
    const w = {}, seen = new Set([id]);
    const self = A[id]; if (!self) return [];
    w[self.family] = 0.55;
    let frontier = [[id, 1]];
    for (let gen = 1; gen <= 3; gen++) {
      const next = [];
      for (const [x, wt] of frontier) {
        const ups = A[x].up; if (!ups.length) continue;
        const total = ups.reduce((s, u) => s + u.s, 0);
        for (const u of ups) {
          const share = wt * 0.55 * (u.s / total) * Math.min(1, ups.length / 3);
          w[A[u.id].family] = (w[A[u.id].family] || 0) + share * (gen === 1 ? 1.6 : 1);
          if (!seen.has(u.id)) { seen.add(u.id); next.push([u.id, share]); }
        }
      }
      frontier = next;
    }
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    let parts = Object.entries(w).map(([f, v]) => [f, v / sum]).sort((a, b) => b[1] - a[1]);
    const keep = parts.filter(([, p]) => p >= 0.04), rest = 1 - keep.reduce((s, [, p]) => s + p, 0);
    parts = keep.map(([f, p]) => [f, p / (1 - rest)]);
    return (DNA[id] = parts);
  }
  function dnaHTML(id, compact = false) {
    const parts = dna(id); if (parts.length < 2) return "";
    const bar = `<div class="dna-bar" role="img" aria-label="Genre DNA: ${parts.map(([f, p]) => `${FAM[f].name} ${Math.round(p * 100)}%`).join(", ")}">${parts.map(([f, p]) => `<i style="width:${(p * 100).toFixed(1)}%;background:var(--f-${f})" title="${esc(FAM[f].name)} ${Math.round(p * 100)}%"></i>`).join("")}</div>`;
    if (compact) return `<div class="dna compact">${bar}</div>`;
    return `<div class="dna"><div class="dna-h"><h3>Genre DNA</h3><span class="qmeta">from their own sound and three generations of influences</span></div>${bar}<div class="dna-key">${parts.map(([f, p]) => `<span><i style="background:var(--f-${f})"></i>${esc(FAM[f].short)} <b>${Math.round(p * 100)}%</b></span>`).join("")}</div></div>`;
  }
  /* sources: a cited page for the most important links, a search shortcut for the rest */
  function srcHTML(from, to) {
    const s = SRC[`${from}>${to}`];
    if (s) return `<a class="src" href="${esc(s.u)}" target="_blank" rel="noopener" title="${esc(s.n || s.t)}">${s.v === "p" ? "Partly backed by" : "Source:"} ${esc(s.p || new URL(s.u).hostname.replace(/^www\./, ""))} ↗</a>`;
    const q = `${A[to]?.name || ""} ${A[from]?.name || ""} influence interview`;
    return `<a class="src none" href="https://www.google.com/search?q=${enc(q)}" target="_blank" rel="noopener">Find a source ↗</a>`;
  }
  const edgeWhy = (a, b) => (A[b]?.up.find((u) => u.id === a) || A[a]?.up.find((u) => u.id === b) || {}).why || "";
  const sortRel = (arr, map = A) => [...arr].sort((a, b) => (b.s - a.s) || ((map[b.id]?.reach || 0) - (map[a.id]?.reach || 0)));

  /* ---------- small helpers ---------- */
  function listenLinks(q) {
    return `<div class="listen">${[["Spotify", `https://open.spotify.com/search/${enc(q)}`], ["Apple Music", `https://music.apple.com/us/search?term=${enc(q)}`], ["YouTube", `https://www.youtube.com/results?search_query=${enc(q)}`]]
      .map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">▶ ${l}</a>`).join("")}</div>`;
  }
  function chip(id) { const a = A[id]; return a ? `<button class="chip" data-id="${id}" ${famStyle(a.family)}>${esc(a.name)}</button>` : ""; }
  function strength(s) { return `<span class="strength" title="${["", "Stylistic lineage", "Widely documented", "Stated by the artist"][s] || ""}">${[1, 2, 3].map((i) => `<i class="${i <= s ? "on" : ""}"></i>`).join("")}</span>`; }
  async function copyText(text, btn, box) {
    try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = t), 1500); } }
    catch { if (box) { box.hidden = false; box.value = text; box.focus(); box.select(); } }
  }
  /* a starter playlist: first essential song of each artist, in order */
  function playlistText(ids, title) {
    const lines = ids.map((id) => A[id]).filter(Boolean).map((a) => `${a.songs?.[0] || a.keyAlbums?.[0]?.[0] || ""} - ${a.name}`).filter((l) => !l.startsWith(" - "));
    return `${title}\n\n${lines.join("\n")}`;
  }

  /* ---------- routing ---------- */
  const VIEWS = ["today", "map", "tree", "journeys", "play", "browse", "you"];
  const GAME_VIEWS = ["quiz", "degrees", "links", "timeline"];
  const LEGACY = { albums: ["tree", "album"], samples: ["tree", "song"], artists: ["browse"], mine: ["you"], near: ["you"] };
  let journeyReq;
  function route() {
    let h = decodeURIComponent(location.hash.slice(1));
    if (LEGACY[h]) { const [v, k] = LEGACY[h]; if (k) window.SL_TREE.setKind(k); history.replaceState(null, "", "#" + v); h = v; }
    let view = VIEWS.includes(h) || GAME_VIEWS.includes(h) ? h : null;
    if (!view && A[h]) { openArtist(h, false); view = store.get("sl.view", "today"); }
    view ||= "today";
    const section = GAME_VIEWS.includes(view) ? "play" : view;
    for (const v of VIEWS) $(`#view-${v}`).hidden = v !== section;
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.view === section));
    store.set("sl.view", view);
    const el = $(`#view-${section}`);
    if (section === "today") window.SL_TODAY.renderToday(el);
    else if (section === "journeys") window.SL_TODAY.renderJourneys(el, journeyReq);
    else if (section === "play") window.SL_GAMES.mount(view, el);
    else if (section === "tree") window.SL_TREE.render(el);
    else if (section === "browse") renderBrowse(el);
    else if (section === "you") window.SL_YOU.render(el);
    window.SL_MAP.active(section === "map");
    journeyReq = undefined;
    if (section !== "map") window.scrollTo(0, 0);
  }
  function go(view) { if (location.hash.slice(1) === view) route(); else location.hash = view; }

  /* ---------- search ---------- */
  let IDX = null;
  function searchIndex() {
    return IDX ??= [
      ...ARTISTS.map((a) => ({ t: "artist", id: a.id, label: a.name, sub: `${a.role ? (a.role === "producer" ? "Producer · " : "Session · ") : ""}${a.decade} · ${FAM[a.family].short}`, f: a.family, s: norm(a.name + " " + (a.genres || []).join(" ")), w: 3 + a.reach / 40 })),
      ...ALBUMS.map((x) => ({ t: "album", id: x.id, label: x.title, sub: `${A[x.artist]?.name || ""} · ${x.year}`, f: A[x.artist]?.family, s: norm(x.title + " " + (A[x.artist]?.name || "")), w: 2 })),
      ...SONGS.map((x) => ({ t: "song", id: x.id, label: x.title, sub: `${x.artistName || A[x.artist]?.name || ""} · ${x.year}`, f: A[x.artist]?.family || "metal", s: norm(x.title + " " + (x.artistName || A[x.artist]?.name || "")), w: 1 })),
    ];
  }
  function searchHits(t, kinds = ["artist", "album", "song"], n = 14) {
    t = norm(t); if (!t) return [];
    return searchIndex().filter((x) => kinds.includes(x.t) && x.s.includes(t)).sort((a, b) => (b.s.startsWith(t) - a.s.startsWith(t)) || b.w - a.w).slice(0, n);
  }
  function hitsHTML(hits, emptyText) {
    if (!hits.length) return `<button disabled>${esc(emptyText)}</button>`;
    let last = "", out = "";
    for (const x of hits) {
      if (x.t !== last) { out += `<div class="k">${{ artist: "Artists", album: "Albums", song: "Songs" }[x.t]}</div>`; last = x.t; }
      out += `<button data-t="${x.t}" data-id="${x.id}"><span style="display:inline-flex;align-items:center;gap:8px" ${famStyle(x.f || "metal")}><span class="dot"></span>${esc(x.label)}</span><small>${esc(x.sub)}</small></button>`;
    }
    return out;
  }
  function setupSearch() {
    const q = $("#q"), box = $("#qres");
    q.addEventListener("input", () => {
      if (!q.value.trim()) { box.hidden = true; return; }
      const hits = searchHits(q.value).sort((a, b) => ["artist", "album", "song"].indexOf(a.t) - ["artist", "album", "song"].indexOf(b.t));
      box.innerHTML = hitsHTML(hits, `Nothing called “${q.value}” yet. Send a suggestion from any artist page.`);
      box.hidden = false;
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-id]"); if (!b) return;
      box.hidden = true; q.value = ""; q.blur();
      if (b.dataset.t === "artist") openArtist(b.dataset.id); else window.SL_TREE.show(b.dataset.t, b.dataset.id);
    });
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const b = box.querySelector("button[data-id]"); if (b) b.click(); }
      if (e.key === "Escape") box.hidden = true;
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) box.hidden = true; });
  }

  /* ---------- browse ---------- */
  function renderBrowse(root) {
    const kind = store.get("sl.browse", "artist");
    const st = store.get("sl.browseF", {});
    root.innerHTML = `<div class="sec-h"><h1>Browse</h1><div class="seg" role="group" aria-label="What to browse">${[["artist", "Artists"], ["album", "Albums"], ["song", "Songs"]].map(([k, l]) => `<button data-bk="${k}" class="${k === kind ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="tools">
        <input class="field" id="bf" type="search" placeholder="${kind === "artist" ? "Filter by name, style or city" : kind === "album" ? "Filter by title, artist or style" : "Filter by song or artist"}" value="${esc(st.t || "")}" autocomplete="off">
        <select id="bfam" aria-label="Genre"><option value="">All genres</option>${FAMS.map((f) => `<option value="${f.id}" ${st.f === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>
        <select id="bdec" aria-label="Decade"><option value="">All decades</option>${DECADES.map((d) => `<option ${st.d === d ? "selected" : ""}>${d}</option>`).join("")}</select>
        ${kind === "artist" ? `<select id="brole" aria-label="Role"><option value="">Everyone</option><option value="artist" ${st.r === "artist" ? "selected" : ""}>Artists</option><option value="maker" ${st.r === "maker" ? "selected" : ""}>Producers and session players</option></select>` : ""}
        <select id="bsort" aria-label="Sort">${(kind === "artist" ? [["reach", "Most influential"], ["name", "A to Z"], ["old", "Oldest first"], ["new", "Newest first"]] : kind === "album" ? [["old", "Oldest first"], ["new", "Newest first"], ["name", "A to Z"], ["reach", "Most connected"]] : [["reach", "Most reused"], ["old", "Oldest first"], ["new", "Newest first"], ["name", "A to Z"]]).map(([v, l]) => `<option value="${v}" ${st.s === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      </div>
      <p class="qmeta" id="bcount" style="margin:0"></p>
      <ul class="rows" id="blist"></ul>`;
    const draw = () => {
      const t = norm($("#bf").value), f = $("#bfam").value, d = $("#bdec").value, so = $("#bsort").value, ro = $("#brole")?.value || "";
      store.set("sl.browseF", { t: $("#bf").value, f, d, s: so, r: ro });
      let rows, html;
      if (kind === "artist") {
        rows = ARTISTS.filter((a) => (!ro || (ro === "maker" ? !!a.role : !a.role)) && (!f || a.family === f) && (!d || a.decade === d) && (!t || norm(`${a.name} ${(a.genres || []).join(" ")} ${a.origin || ""}`).includes(t)));
        rows.sort((a, b) => so === "name" ? a.name.localeCompare(b.name) : so === "old" ? decIdx(a.decade) - decIdx(b.decade) || b.reach - a.reach : so === "new" ? decIdx(b.decade) - decIdx(a.decade) || b.reach - a.reach : b.reach - a.reach);
        html = rows.map((a) => `<li><button data-id="${a.id}" class="pa" ${famStyle(a.family)}><span class="dot"></span><b>${esc(a.name)}</b><span class="r">${a.decade}</span><span class="s">${a.role ? `${a.role === "producer" ? "Producer" : "Session players"} · ` : ""}${esc((a.genres || [])[0] || FAM[a.family].name)}${a.origin ? ` · ${esc(a.origin)}` : ""} · ${a.up.length} in, ${a.down.length} out</span></button></li>`).join("");
      } else if (kind === "album") {
        rows = ALBUMS.filter((x) => { const a = A[x.artist]; return (!f || a?.family === f) && (!d || `${Math.floor(x.year / 10) * 10}s` === d) && (!t || norm(`${x.title} ${a?.name} ${x.sub}`).includes(t)); });
        rows.sort((a, b) => so === "name" ? a.title.localeCompare(b.title) : so === "new" ? b.year - a.year : so === "reach" ? (b.up.length + b.down.length) - (a.up.length + a.down.length) : a.year - b.year);
        html = rows.map((x) => `<li><button data-tree="album" data-id="${x.id}" ${famStyle(A[x.artist]?.family || "rock")}><span class="dot"></span><b>${esc(x.title)}</b><span class="r">${x.year}</span><span class="s">${esc(A[x.artist]?.name || "")} · ${esc(x.sub)}</span></button></li>`).join("");
      } else {
        rows = SONGS.filter((x) => (!f || A[x.artist]?.family === f) && (!d || `${Math.floor(x.year / 10) * 10}s` === d) && (!t || norm(`${x.title} ${x.artistName || A[x.artist]?.name || ""}`).includes(t)));
        rows.sort((a, b) => so === "name" ? a.title.localeCompare(b.title) : so === "old" ? a.year - b.year : so === "new" ? b.year - a.year : b.down.length - a.down.length || a.year - b.year);
        html = rows.map((x) => `<li><button data-tree="song" data-id="${x.id}" ${famStyle(A[x.artist]?.family || "metal")}><span class="dot"></span><b>${esc(x.title)}</b><span class="r">${x.year}</span><span class="s">${esc(x.artistName || A[x.artist]?.name || "")}${x.down.length ? ` · reused ${x.down.length}×` : ""}${x.up.length ? ` · built from ${x.up.length}` : ""}</span></button></li>`).join("");
      }
      $("#bcount").textContent = `${rows.length} ${kind === "artist" ? "artists" : kind === "album" ? "albums" : "songs"}`;
      const lis = html.split("</li>").filter(Boolean);
      const lim = root._lim || 120;
      $("#blist").innerHTML = lis.slice(0, lim).join("</li>") + (lis.length > lim ? `</li><li style="border:0"><button class="ghost" data-blim style="width:auto;display:inline-flex;margin-top:12px">Show ${Math.min(240, lis.length - lim)} more</button></li>` : lis.length ? "</li>" : "");
    };
    root._lim = 120;
    ["#bf", "#bfam", "#bdec", "#bsort", "#brole"].forEach((s) => $(s, root)?.addEventListener("input", () => { root._lim = 120; draw(); }));
    root.onclick = (e) => { if (e.target.closest("[data-blim]")) { root._lim += 240; draw(); return; } const b = e.target.closest("[data-bk]"); if (b) { store.set("sl.browse", b.dataset.bk); store.set("sl.browseF", {}); renderBrowse(root); } };
    draw();
  }

  /* ---------- artist panel ---------- */
  let current = null;
  function openArtist(id, push = true) {
    const a = A[id]; if (!a) return;
    current = id;
    const seen = store.get("sl.seen", {}); if (!seen[id]) { seen[id] = 1; store.set("sl.seen", seen); }
    if (push && location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
    const up = sortRel(a.up), down = sortRel(a.down);
    const rel = (r, dir) => `<li><div class="hd">${chip(r.id)}<span class="mono qmeta" style="font-size:.74rem">${esc(A[r.id].decade)}</span>${strength(r.s)}</div>${r.why ? `<span class="why">${esc(r.why)}</span>` : ""}${dir === "up" ? srcHTML(r.id, id) : srcHTML(id, r.id)}</li>`;
    const relList = (arr, dir) => { const f = (r) => rel(r, dir); return arr.length <= 10 ? `<ul class="rels">${arr.map(f).join("")}</ul>` : `<ul class="rels">${arr.slice(0, 10).map(f).join("")}</ul><details class="toggle-list"><summary>Show ${arr.length - 10} more</summary><ul class="rels" style="margin-top:10px">${arr.slice(10).map(f).join("")}</ul></details>`; };
    const nSrc = [...up.map((r) => `${r.id}>${id}`), ...down.map((r) => `${id}>${r.id}`)].filter((k) => SRC[k]).length;
    const songsBy = SONGS.filter((s) => s.artist === id);
    const albumsBy = ALBUMS.filter((x) => x.artist === id).sort((p, q) => p.year - q.year);
    const keyAl = (a.keyAlbums || []).filter(([t]) => !albumsBy.some((x) => norm(x.title) === norm(t)));
    const fav = window.SL_YOU?.isFav(a.id);
    $("#pbody").innerHTML = `<div ${famStyle(a.family)}>
      <div class="p-eyebrow"><span class="dot"></span>${a.role ? `<span class="role">${a.role === "producer" ? "Producer" : "Session players"}</span>` : ""}${esc(FAM[a.family].name)} · ${esc(a.decade)}</div>
      <h2 class="p-name">${esc(a.name)}</h2>
      <div class="p-sub">${[a.years, a.origin].filter(Boolean).map(esc).join(" · ")}</div>
      ${(a.genres || []).length ? `<div class="chips" style="margin-top:10px">${a.genres.map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div>` : ""}
      <div style="margin-top:14px">${window.SL_SPOT?.urlFor(a.name) ? `<div class="listen"><a href="${esc(window.SL_SPOT.urlFor(a.name))}" target="_blank" rel="noopener">▶ Spotify</a><a href="https://music.apple.com/us/search?term=${enc(a.name)}" target="_blank" rel="noopener">▶ Apple Music</a><a href="https://www.youtube.com/results?search_query=${enc(a.name)}" target="_blank" rel="noopener">▶ YouTube</a></div>` : listenLinks(a.name)}</div>
      <div class="p-actions"><button class="solid" data-tree="artist" data-id="${a.id}">Family tree</button><button class="ghost small" data-mapfocus="${a.id}">Find on map</button><button class="ghost small" id="favbtn">${fav ? "★ Saved" : "☆ Save to For You"}</button><button class="ghost small" id="fixbtn">Suggest a correction</button></div>
      <form id="fixform" class="fixform" hidden>
        <label for="fixfield">What needs fixing?</label>
        <select id="fixfield"><option>Missing influence</option><option>Wrong influence</option><option>Summary or facts</option><option>Albums or songs</option><option>Missing artist</option><option>Other</option></select>
        <label for="fixtext">Your correction (link an interview or source if you can)</label>
        <textarea id="fixtext" rows="4" required></textarea>
        <div class="gbtns"><button class="qnext" type="submit">Send correction</button><button class="ghost" type="button" id="fixcancel">Cancel</button></div>
        <p class="qmeta" id="fixmsg"></p>
      </form>
      ${a.summary ? `<div class="p-sec"><p>${esc(a.summary)}</p></div>` : ""}
      <div class="p-sec">${dnaHTML(a.id)}</div>
      <div class="p-sec"><h3 style="color:var(--up)">Influenced by · ${up.length}</h3>${nSrc ? `<p class="qmeta" style="margin:0;font-size:.8rem">${nSrc} of these links have a cited source.</p>` : ""}${up.length ? relList(up, "up") : `<p class="qmeta">A root of the tree here.</p>`}</div>
      <div class="p-sec"><h3 style="color:var(--down)">${a.role ? "Produced, played on or shaped" : "Influenced"} · ${down.length}</h3>${down.length ? relList(down, "down") : `<p class="qmeta">No one mapped downstream yet.</p>`}</div>
      ${(a.cousins || []).filter((c) => A[c.id]).length ? `<div class="p-sec"><h3>If you like ${esc(a.name)}, try</h3><ul class="rels">${a.cousins.filter((c) => A[c.id]).map((c) => `<li><div class="hd">${chip(c.id)}<span class="qmeta" style="font-size:.8rem">${esc(FAM[A[c.id].family].name)}</span></div><span class="why">${esc(c.why)}</span></li>`).join("")}</ul></div>` : ""}
      ${window.SL_SPOT?.panelHTML(a) || ""}
      ${albumsBy.length || keyAl.length ? `<div class="p-sec"><h3>Albums</h3><div class="mini">${albumsBy.map((x) => `<button data-tree="album" data-id="${x.id}"><span><b>${esc(x.title)}</b> <span class="qmeta" style="font-size:.8rem">· lineage</span></span><span class="yr">${x.year}</span></button>`).join("")}${keyAl.map(([t, y]) => `<div><span>${esc(t)}</span><span class="yr">${y || ""}</span></div>`).join("")}</div></div>` : ""}
      ${(a.songs || []).length ? `<div class="p-sec"><h3>Start with</h3><div class="chips">${a.songs.map((s) => `<a class="ghost small" target="_blank" rel="noopener" href="https://open.spotify.com/search/${enc(s + " " + a.name)}">▶ ${esc(s)}</a>`).join("")}</div></div>` : ""}
      ${songsBy.length ? `<div class="p-sec"><h3>Samples</h3><div class="mini">${songsBy.map((s) => `<button data-tree="song" data-id="${s.id}"><span><b>${esc(s.title)}</b> <span class="qmeta" style="font-size:.8rem">· ${s.down.length ? `reused ${s.down.length}×` : `built from ${s.up.length}`}</span></span><span class="yr">${s.year}</span></button>`).join("")}</div></div>` : ""}
      ${(a.know || []).length ? `<div class="p-sec"><h3>Good to know</h3><ul class="know">${a.know.map((k) => `<li>${esc(k)}</li>`).join("")}</ul></div>` : ""}
      <div class="p-sec"><h3>See them live</h3><div class="listen"><a target="_blank" rel="noopener" href="https://www.songkick.com/search?query=${enc(a.name)}">Songkick</a><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${enc(a.name + " tour dates")}">Tour dates</a><a data-go="you" href="#you">Venues near me</a></div></div>
    </div>`;
    $("#panel").hidden = false; $("#panel").scrollTop = 0;
    window.SL_MAP.select(id, false);
  }
  function closePanel() {
    $("#panel").hidden = true; current = null;
    history.replaceState(null, "", "#" + store.get("sl.view", "today"));
  }
  function setupClicks() {
    $("#pclose").onclick = closePanel;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#panel").hidden) closePanel(); });
    $("#pbody").addEventListener("submit", sendCorrection);
    document.addEventListener("click", (e) => {
      const g = e.target.closest("[data-go]");
      if (g) { e.preventDefault(); if (g.closest("#panel")) closePanel(); go(g.dataset.go); return; }
      const jr = e.target.closest("[data-journey]");
      if (jr) { journeyReq = jr.dataset.journey || null; store.set("sl.journeyOpen", journeyReq); go("journeys"); return; }
      const tr = e.target.closest("[data-tree]");
      if (tr && !tr.closest(".lineage")) { if (tr.closest("#panel")) closePanel(); window.SL_TREE.show(tr.dataset.tree, tr.dataset.id); return; }
      const op = e.target.closest("[data-open]");
      if (op) return openArtist(op.dataset.open);
      const mf = e.target.closest("[data-mapfocus]");
      if (mf) { const id = mf.dataset.mapfocus; closePanel(); go("map"); setTimeout(() => window.SL_MAP.select(id, true), 80); return; }
      const c = e.target.closest(".chip[data-id], .pa[data-id]");
      if (c && !c.closest(".lineage")) return openArtist(c.dataset.id);
      if (e.target.closest("#favbtn")) { const on = window.SL_YOU.toggleFav(current); e.target.closest("#favbtn").textContent = on ? "★ Saved" : "☆ Save to For You"; return; }
      if (e.target.closest("#fixbtn")) { $("#fixform").hidden = false; $("#fixtext").focus(); return; }
      if (e.target.closest("#fixcancel")) { $("#fixform").hidden = true; }
    });
  }

  /* ---------- corrections ---------- */
  let dbP = null, userP = null;
  const useCap = (n) => (window.claude?.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null));
  const db = () => (dbP ??= useCap("db"));
  const user = () => (userP ??= useCap("user"));
  async function sendCorrection(e) {
    if (e.target.id !== "fixform") return;
    e.preventDefault();
    const msg = $("#fixmsg"), text = $("#fixtext").value.trim(); if (!text) return;
    const [d, u] = await Promise.all([db(), user()]);
    const uid = u && (await u.id());
    if (!d || !uid) { msg.textContent = "Corrections can only be sent while signed in to Claude on this page."; return; }
    msg.textContent = "Sending…";
    try {
      const ref = d.doc(`corrections/${uid}`), snap = await ref.get();
      const reports = (snap.exists && Array.isArray(snap.data?.reports) ? snap.data.reports : []).slice(-199);
      reports.push({ artist: current, field: $("#fixfield").value, text: text.slice(0, 2000), at: new Date().toISOString() });
      await ref.set({ reports });
      $("#fixtext").value = ""; msg.textContent = "Thank you. Your correction was sent for review.";
    } catch { msg.textContent = "Your correction could not be sent. Your sharing level may not allow it; ask the owner for Contributor access."; }
  }

  /* ---------- progress ---------- */
  const explored = () => Object.keys(store.get("sl.seen", {})).length;
  function badges() {
    const n = explored(), seen = store.get("sl.seen", {});
    const games = ["quiz", "degrees", "links", "timeline"];
    const plays = games.reduce((s, g) => s + Object.keys(store.get(`sl.g.${g}`, { days: {} }).days).length, 0);
    const best = Math.max(0, ...games.map((g) => window.SL_GAMES?.streak(g) || 0));
    const fams = new Set(Object.keys(seen).filter((id) => A[id]).map((id) => A[id].family));
    const decs = new Set(Object.keys(seen).filter((id) => A[id]).map((id) => A[id].decade));
    return [
      { name: "Needle Drop", desc: "Open your first artist", got: n >= 1 },
      { name: "Crate Digger", desc: "Open 25 artists", got: n >= 25 },
      { name: "Liner Notes", desc: "Open 100 artists", got: n >= 100 },
      { name: "Every Genre", desc: `An artist in all ${FAMS.length} genres`, got: fams.size >= FAMS.length },
      { name: "Time Traveler", desc: "An artist from every decade", got: decs.size >= DECADES.length },
      { name: "Heavy Rotation", desc: "A 7-day game streak", got: best >= 7 },
      { name: "Session Player", desc: "Play 30 daily games", got: plays >= 30 },
    ];
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const [ad, ald, sd, jd] = await Promise.all([getJSON("data/artists.json"), getJSON("data/albums.json"), getJSON("data/samples.json"), getJSON("data/journeys.json").catch(() => ({ journeys: [] }))]);
      SRC = await getJSON("data/sources.json").catch(() => ({}));
      FAMS = ad.families; FAM = Object.fromEntries(FAMS.map((f) => [f.id, f])); DECADES = ad.decades;
      ARTISTS = ad.artists; wire(ARTISTS, A); reach(A);
      ALBUMS = ald.albums; wire(ALBUMS, AL);
      SONGS = sd.songs;
      for (const s of SONGS) { SO[s.id] = s; s.up = []; s.down = []; }
      for (const e of sd.edges) {
        if (!SO[e.from] || !SO[e.to]) continue;
        const tag = { sample: "Sampled", interpolation: "Interpolated", replay: "Replayed", cover: "Reworked" }[e.type] || e.type;
        SO[e.to].up.push({ id: e.from, why: e.what, tag, s: 2 }); SO[e.from].down.push({ id: e.to, why: e.what, tag, s: 2 });
      }
      JOURNEYS = jd.journeys || [];
    } catch (e) { $("main").innerHTML = `<p class="loading">The music data could not load (${esc(e.message)}). Reload the page to try again.</p>`; return; }
    window.SL = {
      store, esc, norm, enc, chip, strength, famStyle, famColor, cssVar, listenLinks, openArtist, go, explored, badges, db, user,
      shortestPath, anyPath, edgeWhy, dna, dnaHTML, srcHTML, get SRC() { return SRC; }, sortRel, decIdx, searchHits, hitsHTML, copyText, playlistText,
      get ARTISTS() { return ARTISTS; }, get A() { return A; }, get FAMS() { return FAMS; }, get FAM() { return FAM; }, get DECADES() { return DECADES; },
      get ALBUMS() { return ALBUMS; }, get AL() { return AL; }, get SONGS() { return SONGS; }, get SO() { return SO; }, get JOURNEYS() { return JOURNEYS; },
    };
    setupSearch(); setupClicks();
    window.SL_MAP.init();
    window.addEventListener("hashchange", route);
    route();
  }
  boot();
})();
