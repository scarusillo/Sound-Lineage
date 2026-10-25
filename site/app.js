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
  // how many artists sit downstream, counted four generations deep (fast enough for thousands of artists)
  function reach(map) {
    for (const id in map) {
      const seen = new Set([id]); let fr = [id];
      for (let g = 0; g < 4 && fr.length; g++) { const nx = []; for (const x of fr) for (const d of map[x].down) if (!seen.has(d.id)) { seen.add(d.id); nx.push(d.id); } fr = nx; }
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
    if (s && s.p === "Wikidata" && s.v === "p") return `<a class="src" href="${esc(s.u)}" target="_blank" rel="noopener">Listed on Wikidata ↗</a>`;
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
  /* ---------- record art: vinyl labels for people, sleeves for albums, all from genre color ---------- */
  const hash = (t) => [...String(t)].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  function initials(name) {
    const w = String(name).replace(/\(.*?\)/g, "").replace(/^the\s+/i, "").split(/[\s\-&,.]+/).filter((x) => x && /[A-Za-z0-9]/.test(x[0]));
    return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
  }
  function vinyl(id) {
    const a = A[id]; if (!a) return `<span class="vinyl" style="--c:var(--muted)"></span>`;
    return `<span class="vinyl" style="--c:var(--f-${a.family});--a:${hash(id) % 360}deg" aria-hidden="true"><b>${esc(initials(a.name))}</b></span>`;
  }
  function sleeve(x, kind = "album") {
    const fam = A[x.artist]?.family || "metal";
    const fams = FAMS.map((f) => f.id), other = fams[(fams.indexOf(fam) + 3 + (hash(x.id) % 5)) % fams.length];
    return `<span class="sleeve" style="--c:var(--f-${fam});--c2:var(--f-${other});--a:${100 + (hash(x.id) % 80)}deg" aria-hidden="true"><b>${esc(x.title)}</b><i>${esc(String(x.year || ""))}${kind === "song" ? " · SONG" : ""}</i></span>`;
  }
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2200); }
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
  const VIEWS = ["today", "map", "tree", "mix", "you", "journeys", "play", "browse", "credits", "compare", "ask", "wrapped", "profile", "feed", "people", "inbox", "clubs", "club", "list"];
  const TABS = ["today", "map", "tree", "profile"];
  const TITLES = { journeys: "Journeys", play: "Games", browse: "Browse", credits: "Behind the music", compare: "Compare taste", ask: "Ask the lineage", wrapped: "Lineage Wrapped", mix: "Lineage Mix", you: "Connections & settings", feed: "Feed", people: "People", inbox: "Notifications", clubs: "Listening clubs", club: "Club", list: "List" };
  let routeArg = null;
  const GAME_VIEWS = ["quiz", "degrees", "links", "timeline"];
  const LEGACY = { albums: ["tree", "album"], samples: ["tree", "song"], artists: ["browse"], mine: ["you"], near: ["you"] };
  let journeyReq, lastSection = null, tasteCode = null;
  function route() {
    let h = decodeURIComponent(location.hash.slice(1));
    if (LEGACY[h]) { const [v, k] = LEGACY[h]; if (k) window.SL_TREE.setKind(k); history.replaceState(null, "", "#" + v); h = v; }
    if (/^taste\.[0-9a-z.]+$/.test(h)) { tasteCode = h.slice(6); h = "compare"; }
    routeArg = null;
    const dm = h.match(/^(u|club|list)\.(.+)$/);
    if (dm) { routeArg = dm[2]; h = dm[1] === "u" ? "profile" : dm[1]; }
    let view = VIEWS.includes(h) || GAME_VIEWS.includes(h) ? h : null;
    if (!view && A[h]) { openArtist(h, false); view = store.get("sl.view", "today"); if (view === "compare") view = "today"; }
    view ||= "today";
    const section = GAME_VIEWS.includes(view) ? "play" : view;
    for (const v of VIEWS) $(`#view-${v}`).hidden = v !== section;
    const tab = TABS.includes(section) ? section : "today";
    document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.view === tab));
    document.querySelectorAll(".rail a[data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === section));
    const secondary = !TABS.includes(section) || GAME_VIEWS.includes(view) || (section === "profile" && routeArg);
    $("#appback").hidden = !secondary; $("#apptitle").textContent = secondary ? (TITLES[section] || "Sound Lineage") : "Sound Lineage";
    document.body.classList.toggle("on-map", section === "map");
    closeSearch();
    const inPlace = !!window.SL_KEEP_SHEETS, keepY = window.scrollY;
    if (!inPlace) {
      for (const s of ["#gsheet", "#logsheet", "#sharesheet", "#queuesheet"]) { const el2 = $(s); if (el2) el2.hidden = true; }
      if ($("#panel").hidden) { $("#scrim").hidden = true; document.body.classList.remove("lock"); }
    }
    window.SL_KEEP_SHEETS = false;
    if (view !== "compare" && !routeArg) store.set("sl.view", view);
    const el = $(`#view-${section}`);
    if (section === "today") window.SL_TODAY.renderToday(el);
    else if (section === "journeys") window.SL_TODAY.renderJourneys(el, journeyReq);
    else if (section === "play") window.SL_GAMES.mount(view, el);
    else if (section === "tree") window.SL_TREE.render(el);
    else if (section === "browse") renderBrowse(el);
    else if (section === "credits") renderCredits(el);
    else if (section === "mix") window.SL_MIX.render(el);
    else if (section === "ask") window.SL_SOCIAL.renderAsk(el);
    else if (section === "wrapped") window.SL_WRAPPED.render(el);
    else if (section === "compare") window.SL_SHARE.renderCompare(el, tasteCode);
    else if (section === "you") window.SL_YOU.render(el);
    else if (["profile", "feed", "people", "inbox", "clubs", "club", "list"].includes(section)) {
      const D = window.SL_DIARY;
      el.innerHTML = `<p class="loading">Loading…</p>`;
      window.SL_COMM.init().then(() => {
        if (section === "profile") D.renderProfile(el, routeArg && routeArg !== window.SL_COMM.me.id ? routeArg : null);
        else if (section === "feed") D.renderFeed(el);
        else if (section === "people") D.renderPeople(el);
        else if (section === "inbox") D.renderInbox(el);
        else if (section === "clubs") D.renderClubs(el);
        else if (section === "club") D.renderClub(el, routeArg);
        else if (section === "list") { const [u, id] = (routeArg || "").split(/\.(?=[^.]+$)/); D.renderList(el, u, id); }
      });
    }
    window.SL_MAP.active(section === "map");
    journeyReq = undefined;
    if (section !== lastSection || GAME_VIEWS.includes(view)) { el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); }
    lastSection = section;
    if (section !== "map") window.scrollTo(0, inPlace ? keepY : 0);
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
      out += `<button data-t="${x.t}" data-id="${x.id}"><span class="hit" ${famStyle(x.f || "metal")}><span class="dot"></span><span>${esc(x.label)}</span></span><small>${esc(x.sub)}</small></button>`;
    }
    return out;
  }
  function openSearch() { document.body.classList.add("searching"); $("#q").focus(); }
  function closeSearch() { document.body.classList.remove("searching"); const q = $("#q"); if (q) { q.value = ""; $("#qres").hidden = true; q.blur(); } }
  function setupSearch() {
    const q = $("#q"), box = $("#qres");
    $("#sopen").onclick = openSearch;
    $("#scancel").onclick = closeSearch;
    $("#appback").onclick = () => { const v = store.get("sl.view", "today"); go(GAME_VIEWS.includes(v) ? "play" : "today"); };
    q.addEventListener("input", () => {
      if (!q.value.trim()) { box.hidden = true; return; }
      const hits = searchHits(q.value).sort((a, b) => ["artist", "album", "song"].indexOf(a.t) - ["artist", "album", "song"].indexOf(b.t));
      box.innerHTML = hitsHTML(hits, `Nothing called “${q.value}” yet. Send a suggestion from any artist page.`) + `<div class="k"></div><button data-browseall>Browse everything</button>`;
      box.hidden = false;
    });
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-browseall]")) { closeSearch(); go("browse"); return; }
      const b = e.target.closest("button[data-id]"); if (!b) return;
      const { t, id } = b.dataset; closeSearch();
      if (t === "artist") openArtist(id); else window.SL_TREE.show(t, id);
    });
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const b = box.querySelector("button[data-id]"); if (b) b.click(); }
      if (e.key === "Escape") closeSearch();
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search") && !e.target.closest("#sopen")) { box.hidden = true; if (window.innerWidth < 960 && !q.value) document.body.classList.remove("searching"); } });
    document.addEventListener("keydown", (e) => { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { e.preventDefault(); openSearch(); } });
  }

  /* ---------- browse ---------- */
  function renderBrowse(root) {
    const kind = store.get("sl.browse", "artist");
    const st = store.get("sl.browseF", {});
    root.innerHTML = `<div class="screen-h"><h1>Browse</h1><p class="lede">Every artist, landmark album and sampled song on the map.</p></div><div class="seg" role="group" aria-label="What to browse">${[["artist", "Artists"], ["album", "Albums"], ["song", "Songs"]].map(([k, l]) => `<button data-bk="${k}" class="${k === kind ? "on" : ""}">${l}</button>`).join("")}</div></div>
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
        html = rows.map((a) => `<li><button data-id="${a.id}" class="pa" ${famStyle(a.family)}>${vinyl(a.id)}<span><b>${esc(a.name)}</b><span class="s">${a.role ? `${a.role === "producer" ? "Producer" : "Session players"} · ` : ""}${esc((a.genres || [])[0] || FAM[a.family].name)}${a.origin ? ` · ${esc(a.origin)}` : ""} · ${a.up.length} in, ${a.down.length} out</span></span><span class="r">${a.decade}</span></button></li>`).join("");
      } else if (kind === "album") {
        rows = ALBUMS.filter((x) => { const a = A[x.artist]; return (!f || a?.family === f) && (!d || `${Math.floor(x.year / 10) * 10}s` === d) && (!t || norm(`${x.title} ${a?.name} ${x.sub}`).includes(t)); });
        rows.sort((a, b) => so === "name" ? a.title.localeCompare(b.title) : so === "new" ? b.year - a.year : so === "reach" ? (b.up.length + b.down.length) - (a.up.length + a.down.length) : a.year - b.year);
        html = rows.map((x) => `<li><button data-tree="album" data-id="${x.id}" style="--vs:40px">${sleeve(x)}<span><b>${esc(x.title)}</b><span class="s">${esc(A[x.artist]?.name || "")} · ${esc(x.sub)}</span></span><span class="r">${x.year}</span></button></li>`).join("");
      } else {
        rows = SONGS.filter((x) => (!f || A[x.artist]?.family === f) && (!d || `${Math.floor(x.year / 10) * 10}s` === d) && (!t || norm(`${x.title} ${x.artistName || A[x.artist]?.name || ""}`).includes(t)));
        rows.sort((a, b) => so === "name" ? a.title.localeCompare(b.title) : so === "old" ? a.year - b.year : so === "new" ? b.year - a.year : b.down.length - a.down.length || a.year - b.year);
        html = rows.map((x) => `<li><button data-tree="song" data-id="${x.id}" style="--vs:40px">${sleeve(x, "song")}<span><b>${esc(x.title)}</b><span class="s">${esc(x.artistName || A[x.artist]?.name || "")}${x.down.length ? ` · reused ${x.down.length}×` : ""}${x.up.length ? ` · built from ${x.up.length}` : ""}</span></span><span class="r">${x.year}</span></button></li>`).join("");
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

  /* ---------- behind the music: producers and session players ---------- */
  function renderCredits(root) {
    const role = store.get("sl.creditsRole", "producer");
    const people = ARTISTS.filter((a) => a.role === role).sort((a, b) => b.down.length - a.down.length);
    const top = people.slice(0, 10);
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">Credits as a rabbit hole</span><h1>Behind the music</h1><p class="lede">The producers, engineers and session players whose hands are on records you know. Open anyone to see every artist they shaped, then follow those artists to the next name in their credits.</p></div>
      <div class="seg" role="group" aria-label="Who to show"><button data-crole="producer" class="${role === "producer" ? "on" : ""}">Producers · ${ARTISTS.filter((a) => a.role === "producer").length}</button><button data-crole="session" class="${role === "session" ? "on" : ""}">Session players · ${ARTISTS.filter((a) => a.role === "session").length}</button></div>
      <section class="shelf"><div class="shelf-h"><h2>Most credits</h2></div><div class="row">${top.map((a) => `<button class="rcard" data-open="${a.id}">${vinyl(a.id)}<span class="t">${esc(a.name)}</span><span class="s">${a.down.length} artists · ${esc((a.genres || [])[0] || FAM[a.family].name)}</span></button>`).join("")}</div></section>
      <section class="sec"><h3>Everyone, by number of credits</h3><ul class="lg">${people.map((a) => `<li><button class="lrow" data-open="${a.id}">${vinyl(a.id)}<span><span class="t">${esc(a.name)}</span><span class="s">${esc(sortRel(a.down).slice(0, 4).map((d) => A[d.id].name).join(", "))}${a.down.length > 4 ? "…" : ""}</span></span><span class="r">${a.down.length}</span></button></li>`).join("")}</ul></section>`;
    root.onclick = (e) => { const b = e.target.closest("[data-crole]"); if (b) { store.set("sl.creditsRole", b.dataset.crole); renderCredits(root); } };
  }

  /* ---------- artist panel ---------- */
  let current = null;
  function openArtist(id, push = true) {
    const a = A[id]; if (!a) return;
    current = id;
    const seen = store.get("sl.seen", {}); if (!seen[id]) { seen[id] = 1; store.set("sl.seen", seen); }
    if (push && location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
    const up = sortRel(a.up), down = sortRel(a.down);
    const rel = (r, dir) => `<li><div class="hd">${chip(r.id)}<span class="mono qmeta" style="font-size:.74rem">${esc(A[r.id].decade)}</span>${r.fan ? `<span class="tag">Added by a fan</span>` : strength(r.s)}</div>${r.why ? `<span class="why">${esc(r.why)}</span>` : ""}${r.fan && r.src ? `<a class="src" href="${esc(r.src)}" target="_blank" rel="noopener">Source ↗</a>` : dir === "up" ? srcHTML(r.id, id) : srcHTML(id, r.id)}</li>`;
    const relList = (arr, dir) => { const f = (r) => rel(r, dir); return arr.length <= 10 ? `<ul class="rels">${arr.map(f).join("")}</ul>` : `<ul class="rels">${arr.slice(0, 10).map(f).join("")}</ul><details class="toggle-list"><summary>Show ${arr.length - 10} more</summary><ul class="rels" style="margin-top:10px">${arr.slice(10).map(f).join("")}</ul></details>`; };
    const nSrc = up.map((r) => `${r.id}>${id}`).filter((k) => SRC[k]).length;
    const songsBy = SONGS.filter((s) => s.artist === id);
    const albumsBy = ALBUMS.filter((x) => x.artist === id).sort((p, q) => p.year - q.year);
    const keyAl = (a.keyAlbums || []).filter(([t]) => !albumsBy.some((x) => norm(x.title) === norm(t)));
    const fav = window.SL_YOU?.isFav(a.id);
    const makers = up.filter((r) => A[r.id].role);
    const spotUrl = window.SL_SPOT?.urlFor(a.name);
    const mw = (r, line) => `<button class="mw" data-open="${r.id}" ${famStyle(A[r.id].family)}>${vinyl(r.id)}<span style="min-width:0"><span class="t">${esc(A[r.id].name)}</span><span class="s">${esc(line)}</span></span></button>`;
    $("#pbody").innerHTML = `<div ${famStyle(a.family)}>
      <div class="a-hero">
        ${vinyl(a.id)}
        <div class="p-eyebrow"><span class="dot"></span>${a.role ? `<span class="role">${a.role === "producer" ? "PRODUCER" : "SESSION PLAYERS"}</span>` : ""}${esc(FAM[a.family].name)} · ${esc(a.decade)}</div>
        <h2 class="p-name">${esc(a.name)}</h2>
        <div class="p-sub">${[a.years, a.origin].filter(Boolean).map(esc).join(" · ")}</div>
        <div class="p-actions">
          <button class="playline" data-playline="${a.id}"><svg><use href="#i-play"/></svg>Play the lineage</button>
          <button class="solid" data-tree="artist" data-id="${a.id}">Family tree</button>
        </div>
        <div class="p-actions">
          <a class="ghost small" href="${esc(spotUrl || `https://open.spotify.com/search/${enc(a.name)}`)}" target="_blank" rel="noopener">Spotify</a>
          <button class="ghost small" id="favbtn">${fav ? "★ Saved" : "☆ Save"}</button>
          <button class="ghost small" data-mapfocus="${a.id}">Find on map</button>
          <a class="ghost small" href="https://music.apple.com/us/search?term=${enc(a.name)}" target="_blank" rel="noopener">Apple Music</a>
          <a class="ghost small" href="https://www.youtube.com/results?search_query=${enc(a.name)}" target="_blank" rel="noopener">YouTube</a>
        </div>
      </div>
      ${a.ext ? `<p class="notice" style="margin-top:18px">This profile comes from Wikidata, the open music database${a.wiki ? `. <a href="${esc(a.wiki)}" target="_blank" rel="noopener">Read more on Wikipedia ↗</a>` : "."} Know more about ${esc(a.name)}? Add a missing link below.</p>` : ""}
      ${a.summary ? `<div class="p-sec"><p>${esc(a.summary)}</p>${(a.genres || []).length ? `<div class="chips">${a.genres.map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div>` : ""}</div>` : ""}
      ${dna(a.id).length > 1 ? `<div class="p-sec"><div class="card">${dnaHTML(a.id)}</div></div>` : ""}
      ${makers.length ? `<div class="p-sec"><h3>Made with</h3><div class="madewith">${makers.map((r) => mw(r, A[r.id].role === "producer" ? "Producer" : "Session players")).join("")}</div></div>` : ""}
      ${a.role && down.length ? `<div class="p-sec"><h3 style="color:var(--down)">Credits · ${down.length}</h3><div class="madewith">${down.slice(0, 24).map((r) => mw(r, `${A[r.id].decade} · ${(r.why || "").slice(0, 70)}${(r.why || "").length > 70 ? "…" : ""}`)).join("")}</div>${down.length > 24 ? `<details class="toggle-list"><summary>Show ${down.length - 24} more</summary><div class="madewith" style="margin-top:10px">${down.slice(24).map((r) => mw(r, A[r.id].decade)).join("")}</div></details>` : ""}</div>` : ""}
      ${up.filter((r) => r.s === 3).length >= 2 ? `<div class="p-sec"><h3>In their own words</h3><p class="qmeta" style="margin:0;font-size:.84rem">Artists ${esc(a.name)} has named as influences themselves.</p><div class="chips">${up.filter((r) => r.s === 3).slice(0, 8).map((r) => chip(r.id)).join("")}</div></div>` : ""}
      <div class="p-sec"><h3 style="color:var(--up)">Influenced by · ${up.length}</h3>${nSrc ? `<p class="qmeta" style="margin:0;font-size:.8rem">${nSrc} of these links have a cited source.</p>` : ""}${up.length ? relList(up, "up") : `<p class="qmeta">A root of the tree here.</p>`}</div>
      ${a.role ? "" : `<div class="p-sec"><h3 style="color:var(--down)">Influenced · ${down.length}</h3>${down.length ? relList(down, "down") : `<p class="qmeta">No one mapped downstream yet.</p>`}</div>`}
      ${(a.cousins || []).filter((c) => A[c.id]).length ? `<div class="p-sec"><h3>If you like ${esc(a.name)}, try</h3><ul class="rels">${a.cousins.filter((c) => A[c.id]).map((c) => `<li><div class="hd">${chip(c.id)}<span class="qmeta" style="font-size:.8rem">${esc(FAM[A[c.id].family].name)}</span></div><span class="why">${esc(c.why)}</span></li>`).join("")}</ul></div>` : ""}
      ${window.SL_SPOT?.panelHTML(a) || ""}
      ${(() => { const als = window.SL_DIARY.albumsOf(a.id), st = window.SL_COMM.me ? window.SL_COMM.artistStats(a.id) : { logs: 0 }; return `<div class="p-sec"><div class="sec-h"><h3>Albums</h3>${st.logs ? `<span class="qmeta" style="font-size:.8rem">logged ${st.logs} time${st.logs === 1 ? "" : "s"} by ${st.people} member${st.people === 1 ? "" : "s"}</span>` : ""}</div>${als.length ? `<ul class="lg">${als.map((x) => { const s2 = window.SL_COMM.me ? window.SL_COMM.albumStats(x.key) : { n: 0 }; return `<li><div class="lrow" style="cursor:default">${window.SL_DIARY.art(x, 44)}<span style="min-width:0">${x.albumId && AL[x.albumId] ? `<button class="lnk t" data-tree="album" data-id="${x.albumId}">${esc(x.title)}</button>` : `<span class="t">${esc(x.title)}</span>`}<span class="s">${x.year || ""}${s2.n ? ` · members ${window.SL_DIARY.stars(Math.round(s2.avg * 2))} (${s2.n})` : ""}${x.albumId && AL[x.albumId] ? " · has a lineage" : ""}</span></span><button class="ghost small" data-log="${esc(x.key)}">Log</button></div></li>`; }).join("")}</ul>` : ""}<div class="gbtns"><button class="ghost small" data-log="" data-logartist="${a.id}">Log another album by ${esc(a.name)}</button></div></div>`; })()}
      ${(a.songs || []).length ? `<div class="p-sec"><h3>Start with</h3><div class="chips">${a.songs.map((s) => `<a class="ghost small" target="_blank" rel="noopener" href="https://open.spotify.com/search/${enc(s + " " + a.name)}">▶ ${esc(s)}</a>`).join("")}</div></div>` : ""}
      ${songsBy.length ? `<div class="p-sec"><h3>Samples</h3><div class="mini">${songsBy.map((s) => `<button data-tree="song" data-id="${s.id}"><span><b>${esc(s.title)}</b> <span class="qmeta" style="font-size:.8rem">· ${s.down.length ? `reused ${s.down.length}×` : `built from ${s.up.length}`}</span></span><span class="yr">${s.year}</span></button>`).join("")}</div></div>` : ""}
      ${window.SL_SOCIAL.ownHTML(a)}
      ${(a.know || []).length ? `<div class="p-sec"><h3>Good to know</h3><ul class="know">${a.know.map((k) => `<li>${esc(k)}</li>`).join("")}</ul></div>` : ""}
      <div class="p-sec"><h3>See them live</h3><div class="listen"><a target="_blank" rel="noopener" href="https://www.songkick.com/search?query=${enc(a.name)}">Songkick</a><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${enc(a.name + " tour dates")}">Tour dates</a><a data-go="you" href="#you">Venues near me</a></div></div>
      <div class="p-sec"><div class="gbtns"><button class="ghost small" data-sharepanel>Share this lineage</button><button class="ghost small" data-addlink>Add a missing link</button><button class="ghost small" id="fixbtn">Suggest a correction</button></div>
      ${window.SL_SOCIAL.addLinkHTML(a.id)}
      <form id="fixform" class="fixform" hidden>
        <label for="fixfield">What needs fixing?</label>
        <select id="fixfield"><option>Missing influence</option><option>Wrong influence</option><option>Summary or facts</option><option>Albums or songs</option><option>Missing artist</option><option>Other</option></select>
        <label for="fixtext">Your correction (link an interview or source if you can)</label>
        <textarea id="fixtext" rows="4" required></textarea>
        <div class="gbtns"><button class="qnext" type="submit">Send correction</button><button class="ghost" type="button" id="fixcancel">Cancel</button></div>
        <p class="qmeta" id="fixmsg"></p>
      </form></div>
    </div>`;
    window.SL_SOCIAL.wireAddLink($("#pbody"));
    $("#panel").hidden = false; $("#scrim").hidden = false; $("#panel").scrollTop = 0; document.body.classList.add("lock");
    window.SL_MAP.select(id, false);
  }
  function closePanel() {
    $("#panel").hidden = true; $("#scrim").hidden = true; current = null; document.body.classList.remove("lock");
    history.replaceState(null, "", "#" + store.get("sl.view", "today"));
  }
  function setupClicks() {
    $("#pclose").onclick = closePanel;
    $("#scrim").onclick = () => { if (!$("#sharesheet").hidden) window.SL_SHARE.close(); else if (!$("#queuesheet").hidden) window.SL_PLAYER_CLOSE(); else closePanel(); };
    $("#pshare").onclick = () => window.SL_SHARE.artist(current);
    document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (!$("#sharesheet").hidden) window.SL_SHARE.close(); else if (!$("#queuesheet").hidden) window.SL_PLAYER_CLOSE(); else if (!$("#panel").hidden) closePanel(); });
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
      if (e.target.closest("[data-sharepanel]")) { window.SL_SHARE.artist(current); return; }
      if (e.target.closest("[data-addlink]")) { $("#linkform").hidden = false; $("#lkwho").focus(); return; }
      if (e.target.closest("[data-lkcancel]")) { $("#linkform").hidden = true; return; }
      if (e.target.closest("#favbtn")) { const on = window.SL_YOU.toggleFav(current); e.target.closest("#favbtn").textContent = on ? "★ Saved" : "☆ Save"; toast(on ? `Saved ${A[current].name} to You` : "Removed"); return; }
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
      const reports = (snap.exists && Array.isArray(snap.data()?.reports) ? snap.data().reports : []).slice(-199);
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
      const [src1, src2, xd] = await Promise.all([getJSON("data/sources.json").catch(() => ({})), getJSON("data/sources_ext.json").catch(() => ({})), getJSON("data/artists_ext.json").catch(() => null)]);
      SRC = { ...src2, ...src1 };
      if (xd) {
        const ids = new Set(ad.artists.map((a) => a.id));
        for (const a of xd.artists) if (!ids.has(a.id)) { ad.artists.push(a); ids.add(a.id); }
        const byId = Object.fromEntries(ad.artists.map((a) => [a.id, a]));
        for (const l of xd.links || []) { const t = byId[l.to]; if (t && byId[l.id] && !t.influencedBy.some((u) => u.id === l.id)) t.influencedBy.push({ id: l.id, why: l.why, s: l.s, wd: 1 }); }
      }
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
      store, esc, norm, enc, chip, vinyl, sleeve, initials, toast, hash, closePanel, strength, famStyle, famColor, cssVar, listenLinks, openArtist, go, explored, badges, db, user,
      shortestPath, anyPath, edgeWhy, dna, dnaHTML, srcHTML, get SRC() { return SRC; }, sortRel, decIdx, searchHits, hitsHTML, copyText, playlistText,
      get ARTISTS() { return ARTISTS; }, get A() { return A; }, get FAMS() { return FAMS; }, get FAM() { return FAM; }, get DECADES() { return DECADES; },
      get ALBUMS() { return ALBUMS; }, get AL() { return AL; }, get SONGS() { return SONGS; }, get SO() { return SO; }, get JOURNEYS() { return JOURNEYS; },
    };
    setupSearch(); setupClicks();
    window.SL_SOCIAL.loadApproved().then((links) => {
      for (const l of links) { if (!A[l.from] || !A[l.to] || A[l.to].up.some((u) => u.id === l.from)) continue; A[l.to].up.push({ id: l.from, why: l.why, s: 2, fan: true, src: l.src }); A[l.from].down.push({ id: l.to, why: l.why, s: 2, fan: true, src: l.src }); }
    });
    if ("serviceWorker" in navigator && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});
    window.SL_MAP.init();
    window.addEventListener("hashchange", route);
    route();
    window.SL_COMM.init().then(() => { window.SL_DIARY.badge(); if (["", "today"].includes(location.hash.slice(1))) route(); setInterval(() => window.SL_COMM.refresh().then(() => window.SL_DIARY.badge()).catch(() => {}), 60000); }).catch(() => {});
  }
  boot();
})();
