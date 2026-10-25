/* The listening diary and the community around it: log an album, Four Favorites, want-to-hear shelf, yearly goal,
   the weekly dig, profiles, follows, the feed, likes and comments, lists, notifications and listening clubs.
   Every logged album also shows where it sits in the lineage, so the diary teaches as it grows. */
(() => {
  "use strict";
  const C = () => window.SL, M = () => window.SL_COMM;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SITE = "https://scarusillo.github.io/Sound-Lineage/";

  /* ---------- album catalog ---------- */
  let CAT = null, CATL = null;
  function catalog() {
    if (CAT) return CAT;
    const ctx = C(); CAT = {};
    const add = (artist, title, year, albumId) => {
      if (!ctx.A[artist] || !title) return;
      const key = `${artist}::${ctx.norm(title).replace(/\s+/g, "-")}`;
      if (!CAT[key]) CAT[key] = { key, title, artist, artistName: ctx.A[artist].name, year: year || null, albumId: albumId || null };
      else if (albumId) CAT[key].albumId = albumId;
    };
    for (const x of ctx.ALBUMS) add(x.artist, x.title, x.year, x.id);
    for (const a of ctx.ARTISTS) for (const [t, y] of a.keyAlbums || []) add(a.id, t, y);
    CATL = Object.values(CAT).map((x) => ({ ...x, s: ctx.norm(`${x.title} ${x.artistName}`), w: (ctx.A[x.artist].reach || 0) + (x.albumId ? 40 : 0) }));
    return CAT;
  }
  const albumsOf = (id) => { catalog(); return CATL.filter((x) => x.artist === id).sort((a, b) => (a.year || 9999) - (b.year || 9999)); };
  function searchAlbums(q, n = 12) {
    catalog(); const t = C().norm(q); if (!t) return [];
    return CATL.filter((x) => x.s.includes(t)).sort((a, b) => (b.s.startsWith(t) - a.s.startsWith(t)) || b.w - a.w).slice(0, n);
  }
  function custom(artist, title, year) { const ctx = C(); return { key: `${artist}::${ctx.norm(title).replace(/\s+/g, "-")}`, title, artist, artistName: ctx.A[artist]?.name || "", year: year || null }; }
  const art = (a, size = 56) => `<span style="--vs:${size}px;width:${size}px;display:block;flex:none">${C().sleeve({ id: a.key, title: a.title, artist: a.artist, year: a.year || "" })}</span>`;
  const stars = (r) => (r ? `<span class="stars" aria-label="${r / 2} stars">${"★".repeat(Math.floor(r / 2))}${r % 2 ? "½" : ""}</span>` : "");
  const when = (iso) => { const d = new Date(iso); const s = (Date.now() - d) / 1000; return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m` : s < 86400 ? `${Math.round(s / 3600)}h` : s < 604800 ? `${Math.round(s / 86400)}d` : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
  const avatar = (uid, size = 40) => { const p = M().S.people[uid], n = p?.name || M().S.names[uid] || ""; const fam = C().FAMS[C().hash(uid) % C().FAMS.length].id; return `<span class="avatar" style="--vs:${size}px;width:${size}px;height:${size}px;--c:var(--f-${fam})" aria-hidden="true"><b>${n ? esc(C().initials(n)) : "♪"}</b></span>`; };
  const who = (uid) => `<a class="who" href="#u.${esc(uid)}">${esc(M().nameOf(uid))}</a>`;

  /* ---------- goals, weekly dig, stats ---------- */
  const thisYear = (me) => me.logs.filter((l) => (l.date || "").startsWith(String(new Date().getFullYear())));
  function topArtists(me) {
    const c = {}; me.logs.slice(0, 200).forEach((l, i) => { c[l.artist] = (c[l.artist] || 0) + (l.rating || 6) / (1 + i / 40); });
    for (const f of me.fav4 || []) if (f) c[f.artist] = (c[f.artist] || 0) + 10;
    const ids = Object.keys(c).sort((a, b) => c[b] - c[a]);
    return ids.length ? ids : window.SL_YOU.yourIds();
  }
  function weeklyDig(me) {
    const wk = window.SL_MIX.isoWeek(), ctx = C(), A = ctx.A;
    if (me.digs?.[wk]) return { week: wk, ...me.digs[wk] };
    const heard = new Set(me.logs.map((l) => l.key)), mine = topArtists(me).slice(0, 15);
    const cand = [];
    for (const id of mine) for (const u of ctx.sortRel(A[id].up)) { if (A[u.id].role) continue; const al = albumsOf(u.id).find((x) => !heard.has(x.key)); if (al) cand.push({ al, from: id, s: u.s }); }
    if (!cand.length) return null;
    const pick = cand[C().hash(wk + me.id) % Math.min(cand.length, 12)];
    const dig = { key: pick.al.key, title: pick.al.title, artist: pick.al.artist, artistName: pick.al.artistName, year: pick.al.year, because: pick.from, done: false };
    me.digs = { ...(me.digs || {}), [wk]: dig };
    const keys = Object.keys(me.digs).sort(); if (keys.length > 60) delete me.digs[keys[0]];
    M().save();
    return { week: wk, ...dig };
  }
  function streak(me) {
    let n = 0, d = new Date();
    const wkOf = (x) => window.SL_MIX.isoWeek(x);
    if (!me.digs?.[wkOf(d)]?.done) d = new Date(d - 7 * 864e5);
    while (me.digs?.[wkOf(d)]?.done) { n++; d = new Date(d - 7 * 864e5); }
    return n;
  }
  function rootsOf(me) {
    const A = C().A, heard = new Set(me.logs.map((l) => l.artist)), c = {};
    for (const id of topArtists(me).slice(0, 30)) for (const u of A[id].up) if (!A[u.id].role) c[u.id] = (c[u.id] || 0) + u.s;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n, heard: heard.has(id) }));
  }
  function ring(done, goal, label) {
    const p = Math.min(1, goal ? done / goal : 0), r = 22, cfull = 2 * Math.PI * r;
    return `<span class="ring"><svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="6"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--hot)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(p * cfull).toFixed(1)} ${cfull.toFixed(1)}" transform="rotate(-90 28 28)"/></svg><b class="mono">${done}</b></span><span class="ring-l">${esc(label)}</span>`;
  }

  /* ---------- the log sheet ---------- */
  let logState = null;
  function openLog(a) {
    logState = { a: a || null, step: a ? "rate" : "pick" };
    drawLog(); const sh = $("#logsheet"); sh.hidden = false; $("#scrim").hidden = false; document.body.classList.add("lock");
    setTimeout(() => $("#logq")?.focus(), 60);
  }
  function closeLog() { $("#logsheet").hidden = true; if ($("#panel").hidden && $("#sharesheet").hidden && $("#gsheet").hidden) { $("#scrim").hidden = true; document.body.classList.remove("lock"); } }
  function suggestions() {
    const ctx = C(), me = M().me, heard = new Set(me.logs.map((l) => l.key)), out = [];
    const dig = weeklyDig(me); if (dig && !dig.done) out.push({ a: dig, why: "This week's dig" });
    for (const w of me.want.slice(0, 4)) out.push({ a: w, why: "On your Want to hear shelf" });
    const recent = window.SL_SPOT?.get?.()?.tracks || [];
    for (const t of recent.slice(0, 12)) { const id = window.SL_YOU.matchId(t.artist); if (!id) continue; const al = albumsOf(id).find((x) => !heard.has(x.key)); if (al && !out.some((o) => o.a.key === al.key)) out.push({ a: al, why: `You played ${t.name}` }); }
    for (const id of window.SL_YOU.yourIds().slice(0, 10)) { const al = albumsOf(id).find((x) => !heard.has(x.key)); if (al && !out.some((o) => o.a.key === al.key)) out.push({ a: al, why: `You listen to ${ctx.A[id].name}` }); }
    return out.slice(0, 10);
  }
  function drawLog() {
    const body = $("#logbody"), ctx = C(), st = logState;
    if (st.step === "pick") {
      const sug = suggestions();
      body.innerHTML = `<div class="search logsearch"><svg class="sicon" aria-hidden="true"><use href="#i-search"/></svg><label for="logq" class="sr">Find an album</label><input id="logq" type="search" placeholder="Album or artist" autocomplete="off" enterkeyhint="search"></div>
        <div id="logres"></div>
        ${sug.length ? `<h3 style="margin:18px 0 8px">Suggested</h3><ul class="lg">${sug.map((s, i) => `<li><button class="lrow" data-pick="${i}">${art(s.a, 44)}<span style="min-width:0"><span class="t">${esc(s.a.title)}</span><span class="s">${esc(s.a.artistName)} · ${esc(s.why)}</span></span><span class="r">${s.a.year || ""}</span></button></li>`).join("")}</ul>` : `<p class="qmeta">Search for an album above. Sync Spotify on your Profile and your recent listening shows up here.</p>`}`;
      st.sug = sug;
      const q = $("#logq", body), res = $("#logres", body);
      q.oninput = () => {
        const hits = searchAlbums(q.value), arts = ctx.searchHits(q.value, ["artist"], 4);
        st.hits = hits; st.arts = arts;
        res.innerHTML = q.value.trim() ? `<ul class="lg" style="margin-top:10px">${hits.map((h, i) => `<li><button class="lrow" data-hit="${i}">${art(h, 44)}<span style="min-width:0"><span class="t">${esc(h.title)}</span><span class="s">${esc(h.artistName)}</span></span><span class="r">${h.year || ""}</span></button></li>`).join("")}${arts.map((h) => `<li><button class="lrow" data-otherof="${h.id}">${ctx.vinyl(h.id)}<span style="min-width:0"><span class="t">Another album by ${esc(h.label)}</span><span class="s">Type the album title next</span></span><span class="r"></span></button></li>`).join("")}</ul>${!hits.length && !arts.length ? `<p class="qmeta">No match yet. Try the artist's name.</p>` : ""}` : "";
      };
      return;
    }
    if (st.step === "custom") {
      body.innerHTML = `<form id="customform" class="fixform" style="background:none;padding:0"><label for="ctitle">Album title by ${esc(ctx.A[st.artist].name)}</label><input class="field" id="ctitle" required maxlength="120" style="border-radius:10px"><label for="cyear">Year (optional)</label><input class="field" id="cyear" inputmode="numeric" maxlength="4" style="border-radius:10px;max-width:120px"><div class="gbtns"><button class="solid" type="submit">Next</button><button class="ghost" type="button" data-logback>Back</button></div></form>`;
      setTimeout(() => $("#ctitle")?.focus(), 30);
      return;
    }
    if (st.step === "rate") {
      const a = st.a, prev = M().me.logs.find((l) => l.key === a.key), stats = M().albumStats(a.key);
      body.innerHTML = `<div class="loghead">${art(a, 96)}<div style="min-width:0"><b class="lt">${esc(a.title)}</b><span class="s">${esc(a.artistName)}${a.year ? ` · ${a.year}` : ""}</span>${stats.n ? `<span class="s">Members: ${stars(Math.round(stats.avg * 2))} from ${stats.n}</span>` : ""}${prev ? `<span class="s">You logged it ${esc(prev.date)}</span>` : ""}</div></div>
        <form id="logform" class="logform">
          <label class="rate"><span>Rating</span><output id="rateout">${stars(st.rating || 0) || "No rating"}</output><input type="range" id="rate" min="0" max="10" step="1" value="${st.rating || 0}" aria-label="Rating, in half stars"></label>
          <div class="logrow"><label for="ldate">Listened on</label><input class="field" type="date" id="ldate" value="${new Date().toISOString().slice(0, 10)}"><label class="chk"><input type="checkbox" id="lre" ${prev ? "checked" : ""}> Heard it before</label></div>
          <label for="ltext" class="sr">Your thoughts</label><textarea id="ltext" rows="4" maxlength="2000" placeholder="What stood out? What did it remind you of?"></textarea>
          <div class="gbtns"><button class="solid hot" type="submit">Save to diary</button><button class="ghost" type="button" data-wantit>${M().me.want.some((w) => w.key === a.key) ? "On your Want list" : "Want to hear instead"}</button>${st.fromPick ? `<button class="ghost" type="button" data-logback>Back</button>` : ""}</div>
        </form>`;
      const r = $("#rate", body); r.oninput = () => { $("#rateout", body).innerHTML = stars(+r.value) || "No rating"; };
      return;
    }
    if (st.step === "done") {
      const a = st.a, A = ctx.A, x = A[a.artist];
      const roots = ctx.sortRel(x.up).filter((u) => !A[u.id].role).slice(0, 3), heirs = ctx.sortRel(x.down).filter((u) => !A[u.id].role).slice(0, 2);
      const row = (r, dir) => { const al = albumsOf(r.id)[0]; return al ? `<li><div class="lrow" style="cursor:default">${art(al, 44)}<span style="min-width:0"><span class="t">${esc(al.title)}</span><span class="s">${esc(A[r.id].name)} · ${dir === "up" ? `shaped ${esc(x.name)}` : `shaped by ${esc(x.name)}`}</span></span><button class="ghost small" data-wantkey="${esc(al.key)}">${M().me.want.some((w) => w.key === al.key) ? "✓ Want" : "+ Want"}</button></div></li>` : ""; };
      body.innerHTML = `<div class="logdone"><span class="human">Logged</span><h2>${esc(a.title)}</h2><p class="qmeta" style="margin:0">That's ${thisYear(M().me).length} album${thisYear(M().me).length === 1 ? "" : "s"} this year${M().me.goal?.n ? ` of your goal of ${M().me.goal.n}` : ""}.</p></div>
        ${roots.length ? `<h3 style="margin:18px 0 8px">Where ${esc(x.name)}'s sound came from</h3><ul class="lg">${roots.map((r) => row(r, "up")).join("")}</ul>` : ""}
        ${heirs.length ? `<h3 style="margin:18px 0 8px">And where it went</h3><ul class="lg">${heirs.map((r) => row(r, "down")).join("")}</ul>` : ""}
        <div class="gbtns" style="margin-top:16px"><button class="solid" data-logmore>Log another</button><a class="ghost" href="#profile" data-closelog>See your diary</a></div>`;
      st.cat = Object.fromEntries([...roots, ...heirs].map((r) => albumsOf(r.id)[0]).filter(Boolean).map((al) => [al.key, al]));
    }
  }
  document.addEventListener("click", (e) => {
    const sh = e.target.closest("#logsheet");
    const la = e.target.closest("[data-logartist]"); if (la) { logState = { step: "custom", artist: la.dataset.logartist }; drawLog(); $("#logsheet").hidden = false; $("#scrim").hidden = false; document.body.classList.add("lock"); return; }
    if (e.target.closest("[data-log]")) { const k = e.target.closest("[data-log]").dataset.log; catalog(); openLog(k ? CAT[k] || M().me.want.find((w) => w.key === k) || M().me.digs?.[window.SL_MIX.isoWeek()] : null); return; }
    if (e.target.closest("[data-closelog]")) { closeLog(); return; }
    if (!sh) return;
    const st = logState;
    const p = e.target.closest("[data-pick]"); if (p) { st.a = st.sug[+p.dataset.pick]; st.step = "rate"; st.fromPick = true; drawLog(); return; }
    const h = e.target.closest("[data-hit]"); if (h) { st.a = st.hits[+h.dataset.hit]; st.step = "rate"; st.fromPick = true; drawLog(); return; }
    const o = e.target.closest("[data-otherof]"); if (o) { st.artist = o.dataset.otherof; st.step = "custom"; drawLog(); return; }
    if (e.target.closest("[data-logback]")) { st.step = "pick"; drawLog(); return; }
    if (e.target.closest("[data-wantit]")) { const on = M().toggleWant(st.a); C().toast(on ? "Added to Want to hear" : "Removed from Want to hear"); closeLog(); return; }
    const wk = e.target.closest("[data-wantkey]"); if (wk) { const al = st.cat[wk.dataset.wantkey]; const on = M().toggleWant(al); wk.textContent = on ? "✓ Want" : "+ Want"; return; }
    if (e.target.closest("[data-logmore]")) { openLog(null); }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "customform") { e.preventDefault(); const t = $("#ctitle").value.trim(); if (!t) return; logState.a = custom(logState.artist, t, +$("#cyear").value || null); logState.step = "rate"; logState.fromPick = true; drawLog(); }
    if (e.target.id === "logform") {
      e.preventDefault();
      const st = logState;
      M().logAlbum(st.a, { rating: +$("#rate").value, text: $("#ltext").value.trim(), date: $("#ldate").value, re: $("#lre").checked });
      st.step = "done"; drawLog(); refreshViews();
    }
  });

  /* ---------- generic sheet ---------- */
  function openSheet(title, html, onclick) {
    $("#gsheet .sheet-t").textContent = title; const b = $("#gbody"); b.innerHTML = html; b.onclick = onclick || null;
    $("#gsheet").hidden = false; $("#scrim").hidden = false; document.body.classList.add("lock");
  }
  function closeSheet() { $("#gsheet").hidden = true; if ($("#panel").hidden && $("#sharesheet").hidden && $("#logsheet").hidden) { $("#scrim").hidden = true; document.body.classList.remove("lock"); } }
  /* pick an album (for Four Favorites, lists, club picks) */
  function pickAlbum(title, done) {
    openSheet(title, `<div class="search logsearch"><svg class="sicon" aria-hidden="true"><use href="#i-search"/></svg><label for="pkq" class="sr">Find an album</label><input id="pkq" type="search" placeholder="Album or artist" autocomplete="off"></div><div id="pkres"></div>`, (e) => { const h = e.target.closest("[data-pk]"); if (h) { closeSheet(); done(hits[+h.dataset.pk]); } });
    let hits = [];
    const q = $("#pkq"); setTimeout(() => q.focus(), 40);
    const logged = M().me.logs.slice(0, 8).map((l) => ({ key: l.key, title: l.title, artist: l.artist, artistName: l.artistName, year: l.year }));
    const show = (list) => { hits = list; $("#pkres").innerHTML = `<ul class="lg" style="margin-top:10px">${list.map((h, i) => `<li><button class="lrow" data-pk="${i}">${art(h, 44)}<span style="min-width:0"><span class="t">${esc(h.title)}</span><span class="s">${esc(h.artistName)}</span></span><span class="r">${h.year || ""}</span></button></li>`).join("")}</ul>`; };
    show(logged);
    q.oninput = () => show(q.value.trim() ? searchAlbums(q.value) : logged);
  }

  /* ---------- shared item renderers ---------- */
  function logCard(uid, l, opts = {}) {
    const target = `${uid}/${l.id}`, lk = M().likes(target).length, cm = M().comments(target).length, mine = uid === M().me.id;
    return `<article class="entry">
      ${opts.showWho ? `<div class="entry-who">${avatar(uid, 28)}${who(uid)}<span class="qmeta">${l.re ? "relistened to" : "logged"} · ${when(l.at)}</span></div>` : ""}
      <div class="entry-main"><button class="entry-art" data-tree="${C().AL[catalog()[l.key]?.albumId] ? "album" : "artist"}" data-id="${esc(catalog()[l.key]?.albumId && C().AL[catalog()[l.key].albumId] ? catalog()[l.key].albumId : l.artist)}" aria-label="Open the lineage">${art(l, 64)}</button>
        <div style="min-width:0"><b class="lt">${esc(l.title)}</b><span class="s"><button class="lnk" data-open="${esc(l.artist)}">${esc(l.artistName)}</button>${l.year ? ` · ${l.year}` : ""}</span>
        <span class="s">${stars(l.rating)}${l.re ? ` <span class="tag" style="padding:0 8px">relisten</span>` : ""} ${opts.showWho ? "" : `<span class="qmeta" style="font-size:.78rem">${esc(l.date)}</span>`}</span></div></div>
      ${l.text ? `<p class="entry-text">${esc(l.text)}</p>` : ""}
      <div class="entry-acts"><button class="act${M().liked(target) ? " on" : ""}" data-like="${esc(target)}" aria-label="Like">♥ <span>${lk || ""}</span></button><button class="act" data-thread="${esc(target)}" aria-label="Comments">💬 <span>${cm || ""}</span></button>${!mine ? `<button class="act" data-log="${esc(l.key)}">+ Log it</button><button class="act" data-wantlog="${esc(uid)}|${esc(l.id)}">Want</button>` : `<button class="act" data-dellog="${esc(l.id)}">Delete</button>`}${!mine ? `<button class="act subtle" data-report="${esc(target)}">Report</button>` : ""}</div>
    </article>`;
  }
  function thread(target) {
    const cs = M().comments(target), owner = M().backend.owner || window.SL_CONFIG?.admin;
    openSheet("Comments", `${cs.length ? `<ul class="thread">${cs.map((c) => `<li>${avatar(c.uid, 30)}<div><span>${who(c.uid)} <span class="qmeta" style="font-size:.76rem">${when(c.at)}</span></span><p>${esc(c.text)}</p>${c.uid === M().me.id ? `<button class="act subtle" data-uncomment="${esc(c.id)}">Delete</button>` : `<button class="act subtle" data-report="${esc(c.uid)}/${esc(c.id)}">Report</button>`}${owner && c.uid !== M().me.id ? `<button class="act subtle" data-hide="${esc(c.uid)}/${esc(c.id)}">Hide</button>` : ""}</div></li>`).join("")}</ul>` : `<p class="qmeta">No comments yet. Start the conversation.</p>`}
      ${M().backend.social ? `<form id="cform" class="addrow" style="margin-top:12px" data-target="${esc(target)}"><label for="ctext" class="sr">Comment</label><input class="field" id="ctext" maxlength="1000" placeholder="Add a comment" autocomplete="off"><button class="solid" type="submit">Post</button></form>` : `<p class="notice">Comments open up when accounts launch.</p>`}`);
  }
  document.addEventListener("submit", (e) => { if (e.target.id === "cform") { e.preventDefault(); const t = $("#ctext").value.trim(); if (!t) return; M().react("comment", e.target.dataset.target, t); thread(e.target.dataset.target); refreshViews(); } });

  /* ---------- profile ---------- */
  function renderProfile(root, uid) {
    const ctx = C(), A = ctx.A, me = M().me; uid = uid || me.id;
    const p = M().S.people[uid];
    if (!p) { root.innerHTML = `<div class="screen-h"><h1>Profile</h1><p class="lede">This person hasn't shared a profile here yet.</p></div>`; return; }
    if (!M().visible(p)) { root.innerHTML = `<div class="screen-h"><h1>${esc(M().nameOf(uid))}</h1><p class="lede">This profile is private. Follow them to see their diary once they follow you back.</p></div><div class="gbtns"><button class="solid" data-follow="${esc(uid)}">${me.follows.includes(uid) ? "Following" : "Follow"}</button></div>`; return; }
    const isMe = uid === me.id, tab = ctx.store.get("sl.ptab", "diary");
    const yr = thisYear(p), avg = p.logs.filter((l) => l.rating).reduce((s, l, _, a) => s + l.rating / a.length / 2, 0);
    const followers = Object.values(M().S.people).filter((x) => (x.follows || []).includes(uid)).length;
    const dnaIds = [...new Set(p.logs.map((l) => l.artist))].filter((i) => A[i]);
    const parts = dnaIds.length >= 2 ? window.SL_SHARE.tasteDNA(dnaIds) : [];
    let match = null;
    if (!isMe && parts.length && me.logs.length >= 2) { const mp = Object.fromEntries(window.SL_SHARE.tasteDNA([...new Set(me.logs.map((l) => l.artist))].filter((i) => A[i]))); match = Math.round(parts.reduce((s, [f, q]) => s + Math.min(q, mp[f] || 0), 0) * 100); }
    const fav = [...(p.fav4 || [])]; while (fav.length < 4) fav.push(null);
    const featured = M().S.site.featured.includes(uid), owner = M().backend.owner;
    const dig = isMe ? weeklyDig(me) : null;
    const tabs = [["diary", `Diary · ${p.logs.length}`], ["reviews", "Reviews"], ["want", `Want · ${p.want.length}`], ["lists", `Lists · ${p.lists.length}`], ["roots", "Roots"]];
    root.innerHTML = `
      <section class="phead">
        ${avatar(uid, 76)}
        <div style="min-width:0"><h1 class="pname">${esc(M().nameOf(uid))}${featured ? ` <span class="role" title="Featured curator">CURATOR</span>` : ""}</h1>
          ${p.handle ? `<span class="qmeta">@${esc(p.handle)}</span>` : ""}${p.bio ? `<p class="pbio">${esc(p.bio)}</p>` : isMe ? `<p class="pbio qmeta">Add a line about what you listen for.</p>` : ""}
          <div class="pcounts"><span><b>${p.logs.length}</b> albums</span><span><b>${followers}</b> followers</span><span><b>${(p.follows || []).length}</b> following</span>${match != null ? `<span><b>${match}%</b> taste match</span>` : ""}</div>
        </div>
      </section>
      <div class="gbtns">${isMe ? `<button class="solid hot" data-log=""><svg><use href="#i-plus"/></svg>Log an album</button><button class="ghost" data-editprofile>Edit profile</button><button class="ghost" data-sharetaste>Share your taste</button><a class="ghost" href="#you">Connections & settings</a>`
        : `<button class="solid" data-follow="${esc(uid)}">${me.follows.includes(uid) ? "Following" : "Follow"}</button><button class="ghost" data-block="${esc(uid)}">${me.blocked?.includes(uid) ? "Unblock" : "Block"}</button>${owner ? `<button class="ghost" data-feature="${esc(uid)}">${featured ? "Remove curator" : "Feature as curator"}</button>` : ""}`}</div>
      ${isMe && M().backend.kind === "local" ? `<p class="notice">${M().S.signedOut ? `<button class="lnk" data-signin>Sign in</button> to save your diary to your account and follow friends.` : "Your diary is kept on this device for now. When accounts launch it moves to your account in one step, and you can export it any time from Connections & settings."}</p>` : ""}

      <section class="sec"><h3>Four favorites</h3><div class="fav4">${fav.map((f, i) => f ? `<button class="fav" ${isMe ? `data-favslot="${i}"` : `data-log="${esc(f.key)}"`} title="${esc(f.title)} · ${esc(f.artistName)}">${art(f, 120)}</button>` : isMe ? `<button class="fav empty" data-favslot="${i}" aria-label="Choose a favorite album">+</button>` : `<span class="fav empty"></span>`).join("")}</div></section>

      ${isMe ? `<section class="weekcard">
        <div class="wk-goal">${ring(yr.length, me.goal?.n || 52, `of ${me.goal?.n || 52} albums in ${new Date().getFullYear()}`)}<button class="lnk" data-goal style="font-size:.8rem">Change goal</button></div>
        <div class="wk-dig">${dig ? `<span class="eyebrow">This week's dig${streak(me) ? ` · ${streak(me)} week streak` : ""}</span>${dig.done ? `<b>Done: ${esc(dig.title)}</b><span class="s">A new dig arrives Monday.</span>` : `<button class="lrow" data-log="${esc(dig.key)}" style="padding:6px 0">${art(dig, 52)}<span style="min-width:0"><span class="t">${esc(dig.title)}</span><span class="s">${esc(dig.artistName)} shaped ${esc(A[dig.because]?.name || "an artist you love")}</span></span><span class="ghost small">Log it</span></button>`}` : `<span class="eyebrow">This week's dig</span><span class="s">Log a few albums and each week you'll get one root to dig into.</span>`}</div>
      </section>` : ""}

      ${parts.length ? `<section class="sec"><h3>Genre DNA of ${isMe ? "your" : "their"} diary</h3>${`<div class="dna-bar">${parts.map(([f, q]) => `<i style="width:${(q * 100).toFixed(1)}%;background:var(--f-${f})"></i>`).join("")}</div>`}<div class="dna-key">${parts.map(([f, q]) => `<span><i style="background:var(--f-${f})"></i>${esc(ctx.FAM[f].short)} <b>${Math.round(q * 100)}%</b></span>`).join("")}</div>${avg ? `<p class="qmeta" style="margin:0">Average rating ${stars(Math.round(avg * 2))}</p>` : ""}</section>` : ""}

      <div class="seg ptabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-ptab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <section id="ptab"></section>`;
    const t = $("#ptab", root);
    if (tab === "diary") {
      if (!p.logs.length) t.innerHTML = isMe ? `<div class="empty"><b>Your diary starts with one album.</b><span>Log what you listened to today. Each entry shows where that record came from and where it led.</span><button class="solid hot" data-log="">Log an album</button></div>` : `<p class="qmeta">Nothing logged yet.</p>`;
      else { let m = ""; t.innerHTML = p.logs.slice(0, 150).map((l) => { const mm = (l.date || "").slice(0, 7); const h = mm !== m ? `<h3 class="month">${new Date(mm + "-15").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>` : ""; m = mm; return h + logCard(uid, l); }).join(""); }
    } else if (tab === "reviews") {
      const rv = p.logs.filter((l) => l.text); t.innerHTML = rv.length ? rv.slice(0, 80).map((l) => logCard(uid, l)).join("") : `<p class="qmeta">No written reviews yet.</p>`;
    } else if (tab === "want") {
      t.innerHTML = p.want.length ? `<div class="shelf-grid">${p.want.map((w) => `<div class="shelf-item">${art(w, 140)}<span class="t">${esc(w.title)}</span><span class="s">${esc(w.artistName)}</span><div class="gbtns"><button class="ghost small" data-log="${esc(w.key)}">Log it</button>${isMe ? `<button class="ghost small" data-unwant="${esc(w.key)}">Remove</button>` : ""}</div></div>`).join("")}</div>` : `<p class="qmeta">${isMe ? "Albums you mean to hear land here. Tap “+ Want” after logging, or on anyone's diary." : "Their Want to hear shelf is empty."}</p>`;
    } else if (tab === "lists") {
      t.innerHTML = `${isMe ? `<button class="solid" data-newlist style="margin-bottom:12px">New list</button>` : ""}${p.lists.length ? `<div class="listcards">${p.lists.map((L) => listCard(uid, L)).join("")}</div>` : `<p class="qmeta">${isMe ? "Make a list: “Where to start with jazz”, “The roots of 90s hip-hop”, “Rainy Sunday records”." : "No lists yet."}</p>`}`;
    } else {
      const R = rootsOf(p).slice(0, 18);
      t.innerHTML = R.length ? `<p class="qmeta" style="margin:0 0 10px">The artists behind the music ${isMe ? "you" : "they"} log, ranked by how many of ${isMe ? "your" : "their"} artists they shaped. Dig into the ones not heard yet.</p><ul class="lg">${R.map((r) => { const al = albumsOf(r.id)[0]; return `<li><div class="lrow" style="cursor:default">${ctx.vinyl(r.id)}<span style="min-width:0"><button class="lnk t" data-open="${r.id}">${esc(A[r.id].name)}</button><span class="s">${r.heard ? "✓ In the diary" : al ? `Start with ${esc(al.title)}` : esc(A[r.id].decade)}</span></span>${!r.heard && al ? `<button class="ghost small" data-log="${esc(al.key)}">Log</button>` : `<span class="r">${A[r.id].decade}</span>`}</div></li>`; }).join("")}</ul>` : `<p class="qmeta">Log a few albums to see your roots.</p>`;
    }
    root.onclick = (e) => {
      const tb = e.target.closest("[data-ptab]"); if (tb) { ctx.store.set("sl.ptab", tb.dataset.ptab); renderProfile(root, uid); return; }
      const fs = e.target.closest("[data-favslot]"); if (fs) { pickAlbum("Choose a favorite", (a) => { M().setFav(+fs.dataset.favslot, a); renderProfile(root, uid); }); return; }
      const uw = e.target.closest("[data-unwant]"); if (uw) { const w = me.want.find((x) => x.key === uw.dataset.unwant); if (w) M().toggleWant(w); renderProfile(root, uid); return; }
      if (e.target.closest("[data-editprofile]")) { editProfile(() => renderProfile(root, uid)); return; }
      if (e.target.closest("[data-goal]")) { openSheet("Your yearly goal", `<form id="goalform" class="addrow"><label for="goaln" class="sr">Albums this year</label><input class="field" id="goaln" type="number" min="1" max="1000" value="${me.goal?.n || 52}"><button class="solid" type="submit">Save</button></form><p class="qmeta">52 is one new album a week.</p>`); return; }
      if (e.target.closest("[data-newlist]")) { editList(null, () => renderProfile(root, uid)); return; }
      const bl = e.target.closest("[data-block]"); if (bl) { me.blocked = me.blocked?.includes(uid) ? me.blocked.filter((x) => x !== uid) : [...(me.blocked || []), uid]; M().save(); renderProfile(root, uid); return; }
      const ft = e.target.closest("[data-feature]"); if (ft) { const s = M().S.site; s.featured = featured ? s.featured.filter((x) => x !== uid) : [...s.featured, uid]; M().backend.saveSite?.(s).then(() => renderProfile(root, uid)); return; }
      if (e.target.closest("[data-signin]")) M().aws.signIn();
    };
  }
  document.addEventListener("submit", (e) => { if (e.target.id === "goalform") { e.preventDefault(); M().me.goal = { year: new Date().getFullYear(), n: Math.max(1, +$("#goaln").value || 52) }; M().save(); closeSheet(); refreshViews(); } });
  function editProfile(done) {
    const me = M().me;
    openSheet("Edit profile", `<form id="pform" class="fixform" style="background:none;padding:0">
      <label for="pfname">Name</label><input class="field" id="pfname" maxlength="40" value="${esc(me.name || M().nameOf(me.id).replace(/^You$/, ""))}" style="border-radius:10px">
      <label for="pfhandle">Handle</label><input class="field" id="pfhandle" maxlength="24" value="${esc(me.handle)}" placeholder="letters and numbers" style="border-radius:10px">
      <label for="pfbio">About</label><textarea id="pfbio" rows="3" maxlength="200" placeholder="What you listen for">${esc(me.bio)}</textarea>
      <label class="chk"><input type="checkbox" id="pfpriv" ${me.private ? "checked" : ""}> Private: only people you follow back can see your diary</label>
      <div class="gbtns"><button class="solid" type="submit">Save</button></div></form>`);
    $("#pform").onsubmit = (e) => { e.preventDefault(); me.name = $("#pfname").value.trim().slice(0, 40); me.handle = $("#pfhandle").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24); me.bio = $("#pfbio").value.trim().slice(0, 200); me.private = $("#pfpriv").checked; M().save(); closeSheet(); done(); };
  }

  /* ---------- lists ---------- */
  function listCard(uid, L) {
    const items = L.items || [];
    return `<a class="listcard" href="#list.${esc(uid)}.${esc(L.id)}"><span class="stack4">${items.slice(0, 4).map((x) => art(x, 64)).join("")}</span><span class="t">${esc(L.title)}</span><span class="s">${items.length} albums · ${esc(M().nameOf(uid))} · ♥ ${M().likes(`list:${uid}/${L.id}`).length}</span></a>`;
  }
  function editList(L, done) {
    const draft = L ? JSON.parse(JSON.stringify(L)) : { title: "", desc: "", items: [] };
    const draw = () => {
      openSheet(L ? "Edit list" : "New list", `<form id="lform" class="fixform" style="background:none;padding:0"><label for="lftitle">Title</label><input class="field" id="lftitle" maxlength="80" required value="${esc(draft.title)}" style="border-radius:10px"><label for="lfdesc">Description</label><textarea id="lfdesc" rows="2" maxlength="500">${esc(draft.desc)}</textarea></form>
        <ul class="lg" style="margin:12px 0">${draft.items.map((x, i) => `<li><div class="lrow" style="cursor:default">${art(x, 44)}<span style="min-width:0"><span class="t">${i + 1}. ${esc(x.title)}</span><span class="s">${esc(x.artistName)}</span></span><span class="gbtns"><button class="ghost small" data-lup="${i}" aria-label="Move up">↑</button><button class="ghost small" data-lrm="${i}" aria-label="Remove">×</button></span></div></li>`).join("") || `<li class="qmeta" style="padding:12px 14px">No albums yet.</li>`}</ul>
        <div class="gbtns"><button class="ghost" data-ladd>Add an album</button><button class="solid" data-lsave>Save list</button>${L ? `<button class="ghost" data-ldel>Delete list</button>` : ""}</div>`, (e) => {
        const keep = () => { draft.title = $("#lftitle").value; draft.desc = $("#lfdesc").value; };
        if (e.target.closest("[data-ladd]")) { keep(); pickAlbum("Add to list", (a) => { draft.items.push({ key: a.key, title: a.title, artist: a.artist, artistName: a.artistName, year: a.year }); draw(); }); }
        const up = e.target.closest("[data-lup]"); if (up) { keep(); const i = +up.dataset.lup; if (i) [draft.items[i - 1], draft.items[i]] = [draft.items[i], draft.items[i - 1]]; draw(); }
        const rm = e.target.closest("[data-lrm]"); if (rm) { keep(); draft.items.splice(+rm.dataset.lrm, 1); draw(); }
        if (e.target.closest("[data-lsave]")) { keep(); if (!draft.title.trim()) { $("#lftitle").focus(); return; } M().saveList({ ...draft, title: draft.title.trim().slice(0, 80), desc: draft.desc.trim().slice(0, 500), items: draft.items.slice(0, 100) }); closeSheet(); done?.(); }
        if (e.target.closest("[data-ldel]")) { M().deleteList(L.id); closeSheet(); done?.(); }
      });
    };
    draw();
  }
  function renderList(root, uid, id) {
    const p = M().S.people[uid], L = p?.lists.find((x) => x.id === id);
    if (!L) { root.innerHTML = `<div class="screen-h"><h1>List</h1><p class="lede">This list isn't available.</p></div>`; return; }
    const target = `list:${uid}/${id}`, isMe = uid === M().me.id;
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">A list by ${who(uid)}</span><h1>${esc(L.title)}</h1>${L.desc ? `<p class="lede">${esc(L.desc)}</p>` : ""}</div>
      <div class="gbtns"><button class="act${M().liked(target) ? " on" : ""}" data-like="${esc(target)}">♥ <span>${M().likes(target).length || ""}</span></button><button class="act" data-thread="${esc(target)}">💬 <span>${M().comments(target).length || ""}</span></button><button class="playline" data-playitems="${esc(JSON.stringify(L.items.filter((x) => C().A[x.artist]).map((x) => ({ id: x.artist, song: "", why: x.title }))))}" data-ptitle="${esc(L.title)}"><svg><use href="#i-play"/></svg>Play previews</button>${isMe ? `<button class="ghost" data-editlist>Edit</button>` : ""}</div>
      <ol class="tracks">${L.items.map((x, i) => `<li class="trk"><span class="n">${i + 1}</span>${art(x, 44)}<span style="min-width:0"><span class="t">${esc(x.title)}</span><button class="lnk a" data-open="${esc(x.artist)}">${esc(x.artistName)}</button>${x.year ? ` <span class="qmeta" style="font-size:.76rem">${x.year}</span>` : ""}</span><button class="ghost small" data-log="${esc(x.key)}">Log</button></li>`).join("")}</ol>`;
    root.onclick = (e) => { if (e.target.closest("[data-editlist]")) editList(L, () => renderList(root, uid, id)); };
  }

  /* ---------- feed, people, inbox ---------- */
  function feedHTML(items) {
    return items.map((f) => {
      if (f.kind === "log") return logCard(f.uid, f.item, { showWho: true });
      if (f.kind === "list") return `<article class="entry"><div class="entry-who">${avatar(f.uid, 28)}${who(f.uid)}<span class="qmeta">made a list · ${when(f.at)}</span></div>${listCard(f.uid, f.item)}</article>`;
      const [tu, tl] = f.item.target.replace(/^list:/, "").split("/"), tp = M().S.people[tu], tlog = tp?.logs.find((x) => x.id === tl);
      return `<article class="entry"><div class="entry-who">${avatar(f.uid, 28)}${who(f.uid)}<span class="qmeta">commented on ${tu === M().me.id ? "your" : `${esc(M().nameOf(tu))}'s`} ${tlog ? esc(tlog.title) : "post"} · ${when(f.at)}</span></div><p class="entry-text">“${esc(f.item.text)}”</p><button class="act" data-thread="${esc(f.item.target)}">See the thread</button></article>`;
    }).join("");
  }
  function renderFeed(root) {
    const items = M().feed(80);
    root.innerHTML = `<div class="screen-h"><h1>Feed</h1><p class="lede">What the people you follow are listening to, rating and listing.</p></div>
      ${items.length ? feedHTML(items) : peopleEmpty()}`;
  }
  function peopleEmpty() {
    return M().backend.social ? `<div class="empty"><b>Follow a few people to fill your feed.</b><span>Find members by taste, or invite friends.</span><a class="solid" href="#people">Find people</a></div>`
      : `<div class="empty"><b>Your feed fills up when accounts launch.</b><span>Until then, everything you log is saved here and will move to your account. Meanwhile, compare taste with friends by sending them your taste link.</span><button class="solid" data-sharetaste>Share your taste</button></div>`;
  }
  function renderPeople(root) {
    const ctx = C(), me = M().me, all = Object.values(M().S.people).filter((p) => p.id !== me.id && M().visible(p) && !me.blocked?.includes(p.id));
    const myIds = [...new Set(me.logs.map((l) => l.artist))].filter((i) => ctx.A[i]);
    const mp = myIds.length >= 2 ? Object.fromEntries(window.SL_SHARE.tasteDNA(myIds)) : null;
    const score = (p) => { const ids = [...new Set(p.logs.map((l) => l.artist))].filter((i) => ctx.A[i]); if (!mp || ids.length < 2) return null; return Math.round(window.SL_SHARE.tasteDNA(ids).reduce((s, [f, q]) => s + Math.min(q, mp[f] || 0), 0) * 100); };
    const rows = all.map((p) => ({ p, m: score(p) })).sort((a, b) => (M().S.site.featured.includes(b.p.id) - M().S.site.featured.includes(a.p.id)) || ((b.m ?? -1) - (a.m ?? -1)) || (b.p.logs.length - a.p.logs.length));
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">Community</span><h1>People</h1><p class="lede">Members ranked by how close their taste is to yours. Curators are picked for knowing where music comes from.</p></div>
      <label class="search" style="display:flex;max-width:none"><svg class="sicon" aria-hidden="true"><use href="#i-search"/></svg><span class="sr">Find people</span><input id="pq" type="search" placeholder="Find people by name" autocomplete="off"></label>
      ${rows.length ? `<ul class="lg" id="plist">${rows.map(({ p, m }) => `<li data-pn="${esc(ctx.norm(M().nameOf(p.id) + " " + p.handle))}"><div class="lrow" style="cursor:default">${avatar(p.id, 44)}<a href="#u.${esc(p.id)}" style="min-width:0;text-decoration:none;color:inherit"><span class="t">${esc(M().nameOf(p.id))}${M().S.site.featured.includes(p.id) ? ` <span class="role">CURATOR</span>` : ""}</span><span class="s">${p.logs.length} albums${m != null ? ` · ${m}% taste match` : ""}${p.logs[0] ? ` · last: ${esc(p.logs[0].title)}` : ""}</span></a><button class="${me.follows.includes(p.id) ? "ghost" : "solid"} small" data-follow="${esc(p.id)}">${me.follows.includes(p.id) ? "Following" : "Follow"}</button></div></li>`).join("")}</ul>` : peopleEmpty()}
      <section class="panel-card"><h2>Invite friends</h2><p class="qmeta" style="margin:0">${M().backend.kind === "claude" ? "Share this page from its Share menu in Claude. Everyone you share it with can log, follow and comment." : "Send your taste link. Friends can compare tastes now and follow you when accounts launch."}</p><div class="gbtns"><button class="solid" data-sharetaste>Share your taste</button></div></section>`;
    $("#pq", root).oninput = (e) => { const t = ctx.norm(e.target.value); root.querySelectorAll("#plist > li").forEach((li) => (li.hidden = t && !li.dataset.pn.includes(t))); };
  }
  function renderInbox(root) {
    const items = M().inbox(); M().markRead(); badge();
    const text = (x) => {
      if (x.t === "follow") return `followed you`;
      const [, id] = x.target.replace(/^list:/, "").split("/"), l = M().me.logs.find((y) => y.id === id), L = M().me.lists.find((y) => y.id === id);
      const what = l ? `your log of ${esc(l.title)}` : L ? `your list ${esc(L.title)}` : "your post";
      return x.t === "like" ? `liked ${what}` : `commented on ${what}: “${esc(x.text)}”`;
    };
    const owner = M().backend.owner;
    const reports = owner ? Object.values(M().S.people).flatMap((p) => (p.reacts || []).filter((r) => r.t === "report").map((r) => ({ ...r, uid: p.id }))) : [];
    root.innerHTML = `<div class="screen-h"><h1>Notifications</h1></div>
      ${items.length ? `<ul class="lg">${items.slice(0, 100).map((x) => `<li><div class="lrow wrap" style="cursor:default">${avatar(x.uid, 40)}<span style="min-width:0"><span class="s" style="white-space:normal;color:var(--fg)">${who(x.uid)} ${text(x)}</span><span class="s">${x.at ? when(x.at) : ""}</span></span>${x.target ? `<button class="ghost small" data-thread="${esc(x.target)}">Open</button>` : `<button class="ghost small" data-follow="${esc(x.uid)}">${M().me.follows.includes(x.uid) ? "Following" : "Follow back"}</button>`}</div></li>`).join("")}</ul>` : `<p class="qmeta">${M().backend.social ? "Likes, comments and new followers show up here." : "Notifications start when accounts launch."}</p>`}
      ${reports.length ? `<section class="sec"><h2>Reports <span class="qmeta">(only you see these)</span></h2><ul class="lg">${reports.map((r) => `<li><div class="lrow wrap" style="cursor:default">${avatar(r.uid, 36)}<span style="min-width:0"><span class="s" style="white-space:normal;color:var(--fg)">${who(r.uid)} reported ${esc(r.target)}</span></span><button class="ghost small" data-hide="${esc(r.target)}">Hide it</button></div></li>`).join("")}</ul></section>` : ""}`;
  }
  function badge() { const n = M().unread(); document.querySelectorAll("[data-badge]").forEach((b) => { b.textContent = n > 9 ? "9+" : n; b.hidden = !n; }); }

  /* ---------- listening clubs ---------- */
  function officialPick(week) {
    const ctx = C(), pool = ctx.ALBUMS.filter((x) => x.up.length >= 2 && ctx.A[x.artist]).sort((a, b) => a.id.localeCompare(b.id));
    const al = pool[ctx.hash("club" + week) % pool.length];
    catalog();
    const asA = (x) => CAT[`${x.artist}::${ctx.norm(x.title).replace(/\s+/g, "-")}`] || custom(x.artist, x.title, x.year);
    return { week, ...asA(al), roots: ctx.sortRel(al.up, ctx.AL).slice(0, 2).map((u) => asA(ctx.AL[u.id])), blurb: al.summary };
  }
  const OFFICIAL = () => ({ id: "lineage", name: "The Lineage Club", desc: "One landmark album a week, plus two records that made it possible. Listen to all three, then talk about what carried over.", owner: null, official: true });
  function clubPick(c, week) { if (c.official) return officialPick(week); const p = (c.picks || []).find((x) => x.week === week); if (!p) return null; const A = C().A; const roots = A[p.artist] ? C().sortRel(A[p.artist].up).filter((u) => !A[u.id].role).slice(0, 2).map((u) => albumsOf(u.id)[0]).filter(Boolean) : []; return { ...p, roots }; }
  const members = (id) => Object.values(M().S.people).filter((p) => (p.clubs || []).includes(id)).map((p) => p.id);
  function renderClubs(root) {
    const wk = window.SL_MIX.isoWeek(), clubs = [OFFICIAL(), ...Object.values(M().S.clubs)];
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">Community</span><h1>Listening clubs</h1><p class="lede">Like a book club, for records. Each week a club picks one album and the two records behind it. Members listen, log and talk.</p></div>
      <div class="clubcards">${clubs.map((c) => { const p = clubPick(c, wk); return `<a class="clubcard" href="#club.${esc(c.id)}">${p ? art(p, 72) : `<span class="vinyl" style="--c:var(--hot);width:72px"></span>`}<span style="min-width:0"><span class="t">${esc(c.name)}${M().me.clubs.includes(c.id) ? ` <span class="tag">joined</span>` : ""}</span><span class="s">${members(c.id).length} members${p ? ` · This week: ${esc(p.title)}` : " · No pick this week yet"}</span></span></a>`; }).join("")}</div>
      ${M().backend.social ? `<section class="panel-card"><h2>Start a club</h2><form id="clubform" class="fixform" style="background:none;padding:0"><label for="cbname">Name</label><input class="field" id="cbname" maxlength="60" required placeholder="Sunday Jazz Roots" style="border-radius:10px"><label for="cbdesc">What it's about</label><textarea id="cbdesc" rows="2" maxlength="400"></textarea><div class="gbtns"><button class="solid" type="submit">Create club</button></div></form></section>` : `<p class="notice">Starting your own club opens when accounts launch. The Lineage Club runs every week now.</p>`}`;
    const f = $("#clubform", root); if (f) f.onsubmit = async (e) => { e.preventDefault(); const c = await M().createClub({ name: $("#cbname").value.trim(), desc: $("#cbdesc").value.trim() }); location.hash = `club.${c.id}`; };
  }
  function renderClub(root, id) {
    const c = id === "lineage" ? OFFICIAL() : M().S.clubs[id];
    if (!c) { root.innerHTML = `<div class="screen-h"><h1>Club</h1><p class="lede">This club isn't available.</p></div>`; return; }
    const wk = window.SL_MIX.isoWeek(), p = clubPick(c, wk), joined = M().me.clubs.includes(c.id), mem = members(c.id), isOwner = c.owner === M().me.id;
    const target = `club:${c.id}:${wk}`, posts = M().reactionsOn(target).filter((r) => r.t === "comment");
    const past = c.official ? [1, 2, 3].map((k) => { const d = new Date(Date.now() - k * 7 * 864e5); return officialPick(window.SL_MIX.isoWeek(d)); }) : (c.picks || []).filter((x) => x.week !== wk).slice(-6).reverse();
    const all3 = p ? [p, ...(p.roots || [])] : [];
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">Listening club${c.official ? " · run by Sound Lineage" : ""}</span><h1>${esc(c.name)}</h1>${c.desc ? `<p class="lede">${esc(c.desc)}</p>` : ""}</div>
      <div class="gbtns"><button class="${joined ? "ghost" : "solid"}" data-joinclub="${esc(c.id)}">${joined ? "Leave club" : "Join club"}</button><span class="qmeta">${mem.length} member${mem.length === 1 ? "" : "s"}</span><span class="avatars">${mem.slice(0, 8).map((u) => avatar(u, 28)).join("")}</span></div>
      ${p ? `<section class="panel-card"><span class="eyebrow">This week · ${esc(window.SL_MIX.LEVELS ? "" : "")}${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <div class="clubpick">${all3.map((x, i) => `<div class="cp">${art(x, 120)}<span class="k">${i ? "The roots" : "The album"}</span><span class="t">${esc(x.title)}</span><span class="s">${esc(x.artistName)}${x.year ? ` · ${x.year}` : ""}</span><button class="ghost small" data-log="${esc(x.key)}">${M().me.logs.some((l) => l.key === x.key) ? "✓ Logged" : "Log it"}</button></div>`).join("")}</div>
          ${p.blurb ? `<p class="qmeta" style="margin:0">${esc(p.blurb)}</p>` : ""}
          <div class="gbtns"><button class="playline" data-playitems="${esc(JSON.stringify(all3.filter((x) => C().A[x.artist]).map((x) => ({ id: x.artist, song: "", why: x.title }))))}" data-ptitle="${esc(c.name)}"><svg><use href="#i-play"/></svg>Play previews</button>${isOwner ? `<button class="ghost" data-setpick>Change this week's pick</button>` : ""}</div></section>`
        : `<section class="panel-card"><b>No pick yet this week.</b>${isOwner ? `<button class="solid" data-setpick>Choose this week's album</button>` : `<span class="qmeta">The club's creator picks each week.</span>`}</section>`}
      <section class="sec"><h2>This week's discussion</h2>
        ${posts.length ? `<ul class="thread">${posts.map((r) => `<li>${avatar(r.uid, 30)}<div><span>${who(r.uid)} <span class="qmeta" style="font-size:.76rem">${when(r.at)}</span></span><p>${esc(r.text)}</p>${r.uid !== M().me.id ? `<button class="act subtle" data-report="${esc(r.uid)}/${esc(r.id)}">Report</button>` : `<button class="act subtle" data-uncomment="${esc(r.id)}">Delete</button>`}</div></li>`).join("")}</ul>` : `<p class="qmeta">No posts yet. What carried over from the roots to the album?</p>`}
        ${M().backend.social ? (joined ? `<form id="clubpost" class="addrow" data-target="${esc(target)}"><label for="cptext" class="sr">Post</label><input class="field" id="cptext" maxlength="1000" placeholder="Share what you heard" autocomplete="off"><button class="solid" type="submit">Post</button></form>` : `<p class="qmeta">Join the club to post.</p>`) : `<p class="notice">Club discussions open when accounts launch. You can still listen and log along.</p>`}
      </section>
      ${past.length ? `<section class="sec"><h3>Earlier picks</h3><div class="row">${past.map((x) => `<button class="rcard" data-log="${esc(x.key)}">${art(x, 148)}<span class="t">${esc(x.title)}</span><span class="s">${esc(x.artistName)}</span></button>`).join("")}</div></section>` : ""}`;
    root.onclick = (e) => {
      if (e.target.closest("[data-setpick]")) pickAlbum("This week's album", async (a) => { await M().setClubPick(c.id, wk, a); renderClub(root, id); });
    };
    const f = $("#clubpost", root); if (f) f.onsubmit = (e) => { e.preventDefault(); const t = $("#cptext").value.trim(); if (!t) return; M().react("comment", target, t); renderClub(root, id); };
  }

  /* ---------- global actions ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-like],[data-thread],[data-follow],[data-report],[data-hide],[data-uncomment],[data-dellog],[data-wantlog],[data-joinclub],[data-closesheet]");
    if (!t) return;
    const me = M().me;
    if (t.dataset.like) { if (!M().backend.social && !t.dataset.like.startsWith(me.id)) { C().toast("Likes open when accounts launch."); return; } const on = M().react("like", t.dataset.like); t.classList.toggle("on", on); const n = t.querySelector("span"); if (n) n.textContent = M().likes(t.dataset.like).length || ""; return; }
    if (t.dataset.thread) { thread(t.dataset.thread); return; }
    if (t.dataset.follow) { if (!M().backend.social) { C().toast("Following opens when accounts launch."); return; } const on = M().follow(t.dataset.follow); t.textContent = on ? "Following" : "Follow"; C().toast(on ? `Following ${M().nameOf(t.dataset.follow)}` : "Unfollowed"); return; }
    if (t.dataset.report) { M().react("report", t.dataset.report); C().toast("Thanks. The owner will review it."); return; }
    if (t.dataset.hide) { const s = M().S.site; s.hidden = [...new Set([...s.hidden, t.dataset.hide])]; M().backend.saveSite?.(s); C().toast("Hidden for everyone"); refreshViews(); return; }
    if (t.dataset.uncomment) { M().unreact(t.dataset.uncomment); closeSheet(); refreshViews(); return; }
    if (t.dataset.dellog) { M().deleteLog(t.dataset.dellog); refreshViews(); return; }
    if (t.dataset.wantlog) { const [u, id] = t.dataset.wantlog.split("|"); const l = M().S.people[u]?.logs.find((x) => x.id === id); if (l) { const on = M().toggleWant(l); C().toast(on ? "Added to Want to hear" : "Removed"); } return; }
    if (t.dataset.joinclub) { if (!M().backend.social && t.dataset.joinclub !== "lineage") { C().toast("Clubs open when accounts launch."); return; } M().joinClub(t.dataset.joinclub); refreshViews(); return; }
    if (t.matches("[data-closesheet]")) closeSheet();
  });
  function refreshViews() { badge(); const v = C().store.get("sl.view", ""); if (["profile", "feed", "people", "inbox", "clubs", "today"].includes(v) || /^(u|club|list)\./.test(location.hash.slice(1))) { window.SL_KEEP_SHEETS = true; window.dispatchEvent(new HashChangeEvent("hashchange")); } }

  /* ---------- Home pieces ---------- */
  function homeHTML() {
    const me = M().me; if (!me) return "";
    const dig = weeklyDig(me), yr = thisYear(me).length, items = M().feed(5);
    return `<section class="weekcard">
        <div class="wk-goal">${ring(yr, me.goal?.n || 52, `of ${me.goal?.n || 52} albums this year`)}<button class="solid hot small" data-log=""><svg><use href="#i-plus"/></svg>Log</button></div>
        <div class="wk-dig">${dig ? `<span class="eyebrow">This week's dig${streak(me) ? ` · ${streak(me)} week streak` : ""}</span>${dig.done ? `<b>Done: ${esc(dig.title)}</b><span class="s">Nice. A new dig arrives Monday.</span>` : `<button class="lrow" data-log="${esc(dig.key)}" style="padding:6px 0">${art(dig, 52)}<span style="min-width:0"><span class="t">${esc(dig.title)}</span><span class="s">${esc(dig.artistName)} · shaped ${esc(C().A[dig.because]?.name || "someone you love")}</span></span><span class="ghost small">Log it</span></button>`}` : `<span class="eyebrow">Start your diary</span><span class="s">Log an album you heard this week. Each week after that you'll get one root to dig into.</span>`}</div>
      </section>
      ${items.length ? `<section class="sec"><div class="shelf-h"><h2>From people you follow</h2><a href="#feed">See all</a></div>${feedHTML(items)}</section>` : M().backend.social ? `<a class="tile" href="#people" style="min-height:0"><b>Find your people</b><span>Follow members whose taste overlaps yours and your feed fills with what they're hearing.</span></a>` : ""}
      ${M().S.site.featured.length ? `<section class="shelf"><div class="shelf-h"><h2>Curators</h2><a href="#people">All people</a></div><div class="row">${M().S.site.featured.filter((u) => M().S.people[u]).map((u) => `<a class="rcard" href="#u.${esc(u)}" style="text-decoration:none">${avatar(u, 148)}<span class="t">${esc(M().nameOf(u))}</span><span class="s">${M().S.people[u].logs.length} albums</span></a>`).join("")}</div></section>` : ""}`;
  }

  window.SL_DIARY = { catalog, searchAlbums, albumsOf, openLog, closeLog, closeSheet, renderProfile, renderFeed, renderPeople, renderInbox, renderList, renderClubs, renderClub, homeHTML, badge, weeklyDig, art, stars, avatar };
})();
