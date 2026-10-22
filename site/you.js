/* For You: bring in your listening (Spotify / Apple Music exports, liked songs, favorites), see your taste,
   get picks, and find record stores, venues and shows nearby. Everything stays in this browser. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const enc = encodeURIComponent;
  const ALIASES = {
    "bob-marley": ["bob marley"], "smokey-robinson": ["smokey robinson", "the miracles"], "tom-petty": ["tom petty"],
    "mos-def": ["mos def", "yasiin bey"], "rakim": ["rakim", "eric b"], "krs-one": ["krs one"], "the-chicks": ["dixie chicks"],
    "crosby-stills-nash": ["crosby stills nash and young", "csny"], "parliament-funkadelic": ["parliament", "funkadelic", "george clinton"],
    "grandmaster-flash": ["grandmaster flash"], "booker-t": ["booker t and the mgs", "booker t"], "the-jackson-5": ["jackson 5", "jackson five"],
    "tupac": ["2pac", "tupac", "tupac shakur"], "notorious-big": ["notorious big", "biggie", "biggie smalls"], "nsync": ["nsync"],
    "lee-scratch-perry": ["lee perry", "lee scratch perry"], "toots": ["toots and the maytals", "the maytals"], "the-specials": ["specials"],
    "sly-and-the-family-stone": ["sly stone"], "electric-light-orchestra": ["elo"], "the-allman-brothers": ["allman brothers band", "allman brothers"],
    "creedence": ["ccr", "creedence clearwater revival"], "wu-tang-clan": ["wu tang clan", "wu tang"], "mf-doom": ["mf doom", "doom", "madvillain"],
    "fred-again": ["fred again"], "kanye-west": ["ye", "kanye west"], "simon-garfunkel": ["simon and garfunkel"], "dr-dre": ["dr dre"], "jay-z": ["jay z"],
  };
  let NAMEIDX = null;
  function nameIndex() {
    if (NAMEIDX) return NAMEIDX;
    const ctx = C(); NAMEIDX = {};
    for (const a of ctx.ARTISTS) {
      NAMEIDX[ctx.norm(a.name)] = a.id;
      NAMEIDX[ctx.norm(a.name.replace(/\s*\(.*\)\s*/, " "))] = a.id;
      const m = a.name.match(/\(([^)]+)\)/); if (m) NAMEIDX[ctx.norm(m[1])] = a.id;
      const lead = a.name.split(/ (?:&|and) the /i)[0]; if (lead !== a.name) NAMEIDX[ctx.norm(lead)] ??= a.id;
      for (const al of ALIASES[a.id] || []) NAMEIDX[ctx.norm(al)] = a.id;
    }
    return NAMEIDX;
  }
  const matchId = (name) => nameIndex()[C().norm(name)] || null;
  const favs = () => C().store.get("sl.favs", []);
  const isFav = (id) => favs().includes(id);
  function toggleFav(id) { const f = favs(), on = !f.includes(id); C().store.set("sl.favs", on ? [...f, id] : f.filter((x) => x !== id)); return on; }

  /* ---------- parsing exports ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function parseFile(name, text, acc) {
    const add = (artist, ms, liked) => {
      artist = String(artist || "").trim(); if (!artist) return;
      const r = (acc.artists[artist] ??= { ms: 0, liked: 0 });
      if (liked) { r.liked++; acc.liked++; } else { r.ms += Number(ms) || 180000; acc.plays++; }
    };
    if (/\.json$/i.test(name) || /^\s*[[{]/.test(text)) {
      let d; try { d = JSON.parse(text); } catch { return false; }
      if (d && Array.isArray(d.tracks)) { // Spotify YourLibrary.json: liked songs
        d.tracks.forEach((t) => add(t.artist, 0, true)); acc.src.add("Spotify liked songs"); return d.tracks.length > 0;
      }
      const arr = Array.isArray(d) ? d : [];
      let n = 0;
      for (const r of arr) {
        if (!r || typeof r !== "object") continue;
        if (r.artistName || r.master_metadata_album_artist_name) { add(r.artistName ?? r.master_metadata_album_artist_name, r.msPlayed ?? r.ms_played, false); n++; }
        else if (r.Artist || r.artist) { add(r.Artist ?? r.artist, 0, true); n++; } // Apple library tracks
      }
      if (n) acc.src.add(/spotify|streaming|endsong|audio/i.test(name) ? "Spotify history" : /library/i.test(name) ? "Apple Music library" : "your file");
      return n > 0;
    }
    const rows = parseCSV(text); if (rows.length < 2) return false;
    const h = rows[0].map((x) => x.trim());
    const ai = h.findIndex((x) => /^(artist name|artist|container artist name)$/i.test(x));
    const di = h.findIndex((x) => /^track description$/i.test(x));
    const mi = h.findIndex((x) => /play duration milliseconds|ms played|duration/i.test(x));
    const ci = h.findIndex((x) => /^play count$/i.test(x));
    if (ai < 0 && di < 0) return false;
    for (const r of rows.slice(1)) add(ai >= 0 ? r[ai] : (r[di] || "").split(" - ")[0], mi >= 0 ? r[mi] : ci >= 0 ? (Number(r[ci]) || 1) * 180000 : 180000, false);
    acc.src.add("Apple Music history");
    return true;
  }
  async function importFiles(files) {
    const acc = { artists: {}, plays: 0, liked: 0, src: new Set() };
    let ok = 0;
    for (const f of files) if (parseFile(f.name, await f.text(), acc)) ok++;
    if (!ok) return { error: "That file didn't have plays or liked songs in a format we recognize. Use YourLibrary.json or StreamingHistory files from Spotify, or a Play History CSV or Library Tracks file from Apple Music." };
    const artists = Object.entries(acc.artists).map(([name, r]) => ({ name, ms: r.ms, liked: r.liked, id: matchId(name) }))
      .sort((a, b) => (b.ms + b.liked * 3.6e6) - (a.ms + a.liked * 3.6e6)).slice(0, 200);
    C().store.set("sl.lib", { source: [...acc.src].join(" + "), at: new Date().toISOString().slice(0, 10), plays: acc.plays, liked: acc.liked, artists });
    return { ok };
  }
  const EXAMPLE = { source: "Example listener", example: true, at: "", plays: 18240, liked: 640, artists: [
    ["Radiohead", 412, 40], ["Kendrick Lamar", 380, 52], ["The Beatles", 341, 38], ["Frank Ocean", 300, 29], ["Tame Impala", 288, 31], ["Fleetwood Mac", 240, 22],
    ["Led Zeppelin", 220, 18], ["Bon Iver", 205, 17], ["Tyler, the Creator", 198, 26], ["Daft Punk", 170, 14], ["Arctic Monkeys", 160, 19], ["SZA", 151, 21],
    ["Pink Floyd", 140, 12], ["Phoebe Bridgers", 120, 15], ["The Strokes", 110, 13], ["Some Local Band", 90, 4],
  ].map(([name, h, l]) => ({ name, ms: h * 3600000, liked: l, id: null })) };

  function lib() {
    const L = C().store.get("sl.lib", null);
    if (L) L.artists.forEach((a) => { a.id = a.id || matchId(a.name); });
    return L;
  }
  function yourIds(L = lib()) {
    const ids = [];
    for (const id of window.SL_SPOT?.ids() || []) if (!ids.includes(id)) ids.push(id);
    for (const a of L?.artists || []) if (a.id && !ids.includes(a.id)) ids.push(a.id);
    for (const f of favs()) if (!ids.includes(f)) ids.push(f);
    return ids;
  }

  /* ---------- recommendations ---------- */
  function recommend(ids, opts = {}) {
    const ctx = C(), A = ctx.A, mine = new Set(ids), score = {}, why = {}, cross = {};
    ids.forEach((id, i) => {
      const w = Math.max(2, 40 - i), me = A[id];
      for (const d of me.down) if (!mine.has(d.id)) { score[d.id] = (score[d.id] || 0) + w * (1 + d.s / 3); (why[d.id] ??= []).push(`${me.name} influenced them`); }
      for (const u of me.up) if (!mine.has(u.id)) { score[u.id] = (score[u.id] || 0) + w * 0.7 * (1 + u.s / 3); (why[u.id] ??= []).push(`they shaped ${me.name}`); }
      for (const c of me.cousins || []) if (A[c.id] && !mine.has(c.id)) { score[c.id] = (score[c.id] || 0) + w * 0.6; cross[c.id] = 1; (why[c.id] ??= []).push(`they're the ${ctx.FAM[A[c.id].family].short.toLowerCase()} cousin of ${me.name}`); }
    });
    let out = Object.keys(score).sort((a, b) => score[b] - score[a]).map((id) => ({ id, score: score[id], why: [...new Set(why[id])], cross: !!cross[id] }));
    if (opts.cross) out = out.filter((r) => r.cross || !ids.some((m) => A[m].family === A[r.id].family));
    return out;
  }
  function personalPick(n) {
    const ids = yourIds(); if (!ids.length) return null;
    const recs = recommend(ids).slice(0, 12); if (!recs.length) return null;
    const r = recs[n % recs.length];
    return { id: r.id, why: r.why[0] };
  }

  /* ---------- weekly lineage mix (same rules as scripts/weekly_mix.py) ---------- */
  function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear(), wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    return `${y}-W${String(wk).padStart(2, "0")}`;
  }
  function rng(seed) { let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function weeklyMix(ids) {
    const ctx = C(), A = ctx.A;
    if (!ids.length) return null;
    const week = isoWeek(), R = rng(week + "|" + [...ids].sort().join(","));
    const have = new Set(ids), used = new Set();
    const song = (i) => (A[i].songs || [])[0] || "";
    const artistOnly = (i) => !A[i].role;
    const pool = (kind) => {
      const agg = {};
      ids.forEach((m, rank) => {
        const w = Math.max(1, 30 - rank), me = A[m];
        const add = (i, sc, why) => { if (!agg[i] || sc > agg[i][0]) agg[i] = [sc + (agg[i]?.[0] || 0) * 0.5, why]; };
        if (kind === "root") for (const e of me.up) { if (!have.has(e.id) && artistOnly(e.id)) add(e.id, w * e.s, `${A[e.id].name} shaped ${me.name}`); }
        if (kind === "heir" || kind === "deep") for (const e of me.down) {
          const a = A[e.id]; if (have.has(e.id) || !artistOnly(e.id)) continue;
          if (kind === "deep" && (!["2000s", "2010s", "2020s"].includes(a.decade) || a.down.length > 3)) continue;
          add(e.id, w * e.s, `${me.name} shaped them`);
        }
        if (kind === "cousin") for (const c of me.cousins || []) { if (A[c.id] && !have.has(c.id)) add(c.id, w * 2, `the ${ctx.FAM[A[c.id].family].short.toLowerCase()} cousin of ${me.name}`); }
      });
      let ranked = Object.entries(agg).sort((a, b) => b[1][0] - a[1][0]).slice(0, 25);
      for (let i = ranked.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ranked[i], ranked[j]] = [ranked[j], ranked[i]]; }
      return ranked.slice(0, 12).sort((a, b) => b[1][0] - a[1][0]).map(([i, [, why]]) => [i, why]);
    };
    const picks = [];
    for (const [kind, n] of [["root", 3], ["heir", 4], ["deep", 2], ["cousin", 2]]) {
      let got = 0;
      for (const [i, why] of pool(kind)) { if (got >= n) break; if (used.has(i) || !song(i)) continue; used.add(i); got++; picks.push({ id: i, song: song(i), kind, because: why }); }
    }
    const [y, w] = week.split("-W").map(Number);
    const jan4 = new Date(Date.UTC(y, 0, 4)), monday = new Date(jan4); monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7);
    return { week, title: `Lineage Mix · ${monday.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}`, picks };
  }
  function mixHTML(ids, compact) {
    const ctx = C(), A = ctx.A, mix = weeklyMix(ids);
    if (!mix || mix.picks.length < 4) return "";
    const LBL = { root: "Where it came from", heir: "Where it went", deep: "Deep cuts", cousin: "Across genres" };
    const songs = mix.picks.map((p) => `${p.song} by ${A[p.id].name}`);
    const text = `${mix.title}\n\n${mix.picks.map((p) => `${p.song} - ${A[p.id].name}`).join("\n")}`;
    if (compact) return `<button class="pick you" data-go="you" style="--c:var(--hot)"><span class="lbl">This week's Lineage Mix</span><b>${esc(mix.title)}</b><span class="d">${mix.picks.length} songs: ${esc(mix.picks.slice(0, 4).map((p) => A[p.id].name).join(", "))} and more. Built from your artists, one generation back and forward.</span></button>`;
    let last = "";
    return `<section class="sec mix" data-spotbox>
      <div class="sec-h"><h2>${esc(mix.title)}</h2><span class="qmeta">A new mix every Monday, built from your artists</span></div>
      <ol class="mixlist">${mix.picks.map((p, i) => { const head = p.kind !== last ? `<li class="mixh">${LBL[p.kind]}</li>` : ""; last = p.kind; return `${head}<li><span class="n mono">${String(i + 1).padStart(2, "0")}</span><span><b>${esc(p.song)}</b> · <button class="lnk" data-open="${p.id}">${esc(A[p.id].name)}</button><br><span class="qmeta" style="font-size:.8rem">${esc(p.because)}</span></span><a class="ghost small" target="_blank" rel="noopener" href="https://open.spotify.com/search/${enc(p.song + " " + A[p.id].name)}">▶</a></li>`; }).join("")}</ol>
      <div class="gbtns">${window.SL_SPOT.saveBtn(`data-spotsave="" data-title="${esc(mix.title)}" data-songs="${esc(JSON.stringify(songs))}"`)}<button class="ghost small" data-copymix="${esc(text)}">Copy as text</button><span data-spotout class="qmeta"></span></div>
      <textarea class="copybox" id="mixbox" hidden aria-label="Mix as text"></textarea>
    </section>`;
  }

  /* ---------- view ---------- */
  function render(root) {
    const ctx = C(), A = ctx.A, L = lib(), ids = yourIds(L);
    const recs = ids.length ? recommend(ids) : [];
    const top12 = new Set(recs.slice(0, 12).map((r) => r.id));
    const crossRecs = ids.length ? recommend(ids, { cross: true }).filter((r) => !top12.has(r.id)) : [];
    const famCount = {}; ids.forEach((id) => { famCount[A[id].family] = (famCount[A[id].family] || 0) + 1; });
    const mineSet = new Set(ids), roots = {};
    ids.forEach((id) => A[id].up.forEach((u) => { if (!mineSet.has(u.id)) roots[u.id] = (roots[u.id] || 0) + 1; }));
    const topRoots = Object.entries(roots).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxMs = Math.max(1, ...(L?.artists || []).map((a) => a.ms + a.liked * 3.6e6));
    const matched = (L?.artists || []).filter((a) => a.id).length;
    const city = ctx.store.get("sl.city", "");
    const where = city || "me";
    const g = (q) => `https://www.google.com/maps/search/${enc(q)}`;
    const smaller = recs.filter((r) => ["2010s", "2020s"].includes(A[r.id].decade) && A[r.id].down.length <= 3).slice(0, 8);
    const recRow = (r) => `<li><button data-open="${r.id}" ${ctx.famStyle(A[r.id].family)}><span class="dot"></span><b>${esc(A[r.id].name)}</b><span class="r">${A[r.id].decade}</span><span class="s">${esc(r.why.slice(0, 2).join("; "))}</span></button></li>`;
    root.innerHTML = `<div class="you">
      <div><h1>For You</h1><p class="lede">Sync your Spotify or bring in what you already listen to and the whole app starts working for you: picks on Today, your roots, where to go next and who's playing nearby. Your files are read in this browser and never uploaded.</p></div>

      <section class="connectors">
        <div class="conn drop" id="drop">
          <span class="st ${L && !L.example ? "ok" : ""}">${L && !L.example ? `✓ Imported ${esc(L.at)}` : "Import"}</span>
          <b>Spotify or Apple Music data</b>
          <ol>
            <li>Spotify: <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener">Account › Privacy</a>, request your data. Apple: <a href="https://privacy.apple.com" target="_blank" rel="noopener">privacy.apple.com</a>, request Apple Media Services.</li>
            <li>When the email arrives, unzip it.</li>
            <li>Drop in <b>YourLibrary.json</b> (your liked songs) and the <b>StreamingHistory</b> files, or Apple's Play History CSV.</li>
          </ol>
          <div class="gbtns"><label class="solid" for="libfile" style="cursor:pointer">Choose files</label><input id="libfile" type="file" accept=".json,.csv,application/json,text/csv" multiple hidden>${!L ? `<button class="ghost small" data-example>Try an example</button>` : `<button class="ghost small" data-clearlib>Clear</button>`}</div>
          <p class="qmeta" id="impmsg" style="margin:0"></p>
        </div>
        ${window.SL_SPOT.cardHTML()}
        <div class="conn">
          <span class="st">${favs().length ? `${favs().length} saved` : "Quick start"}</span>
          <b>Pick a few favorites</b>
          <div class="addrow"><input class="field" id="favq" type="search" placeholder="Add an artist you love" autocomplete="off"><div id="favres" class="qres" hidden style="top:calc(100% + 4px)"></div></div>
          <div class="chips">${favs().map((id) => `<button class="chip" data-unfav="${id}" ${ctx.famStyle(A[id]?.family || "rock")} title="Remove">${esc(A[id]?.name || id)} ×</button>`).join("") || `<span class="qmeta">Or star artists from their profile.</span>`}</div>
        </div>
      </section>
      ${L?.example ? `<p class="notice">Showing an example listener, not your data. Import your own files to replace it.</p>` : ""}

      ${ids.length ? mixHTML(ids) : ""}
      ${ids.length ? `<section class="twocol">
        <div class="sec">
          <div class="sec-h"><h2>Your top artists</h2>${L ? `<span class="qmeta">${L.plays ? `${L.plays.toLocaleString()} plays` : ""}${L.plays && L.liked ? " · " : ""}${L.liked ? `${L.liked.toLocaleString()} liked songs` : ""}</span>` : ""}</div>
          ${L ? `<div class="bars">${L.artists.slice(0, 15).map((a, i) => `<div class="brow" ${ctx.famStyle(a.id ? A[a.id].family : "metal")}><span class="rk">${i + 1}</span><div class="bx"><i style="width:${Math.max(4, ((a.ms + a.liked * 3.6e6) / maxMs) * 100)}%"></i>${a.id ? `<button data-open="${a.id}">${esc(a.name)}</button>` : `<span>${esc(a.name)}</span>`}</div><span class="hrs">${a.ms ? `${(a.ms / 3600000).toFixed(a.ms < 36e6 ? 1 : 0)} h` : ""}${a.ms && a.liked ? " · " : ""}${a.liked ? `♥ ${a.liked}` : ""}</span></div>`).join("")}</div>
          <p class="gfoot">${matched} of your top artists are on the map so far.</p>` : `<div class="chips">${ids.map((id) => ctx.chip(id)).join("")}</div>`}
        </div>
        <div class="sec">
          <h2>Your taste</h2>
          <h3>Genre mix</h3>
          <div class="chips">${Object.entries(famCount).sort((a, b) => b[1] - a[1]).map(([f, n]) => `<span class="tag" ${ctx.famStyle(f)}><span class="dot"></span>${esc(ctx.FAM[f].name)} · ${n}</span>`).join("")}</div>
          ${topRoots.length ? `<h3 style="margin-top:12px">Your roots</h3><p class="qmeta" style="margin:0">The artists behind the most people you play.</p><div class="chips">${topRoots.map(([id, n]) => `${ctx.chip(id)}<span class="qmeta" style="font-size:.78rem">${n}×</span>`).join(" ")}</div>` : ""}
          <div class="gbtns" style="margin-top:12px"><button class="ghost small" data-tree="artist" data-id="${ids[0]}">Open the tree for ${esc(A[ids[0]].name)}</button><button class="ghost small" data-mapfocus="${ids[0]}">Find it on the map</button></div>
        </div>
      </section>
      <section class="twocol">
        <div class="sec"><div class="sec-h"><h2>Where to go next</h2><span class="qmeta">ranked by how many of your artists point there</span></div><ul class="recs">${recs.slice(0, 12).map(recRow).join("")}</ul></div>
        <div class="sec"><div class="sec-h"><h2>Outside your lane</h2><span class="qmeta">same spirit, different genre</span></div><ul class="recs">${crossRecs.slice(0, 12).map(recRow).join("") || `<li class="qmeta" style="padding:10px 0">Add a few more artists to see cross-genre picks.</li>`}</ul></div>
      </section>` : ""}

      <section class="sec">
        <div class="sec-h"><h2>Near you</h2><form class="addrow" id="cityform" style="flex:0 1 420px"><input class="field" id="city" type="search" placeholder="City or ZIP, e.g. Darien, CT" value="${esc(city)}" autocomplete="off"><button class="solid" type="submit">Set</button></form></div>
        <div class="linkcards">
          <a href="${g(`independent record store near ${where}`)}" target="_blank" rel="noopener"><b>Independent record stores</b><span>Google Maps, nearest first</span></a>
          <a href="${g(`used vinyl records near ${where}`)}" target="_blank" rel="noopener"><b>Used vinyl and crates</b><span>Google Maps</span></a>
          <a href="https://recordstoreday.com/Stores" target="_blank" rel="noopener"><b>Record Store Day shops</b><span>Official list of indie stores</span></a>
          <a href="${g(`live music venue near ${where}`)}" target="_blank" rel="noopener"><b>Small venues</b><span>Clubs, bars and listening rooms</span></a>
          <a href="https://www.songkick.com/search?query=${enc(city)}&type=locations" target="_blank" rel="noopener"><b>Concert calendar</b><span>Songkick, by city</span></a>
          <a href="https://www.google.com/search?q=${enc(`concerts this week near ${where}`)}" target="_blank" rel="noopener"><b>This week</b><span>Shows in the next few days</span></a>
        </div>
        ${ids.length ? `<div class="twocol">
          <div class="sec"><h3>Shows for artists you play</h3>${ids.slice(0, 8).map((id) => `<div class="showrow"><div>${ctx.chip(id)}</div><div class="l"><a class="ghost small" target="_blank" rel="noopener" href="https://www.songkick.com/search?query=${enc(A[id].name)}">Songkick</a><a class="ghost small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${enc(`${A[id].name} tour dates ${city}`)}">Dates</a></div></div>`).join("")}</div>
          ${smaller.length ? `<div class="sec"><h3>Smaller acts you'd probably like live</h3>${smaller.map((r) => `<div class="showrow"><div>${ctx.chip(r.id)}</div><div class="l"><a class="ghost small" target="_blank" rel="noopener" href="https://www.songkick.com/search?query=${enc(A[r.id].name)}">Songkick</a><a class="ghost small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${enc(`${A[r.id].name} tour dates ${city}`)}">Dates</a></div></div>`).join("")}</div>` : ""}
        </div>` : ""}
      </section>
    </div>`;

    const input = $("#libfile", root), msg = $("#impmsg", root), drop = $("#drop", root);
    const run = async (files) => { if (!files?.length) return; msg.textContent = "Reading…"; const r = await importFiles([...files]); if (r.error) msg.textContent = r.error; else render(root); };
    input.onchange = () => run(input.files);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); run(e.dataTransfer.files); });
    const fq = $("#favq", root), fr = $("#favres", root);
    fq.oninput = () => { const hits = ctx.searchHits(fq.value, ["artist"], 8); fr.innerHTML = ctx.hitsHTML(hits, "No match on the map yet"); fr.hidden = !fq.value.trim(); };
    fr.onclick = (e) => { const b = e.target.closest("button[data-id]"); if (b) { if (!isFav(b.dataset.id)) toggleFav(b.dataset.id); render(root); } };
    $("#cityform", root).onsubmit = (e) => { e.preventDefault(); ctx.store.set("sl.city", $("#city", root).value.trim()); render(root); };
    root.onclick = (e) => {
      const cm = e.target.closest("[data-copymix]"); if (cm) { ctx.copyText(cm.dataset.copymix.replace(/\\n/g, "\n"), cm, $("#mixbox", root)); return; }
      const uf = e.target.closest("[data-unfav]"); if (uf) { toggleFav(uf.dataset.unfav); render(root); return; }
      if (e.target.closest("[data-example]")) { ctx.store.set("sl.lib", EXAMPLE); render(root); return; }
      if (e.target.closest("[data-clearlib]")) { ctx.store.del("sl.lib"); render(root); }
    };
  }

  window.SL_YOU = { render, isFav, toggleFav, personalPick, matchId, mixHTML: (compact) => mixHTML(yourIds(), compact) };
})();
