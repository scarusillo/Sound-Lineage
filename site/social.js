/* Ask the lineage, new releases from your lineage, live shows, fan-added links, and buying records.
   Ask answers from the influence data itself, with sources; inside Claude it can also ask Claude for prose. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const enc = encodeURIComponent;
  const inClaude = () => !!window.claude?.use;
  const REPO = "https://github.com/scarusillo/Sound-Lineage";

  /* ---------- ask ---------- */
  let NAMES = null;
  function names() {
    if (NAMES) return NAMES;
    const ctx = C();
    NAMES = ctx.ARTISTS.map((a) => [` ${ctx.norm(a.name)} `, a.id]).filter(([n]) => n.trim().length >= 2).sort((a, b) => b[0].length - a[0].length);
    return NAMES;
  }
  function mentions(text) {
    const ctx = C(); let t = ` ${ctx.norm(text)} `; const out = [];
    for (const [n, id] of names()) { const i = t.indexOf(n); if (i >= 0) { out.push([i, id]); t = t.slice(0, i) + " ".repeat(n.length) + t.slice(i + n.length); } }
    return out.sort((a, b) => a[0] - b[0]).map(([, id]) => id);
  }
  function rel(r, dirFrom, dirTo) {
    const ctx = C();
    return `<li><div class="hd">${ctx.chip(r.id)}<span class="mono qmeta" style="font-size:.74rem">${esc(ctx.A[r.id].decade)}</span></div>${r.why ? `<span class="why">${esc(r.why)}</span>` : ""}${ctx.srcHTML(dirFrom ?? r.id, dirTo ?? r.id)}</li>`;
  }
  function answer(q) {
    const ctx = C(), A = ctx.A, ids = mentions(q), t = q.toLowerCase();
    if (!ids.length) return { html: `<p>I couldn't find an artist on the map in that question. Try a name, like “Why does Tame Impala sound like that?”</p>` };
    const play = (items, title) => `<button class="playline" data-playitems="${esc(JSON.stringify(items))}" data-ptitle="${esc(title)}"><svg><use href="#i-play"/></svg>Play it</button>`;
    if (ids.length >= 2) {
      const [a, b] = ids, p = ctx.anyPath(a, b);
      if (!p) return { html: `<p>There's no line between ${esc(A[a].name)} and ${esc(A[b].name)} on the map yet.</p>` };
      return { ids: [a, b], html: `<p><b>${p.length - 1} step${p.length === 2 ? "" : "s"}</b> connect ${esc(A[a].name)} and ${esc(A[b].name)}:</p><ol class="rels">${p.map((s, i) => `<li><div class="hd">${ctx.chip(s.id)}<span class="qmeta" style="font-size:.78rem">${i ? (s.dir === "f" ? `was shaped by ${esc(A[p[i - 1].id].name)}` : `shaped ${esc(A[p[i - 1].id].name)}`) : "start"}</span></div>${i ? `<span class="why">${esc(ctx.edgeWhy(p[i - 1].id, s.id))}</span>` : ""}</li>`).join("")}</ol>${play(p.map((s) => ({ id: s.id })), `${A[a].name} to ${A[b].name}`)}` };
    }
    const id = ids[0], x = A[id];
    if (/produc|credit|worked with|session/.test(t) && x.role) {
      return { ids: [id], html: `<p>${esc(x.name)} has ${x.down.length} credits on the map:</p><ul class="rels">${ctx.sortRel(x.down).slice(0, 10).map((r) => rel(r, id, r.id)).join("")}</ul>` };
    }
    const whyQ = /\bwhy\b|sound like|where .*(come|came) from|roots|influenc|shaped/.test(t);
    if (!whyQ && /after|next|similar|recommend|more like|should i|if i like|fans? of|play after/.test(t)) {
      const heirs = ctx.sortRel(x.down).filter((r) => !A[r.id].role).slice(0, 5), cous = (x.cousins || []).filter((c) => A[c.id]).slice(0, 3);
      return { ids: [id], html: `<p>If you like ${esc(x.name)}, follow the line forward to the artists they shaped${cous.length ? `, or cross into another genre with their cousins` : ""}.</p><h3>Where it went</h3><ul class="rels">${heirs.map((r) => rel(r, id, r.id)).join("")}</ul>${cous.length ? `<h3>Across genres</h3><ul class="rels">${cous.map((c) => `<li><div class="hd">${ctx.chip(c.id)}</div><span class="why">${esc(c.why)}</span></li>`).join("")}</ul>` : ""}${play([{ id }, ...heirs.map((r) => ({ id: r.id, why: r.why })), ...cous.map((c) => ({ id: c.id, why: c.why }))], `After ${x.name}`)}` };
    }
    const roots = ctx.sortRel(x.up).slice(0, 6), parts = ctx.dna(id), F = ctx.FAM;
    const recipe = parts.length > 1 ? parts.slice(0, 3).map(([f, p]) => `${Math.round(p * 100)}% ${F[f].short.toLowerCase()}`).join(", ") : F[x.family].name.toLowerCase();
    return { ids: [id], html: `<p>${esc(x.summary || "")}</p><p>On the map, ${esc(x.name)}'s sound breaks down as <b>${esc(recipe)}</b>. It comes most directly from these artists:</p><ul class="rels">${roots.map((r) => rel(r, r.id, id)).join("") || "<li>No influences mapped yet.</li>"}</ul>${ctx.dnaHTML(id)}<div class="gbtns">${play([...roots.slice(0, 5).reverse().map((r) => ({ id: r.id, why: r.why })), { id }], `Where ${x.name} came from`)}<button class="ghost" data-tree="artist" data-id="${id}">Open the family tree</button></div>` };
  }
  async function claudeAnswer(q, out, ids) {
    const sample = await window.claude.use("sample"); if (!sample) { out.innerHTML = `<p class="qmeta">Asking Claude isn't available in this view.</p>`; return; }
    const ctx = C(), A = ctx.A;
    const facts = (id) => { const a = A[id]; if (!a) return null; return { name: a.name, decade: a.decade, genre: ctx.FAM[a.family].name, origin: a.origin, summary: a.summary, genreDNA: ctx.dna(id).map(([f, p]) => `${ctx.FAM[f].short} ${Math.round(p * 100)}%`), influencedBy: ctx.sortRel(a.up).slice(0, 10).map((r) => ({ artist: A[r.id].name, why: r.why })), influenced: ctx.sortRel(a.down).slice(0, 10).map((r) => ({ artist: A[r.id].name, why: r.why })) }; };
    const tools = [
      { name: "lookup_artist", description: "Facts about one artist on the Sound Lineage map: summary, genre DNA, who influenced them and whom they influenced, each with the reason.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }, execute: ({ name }) => { const id = mentions(name)[0]; return id ? facts(id) : { error: "not on the map" }; } },
      { name: "find_path", description: "Shortest chain of influence links between two artists on the map.", inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] }, execute: ({ from, to }) => { const a = mentions(from)[0], b = mentions(to)[0]; const p = a && b && ctx.anyPath(a, b); return p ? p.map((s, i) => ({ artist: A[s.id].name, link: i ? ctx.edgeWhy(p[i - 1].id, s.id) : null })) : { error: "no path" }; } },
    ];
    out.innerHTML = `<p class="qmeta">Thinking…</p>`;
    try {
      await sample(`You answer music questions for Sound Lineage, an app that maps who influenced whom. Use the tools to read the map's facts, and answer only from those facts. Write 2 short paragraphs in plain language, no markdown headings, no lists. Name the artists and say why each link exists. Question: ${q}${ids?.length ? `\nArtists mentioned: ${ids.map((i) => A[i].name).join(", ")}` : ""}`,
        { tools, modelTier: "default", cache: false, onText: ({ text }) => { out.textContent = text; } });
    } catch (e) { out.innerHTML = `<p class="qmeta">${e?.code === "rate_limited" ? "Claude is busy. Try again in a minute." : "Claude couldn't answer just now."}</p>`; }
  }
  function renderAsk(root) {
    const ctx = C(), my = window.SL_YOU.yourIds();
    const a1 = my[0] || "tame-impala", a2 = my[1] || "radiohead";
    const sug = [`Why does ${ctx.A[a1]?.name || "Tame Impala"} sound like that?`, `How did Robert Johnson lead to The White Stripes?`, `What should I play after ${ctx.A[a2]?.name || "Radiohead"}?`, `Who did Rick Rubin work with?`];
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">Ask the lineage</span><h1>Ask about any artist</h1><p class="lede">Why someone sounds the way they do, how two artists connect, or what to play next. Answers come straight from the influence map, with the reasons and sources behind each link.</p></div>
      <form class="askbar" id="askform"><label for="askq" class="sr">Your question</label><input class="field" id="askq" type="search" placeholder="Why does Billie Eilish sound like that?" autocomplete="off" enterkeyhint="send"><button class="solid" type="submit">Ask</button></form>
      <div class="chips">${sug.map((s) => `<button class="ghost small" data-asks="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <section class="panel-card" id="askout" hidden></section>`;
    const run = (q) => {
      $("#askq", root).value = q;
      const r = answer(q), out = $("#askout", root);
      out.hidden = false;
      out.innerHTML = `<h2>${esc(q)}</h2>${r.html}${inClaude() ? `<div class="gbtns"><button class="ghost" data-askclaude>Ask Claude for a fuller answer</button></div><div id="askclaude" class="ask-claude"></div>` : ""}`;
      out.onclick = (e) => { if (e.target.closest("[data-askclaude]")) { e.target.closest("[data-askclaude]").remove(); claudeAnswer(q, $("#askclaude", out), r.ids); } };
    };
    $("#askform", root).onsubmit = (e) => { e.preventDefault(); const q = $("#askq", root).value.trim(); if (q) run(q); };
    root.querySelectorAll("[data-asks]").forEach((b) => (b.onclick = () => run(b.dataset.asks)));
  }

  /* ---------- new releases ---------- */
  let REL = null;
  const releases = () => (REL ??= fetch("data/releases.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
  function relCard(r) {
    const ctx = C(), a = ctx.A[r.id];
    const art = r.art && !inClaude() ? `<img class="sleeve" src="${esc(r.art)}" alt="" loading="lazy" style="object-fit:cover">` : ctx.sleeve({ id: r.id + r.title, title: r.title, artist: r.id, year: r.date.slice(0, 4) });
    return `<a class="rcard" href="${esc(r.url || `https://music.apple.com/us/search?term=${enc(r.title + " " + a.name)}`)}" target="_blank" rel="noopener" style="text-decoration:none;--vs:148px">${art}<span class="t">${esc(r.title)}</span><span class="s">${esc(a.name)} · ${esc(r.kind)} · ${new Date(r.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></a>`;
  }
  async function releasesShelf(el) {
    const d = await releases(); if (!d || !d.items?.length) { el.hidden = true; return; }
    const ctx = C(), A = ctx.A, mine = window.SL_YOU.yourIds(), near = new Set(mine);
    mine.slice(0, 30).forEach((id) => { A[id].down.forEach((x) => near.add(x.id)); A[id].up.forEach((x) => near.add(x.id)); });
    const items = d.items.filter((r) => A[r.id]);
    const pers = mine.length ? items.filter((r) => near.has(r.id)) : [];
    const list = (pers.length >= 3 ? pers : items).slice(0, 14);
    el.hidden = false;
    el.innerHTML = `<div class="shelf-h"><h2>${pers.length >= 3 ? "New from your lineage" : "New from artists on the map"}</h2><span class="qmeta" style="font-size:.78rem">Updated ${new Date(d.updated + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><div class="row">${list.map(relCard).join("")}</div>`;
  }

  /* ---------- live shows (Ticketmaster key, public site) ---------- */
  function showsHTML() {
    const key = C().store.get("sl.tmkey", "");
    if (inClaude()) return `<p class="qmeta" style="margin:0">Live show listings work on the public site at scarusillo.github.io/Sound-Lineage.</p>`;
    return `<div class="sec" id="showsbox"><h3>Shows from your lineage</h3>
      ${key ? `<div class="gbtns"><button class="solid" data-findshows>Find shows near me</button><button class="ghost small" data-tmclear>Remove key</button></div><div id="showsout"></div>`
        : `<p class="qmeta" style="margin:0">Concert listings come from Ticketmaster. Get a free key at <a href="https://developer.ticketmaster.com/" target="_blank" rel="noopener">developer.ticketmaster.com</a> (sign up, then copy the “Consumer Key”), and paste it here. It stays in this browser.</p><form class="addrow" id="tmform"><input class="field" id="tmkey" placeholder="Ticketmaster consumer key" autocomplete="off"><button class="solid" type="submit">Save key</button></form>`}</div>`;
  }
  async function findShows(out) {
    const ctx = C(), A = ctx.A, key = ctx.store.get("sl.tmkey", ""), city = ctx.store.get("sl.city", "").split(",")[0].trim();
    const mine = window.SL_YOU.yourIds(), recs = window.SL_YOU.recommend(mine).map((r) => r.id);
    const who = [...new Set([...mine.slice(0, 15), ...recs.slice(0, 25)])].filter((id) => ["1990s", "2000s", "2010s", "2020s"].includes(A[id].decade) || A[id].years?.includes("present")).slice(0, 30);
    if (!who.length) { out.innerHTML = `<p class="qmeta">Add a few artists first.</p>`; return; }
    out.innerHTML = `<p class="qmeta">Checking ${who.length} artists${city ? ` near ${esc(city)}` : ""}…</p>`;
    const found = [];
    for (const id of who) {
      try {
        const u = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${enc(key)}&keyword=${enc(A[id].name)}&classificationName=music&sort=date,asc&size=4${city ? `&city=${enc(city)}` : "&countryCode=US"}`;
        const r = await fetch(u); if (r.status === 401) { out.innerHTML = `<p class="qmeta">Ticketmaster didn't accept that key. Check it and save it again.</p>`; return; }
        const d = await r.json();
        for (const e of d._embedded?.events || []) if ((e._embedded?.attractions || []).some((x) => ctx.norm(x.name) === ctx.norm(A[id].name))) found.push({ id, name: e.name, date: e.dates?.start?.localDate, venue: e._embedded?.venues?.[0]?.name, city: e._embedded?.venues?.[0]?.city?.name, url: e.url, mine: mine.includes(id) });
      } catch { /* skip */ }
      await new Promise((r) => setTimeout(r, 230));
    }
    found.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    out.innerHTML = found.length ? `<ul class="lg">${found.slice(0, 25).map((s) => `<li><a class="lrow wrap" href="${esc(s.url)}" target="_blank" rel="noopener" style="text-decoration:none">${ctx.vinyl(s.id)}<span style="min-width:0"><span class="t">${esc(A[s.id].name)}</span><span class="s">${esc(s.venue || "")}${s.city ? `, ${esc(s.city)}` : ""} · ${s.mine ? "you play them" : "in your lineage"}</span></span><span class="r">${s.date ? new Date(s.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span></a></li>`).join("")}</ul>` : `<p class="qmeta">No upcoming shows found for your lineage${city ? ` near ${esc(city)}` : ""}. Try a bigger nearby city in Near you.</p>`;
  }
  document.addEventListener("submit", (e) => {
    if (e.target.id === "tmform") { e.preventDefault(); const k = $("#tmkey").value.trim(); if (k) { C().store.set("sl.tmkey", k); $("#showsbox").outerHTML = showsHTML(); } }
  });
  document.addEventListener("click", (e) => {
    const fs = e.target.closest("[data-findshows]");
    if (fs && !fs.disabled) { fs.disabled = true; findShows($("#showsout")).finally(() => (fs.disabled = false)); }
    if (e.target.closest("[data-tmclear]")) { C().store.del("sl.tmkey"); $("#showsbox").outerHTML = showsHTML(); }
  });

  /* ---------- fan-added links ---------- */
  function addLinkHTML(id) {
    return `<form id="linkform" class="fixform" hidden data-for="${esc(id)}">
      <label for="lkdir">This artist…</label>
      <select id="lkdir"><option value="up">was influenced by</option><option value="down">influenced</option></select>
      <label for="lkwho">Which artist?</label>
      <div style="position:relative"><input class="field" id="lkwho" autocomplete="off" placeholder="Start typing a name" style="border-radius:8px"><div class="qres" id="lkres" hidden></div></div>
      <label for="lkwhy">How do you know? One sentence on the connection</label>
      <textarea id="lkwhy" rows="2" required maxlength="400"></textarea>
      <label for="lksrc">Source link (an interview or article)</label>
      <input class="field" id="lksrc" type="url" placeholder="https://" style="border-radius:8px">
      <div class="gbtns"><button class="qnext" type="submit">Send link</button><button class="ghost" type="button" data-lkcancel>Cancel</button></div>
      <p class="qmeta" id="lkmsg" style="margin:0"></p></form>`;
  }
  function wireAddLink(root) {
    const ctx = C(), f = $("#linkform", root); if (!f) return;
    const w = $("#lkwho", f), res = $("#lkres", f);
    w.oninput = () => { w.dataset.id = ""; res.innerHTML = ctx.hitsHTML(ctx.searchHits(w.value, ["artist"], 6), "Not on the map; write the name and we'll add them"); res.hidden = !w.value.trim(); };
    res.onclick = (e) => { const b = e.target.closest("button[data-id]"); if (b) { w.value = ctx.A[b.dataset.id].name; w.dataset.id = b.dataset.id; res.hidden = true; } };
    f.onsubmit = async (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = f.dataset.for, other = w.dataset.id || "", otherName = w.value.trim(), dir = $("#lkdir", f).value, why = $("#lkwhy", f).value.trim(), src = $("#lksrc", f).value.trim(), msg = $("#lkmsg", f);
      if (!otherName || !why) { msg.textContent = "Add the other artist and one sentence on the connection."; return; }
      const from = dir === "up" ? (other || otherName) : id, to = dir === "up" ? id : (other || otherName);
      const A = ctx.A, nm = (x) => A[x]?.name || x;
      if (inClaude()) {
        const [d, u] = await Promise.all([ctx.db(), ctx.user()]); const uid = u && (await u.id());
        if (!d || !uid) { msg.textContent = "Sign in to Claude on this page to send a link."; return; }
        msg.textContent = "Sending…";
        try {
          const ref = d.doc(`corrections/${uid}`), snap = await ref.get();
          const reports = (snap.exists && Array.isArray(snap.data()?.reports) ? snap.data().reports : []).slice(-199);
          reports.push({ type: "link", artist: id, from, to, why: why.slice(0, 400), src: src.slice(0, 500), field: "New link", text: `${nm(from)} → ${nm(to)}: ${why}${src ? ` (${src})` : ""}`, by: uid, at: new Date().toISOString() });
          await ref.set({ reports });
          msg.textContent = "Thank you. Your link goes live once it's reviewed, with credit to you."; f.reset(); w.dataset.id = "";
        } catch { msg.textContent = "Your link couldn't be sent. Ask the owner for Contributor access."; }
      } else {
        const body = `**From:** ${nm(from)}\n**To:** ${nm(to)} (was influenced by ${nm(from)})\n**Why:** ${why}\n**Source:** ${src || "none given"}\n\n_Sent from the Sound Lineage app._`;
        window.open(`${REPO}/issues/new?title=${enc(`New link: ${nm(from)} → ${nm(to)}`)}&body=${enc(body)}&labels=new-link`, "_blank", "noopener");
        msg.textContent = "GitHub opened with your link filled in. Submit it there and it's added on review, with credit to you.";
      }
    };
  }
  /* approved fan links, shown to everyone in the Claude version */
  async function loadApproved() {
    if (!inClaude()) return [];
    try { const d = await C().db(); if (!d) return []; const s = await d.doc("approved/links").get(); return s.exists && Array.isArray(s.data()?.links) ? s.data().links : []; } catch { return []; }
  }
  async function approve(r) {
    const d = await C().db(); if (!d) return false;
    const ref = d.doc("approved/links"), s = await ref.get();
    const links = s.exists && Array.isArray(s.data()?.links) ? s.data().links : [];
    if (!links.some((l) => l.from === r.from && l.to === r.to)) links.push({ from: r.from, to: r.to, why: r.why, src: r.src || "", by: r.by || "", at: new Date().toISOString() });
    await ref.set({ links: links.slice(-500) });
    return true;
  }

  /* ---------- own it ---------- */
  function ownHTML(a) {
    return `<div class="p-sec"><h3>Own it</h3><div class="listen"><a target="_blank" rel="noopener" href="https://www.discogs.com/search/?q=${enc(a.name)}&type=all&format_exact=Vinyl">Vinyl on Discogs</a><a target="_blank" rel="noopener" href="https://bandcamp.com/search?q=${enc(a.name)}">Bandcamp</a><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/${enc("independent record store near " + (C().store.get("sl.city", "") || "me"))}">Record stores near you</a></div></div>`;
  }

  window.SL_SOCIAL = { renderAsk, answer, releasesShelf, showsHTML, addLinkHTML, wireAddLink, loadApproved, approve, ownHTML, mentions };
})();
