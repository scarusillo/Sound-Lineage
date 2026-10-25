/* Family tree: two generations each side of one artist, album or song, wired together with drawn curves.
   Hover a name to see why it's linked; click (or tap twice on a phone) to move the tree. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KIND = {
    artist: { label: "Artists", up: "Influenced by", down: "Influenced", gup: "Their influences", gdown: "And then", start: "the-beatles" },
    album: { label: "Albums", up: "Came from", down: "Led to", gup: "Before that", gdown: "And then", start: "sgt-pepper" },
    song: { label: "Songs", up: "Built from", down: "Reused in", gup: "Before that", gdown: "And then", start: "levee-zeppelin" },
  };
  let state = null;
  const S = () => (state ??= C().store.get("sl.tree2", { kind: "artist", gen: window.innerWidth > 980 ? 2 : 1, artist: null, album: null, song: null }));
  const save = () => C().store.set("sl.tree2", S());
  const map = (k) => (k === "artist" ? C().A : k === "album" ? C().AL : C().SO);
  const list = (k) => (k === "artist" ? C().ARTISTS : k === "album" ? C().ALBUMS : C().SONGS);
  const nameOf = (k, id) => { const x = map(k)[id]; return x ? x.name || x.title : id; };
  const famOf = (k, id) => { const x = map(k)[id]; if (!x) return "metal"; return k === "artist" ? x.family : C().A[x.artist]?.family || "metal"; };
  const sub = (k, id) => { const x = map(k)[id]; return k === "artist" ? x.decade.replace("s", "s") : String(x.year); };
  const weight = (k, id) => { const x = map(k)[id]; return k === "artist" ? x.reach : x.up.length + x.down.length; };
  function cur(k) {
    const st = S(); k ??= st.kind;
    let t = st[k];
    if (!t || !map(k)[t.cur]) {
      const id = map(k)[KIND[k].start] ? KIND[k].start : [...list(k)].sort((a, b) => (b.up.length + b.down.length) - (a.up.length + a.down.length))[0].id;
      t = st[k] = { cur: id, trail: [id] };
    }
    return t;
  }
  function setTree(k, id) {
    const st = S(); st.kind = k; const t = cur(k);
    const i = t.trail.indexOf(id);
    if (i >= 0) t.trail.length = i + 1; else t.trail.push(id);
    if (t.trail.length > 10) t.trail.splice(0, t.trail.length - 10);
    t.cur = id; save();
  }
  function setKind(k) { S().kind = k; save(); }
  function show(k, id) { setTree(k, id); C().go("tree"); }

  const sortRel = (k, arr) => [...arr].sort((a, b) => ((b.s || 2) - (a.s || 2)) || (weight(k, b.id) - weight(k, a.id)));
  function second(k, firsts, dir, exclude, n) {
    const score = {}, why = {};
    for (const f of firsts) for (const r of map(k)[f.id][dir]) {
      if (exclude.has(r.id)) continue;
      score[r.id] = (score[r.id] || 0) + 1; (why[r.id] ??= []).push(f.id);
    }
    return Object.keys(score).sort((a, b) => (score[b] - score[a]) || (weight(k, b) - weight(k, a))).slice(0, n).map((id) => ({ id, via: why[id] }));
  }

  function nodeBtn(k, id, rel, extra = "") {
    return `<button class="nd ${rel === "gup" || rel === "gdown" ? "gp" : ""}" data-nid="${id}" data-rel="${rel}" ${C().famStyle(famOf(k, id))}>${k === "artist" ? C().vinyl(id) : `<span class="vinyl" style="--c:var(--f-${famOf(k, id)})"></span>`}<span class="t">${esc(nameOf(k, id))}</span><small>${esc(sub(k, id))}</small>${extra}</button>`;
  }

  let ro = null, pendingTouch = false, selected = null;
  function render(root, enter = false) {
    const ctx = C(), st = S(), k = st.kind, K = KIND[k], t = cur(k), m = map(k), x = m[t.cur];
    const wide = window.innerWidth > 980, gen = wide ? st.gen : 1;
    const more = ctx.store.get("sl.treeMore2", {});
    const N = 12;
    const ups = sortRel(k, x.up), downs = sortRel(k, x.down);
    const upShown = more[`${k}:${x.id}:u`] ? ups : ups.slice(0, N);
    const downShown = more[`${k}:${x.id}:d`] ? downs : downs.slice(0, N);
    const ex = new Set([x.id, ...ups.map((r) => r.id), ...downs.map((r) => r.id)]);
    const gups = gen === 2 ? second(k, upShown, "up", ex, 12) : [];
    const gdowns = gen === 2 ? second(k, downShown, "down", ex, 12) : [];
    const fam = famOf(k, x.id);
    let centerHTML;
    if (k === "artist") {
      centerHTML = `<div class="ch">${ctx.vinyl(x.id)}<div style="min-width:0"><div class="k">${x.role ? `<span class="role">${x.role === "producer" ? "PRODUCER" : "SESSION"}</span>` : ""}${esc(ctx.FAM[x.family].name)} · ${esc(x.decade)}</div>
        <h2>${esc(x.name)}</h2></div></div>
        <div class="meta">${x.years ? `<span class="tag mono">${esc(x.years)}</span>` : ""}${x.origin ? `<span class="tag">${esc(x.origin)}</span>` : ""}${(x.genres || []).slice(0, 2).map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div>
        ${x.summary ? `<p>${esc(x.summary)}</p>` : ""}
        ${ctx.dnaHTML(x.id)}
        <div class="gbtns"><button class="playline" data-playline="${x.id}"><svg><use href="#i-play"/></svg>Play the lineage</button><button class="solid" data-open="${x.id}">Profile</button><a class="spot-btn" target="_blank" rel="noopener" href="https://open.spotify.com/search/${ctx.enc(x.name)}"><span class="sp" aria-hidden="true"></span>Play</a><button class="ghost" data-sharetree="${x.id}"><svg><use href="#i-share"/></svg>Share</button></div>`;
    } else if (k === "album") {
      const a = ctx.A[x.artist];
      centerHTML = `<div class="ch">${ctx.sleeve(x)}<div style="min-width:0"><div class="k">Album · ${esc(x.sub)}</div>
        <h2>${esc(x.title)}</h2></div></div>
        <div class="meta">${a ? ctx.chip(a.id) : ""}<span class="tag mono">${x.released ? new Date(x.released + "T12:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : x.year}</span></div>
        ${x.summary ? `<p>${esc(x.summary)}</p>` : ""}
        ${ctx.listenLinks(`${x.title} ${a?.name || ""}`)}`;
    } else {
      const a = ctx.A[x.artist];
      centerHTML = `<div class="ch">${ctx.sleeve(x, "song")}<div style="min-width:0"><div class="k">Song · ${x.year}</div>
        <h2>${esc(x.title)}</h2></div></div>
        <div class="meta">${a ? ctx.chip(a.id) : `<span class="tag">${esc(x.artistName || "")}</span>`}</div>
        ${ctx.listenLinks(`${x.title} ${x.artistName || a?.name || ""}`)}`;
    }
    const KD = k === "artist" && x.role ? "Produced, played on or shaped" : K.down;
    const col = (cls, title, items, rel, moreKey, total) => `<div class="col ${cls}"><h3>${title}${total ? ` · ${total}` : ""}</h3>${items.length ? items.map((r) => nodeBtn(k, r.id, rel)).join("") : `<span class="empty-col">${rel === "up" ? "A root of the tree here" : rel === "down" ? "Nothing mapped yet" : "—"}</span>`}${moreKey && total > N ? `<button class="more-n" data-more2="${moreKey}">${more[moreKey] ? "Show fewer" : `+ ${total - N} more`}</button>` : ""}</div>`;
    const crumbs = t.trail.length > 1 ? `<nav class="crumbs" aria-label="Your path">${t.trail.map((id, i) => `${i ? `<span class="sep">›</span>` : ""}<button class="${i === t.trail.length - 1 ? "here" : ""}" data-crumb="${id}">${esc(nameOf(k, id))}</button>`).join("")}</nav>` : "";
    const cousins = (x.cousins || []).filter((c) => m[c.id]);
    const starters = k !== "artist" ? [...list(k)].sort((a, b) => (b.up.length + b.down.length) - (a.up.length + a.down.length)).slice(0, 14) : [];
    root.innerHTML = `
      <div class="tree-top">
        <div class="screen-h"><h1>Lineage</h1><p class="lede">${k === "artist" ? (wide ? "What shaped them on the left, who they shaped on the right. Hover a name to see why; click it to move the tree." : "Who shaped them, and who they shaped. Tap a name to see why, tap again to move the tree.") : k === "album" ? "Landmark albums and the records they led to. Tap any album to move the tree." : "Where a song came from and who sampled, replayed or reworked it. Tap any song to move the tree."}</p></div>
        <div class="tree-ctl">
          <div class="seg" role="group" aria-label="Tree type">${Object.entries(KIND).map(([kk, v]) => `<button data-kind="${kk}" class="${kk === k ? "on" : ""}">${v.label}</button>`).join("")}</div>
          ${wide ? `<div class="seg" role="group" aria-label="Generations"><button data-gen="1" class="${gen === 1 ? "on" : ""}">1 generation</button><button data-gen="2" class="${gen === 2 ? "on" : ""}">2 generations</button></div>` : ""}
        </div>
      </div>
      ${k === "artist" ? window.SL_SPOT.nowHTML() : ""}
      ${crumbs}
      <div class="lineage ${gen === 1 ? "g1" : ""} ${enter ? "enter" : ""}" id="lineage">
        <svg class="wires" id="wires" aria-hidden="true"></svg>
        ${gen === 2 ? col("left up gp-col", K.gup, gups, "gup") : ""}
        ${col("left up", K.up, upShown, "up", `${k}:${x.id}:u`, ups.length)}
        <div class="center" ${ctx.famStyle(fam)} id="center">${centerHTML}
          <div class="why-bar" id="whybar"><span>${k === "artist" ? (wide ? "Hover any name to see why it's connected." : "Tap any name to see why it's connected.") : (wide ? "Hover any name to see how it's connected." : "Tap any name to see how it's connected.")}</span></div>
        </div>
        ${col("right down", KD, downShown, "down", `${k}:${x.id}:d`, downs.length)}
        ${gen === 2 ? col("right down gp-col", K.gdown, gdowns, "gdown") : ""}
      </div>
      ${cousins.length ? `<section class="cousins"><h3>${k === "artist" ? `If you like ${esc(x.name)}, try these in other genres` : "Same spirit, different genre"}</h3><ul>${cousins.map((c) => `<li>${k === "artist" ? ctx.chip(c.id) : `<button class="chip" data-nav="${c.id}" ${ctx.famStyle(famOf(k, c.id))}>${esc(nameOf(k, c.id))}</button>`}<span>${esc(c.why)}</span></li>`).join("")}</ul></section>` : ""}
      ${starters.length ? `<section class="cousins"><h3>Start somewhere else</h3><div class="chips">${starters.map((s) => `<button class="chip" data-nav="${s.id}" ${ctx.famStyle(famOf(k, s.id))}>${esc(nameOf(k, s.id))}</button>`).join("")}</div></section>` : ""}
      ${k === "artist" ? connectHTML(x.id) : ""}`;

    // edges among shown nodes
    const lin = $("#lineage", root);
    const el = (rel, id) => lin.querySelector(`.nd[data-rel="${rel}"][data-nid="${CSS.escape(id)}"]`);
    const centerEl = $("#center", lin);
    const edges = [];
    for (const r of upShown) { const e = el("up", r.id); if (e) edges.push({ a: e, b: centerEl, cls: "u", ids: [r.id, x.id], why: r.why, tag: r.tag }); }
    for (const r of downShown) { const e = el("down", r.id); if (e) edges.push({ a: centerEl, b: e, cls: "d", ids: [x.id, r.id], why: r.why, tag: r.tag }); }
    for (const g of gups) for (const p of g.via) { const a = el("gup", g.id), b = el("up", p); if (a && b) edges.push({ a, b, cls: "u g", ids: [g.id, p], why: m[p].up.find((u) => u.id === g.id)?.why }); }
    for (const g of gdowns) for (const p of g.via) { const a = el("down", p), b = el("gdown", g.id); if (a && b) edges.push({ a, b, cls: "d g", ids: [p, g.id], why: m[g.id].up.find((u) => u.id === p)?.why }); }
    const svg = $("#wires", lin);
    const draw = () => {
      const R = lin.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
      svg.innerHTML = edges.map((e, i) => {
        const A_ = e.a.getBoundingClientRect(), B = e.b.getBoundingClientRect();
        let d;
        if (B.left >= A_.right - 2) { // side by side
          const x1 = A_.right - R.left, y1 = A_.top + A_.height / 2 - R.top, x2 = B.left - R.left, y2 = B.top + B.height / 2 - R.top, dx = (x2 - x1) * 0.5;
          d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
        } else { // stacked
          const x1 = A_.left + A_.width / 2 - R.left, y1 = A_.bottom - R.top, x2 = B.left + B.width / 2 - R.left, y2 = B.top - R.top, dy = (y2 - y1) * 0.5;
          d = `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
        }
        return `<path d="${d}" class="${e.cls}" data-i="${i}" data-a="${esc(e.ids[0])}" data-b="${esc(e.ids[1])}"/>`;
      }).join("");
    };
    requestAnimationFrame(draw);
    ro?.disconnect(); ro = new ResizeObserver(() => draw()); ro.observe(lin);
    if (document.fonts?.ready) document.fonts.ready.then(draw);

    // hover / select
    const bar = $("#whybar", lin);
    const defaultBar = bar.innerHTML;
    const highlight = (btn) => {
      lin.classList.toggle("hovering", !!btn);
      lin.querySelectorAll(".nd.on").forEach((n) => n.classList.remove("on"));
      svg.querySelectorAll("path.on").forEach((p) => p.classList.remove("on"));
      if (!btn) { bar.innerHTML = defaultBar; return; }
      btn.classList.add("on");
      const id = btn.dataset.nid, rel = btn.dataset.rel;
      const mine = edges.map((e, i) => [e, i]).filter(([e]) => e.ids.includes(id) && (e.a === btn || e.b === btn));
      // carry the highlight through to the center for second-generation nodes
      const chainIds = new Set([id]);
      for (const [e, i] of mine) {
        svg.querySelector(`path[data-i="${i}"]`)?.classList.add("on");
        if (rel === "gup" || rel === "gdown") { const mid = e.ids.find((z) => z !== id); chainIds.add(mid); edges.forEach((e2, j) => { if (e2.ids.includes(mid) && e2.ids.includes(x.id)) svg.querySelector(`path[data-i="${j}"]`)?.classList.add("on"); }); }
      }
      const lines = mine.map(([e]) => {
        const [a, b] = e.ids;
        return `<span><b>${esc(nameOf(k, a))}</b> → <b>${esc(nameOf(k, b))}</b>${e.tag ? ` · ${esc(e.tag)}` : ""}${e.why ? `: ${esc(e.why)}` : ""}${k === "artist" && ctx.SRC[`${a}>${b}`] ? ` ${ctx.srcHTML(a, b)}` : ""}</span>`;
      });
      bar.innerHTML = `${lines.slice(0, 3).join("") || `<span><b>${esc(nameOf(k, id))}</b></span>`}${pendingTouch ? `<div class="acts"><button class="solid" data-nav="${id}">Center on ${esc(nameOf(k, id))}</button>${k === "artist" ? `<button class="ghost small" data-open="${id}">Profile</button>` : ""}</div>` : ""}`;
    };
    lin.addEventListener("pointerover", (e) => { if (e.pointerType === "touch") return; const b = e.target.closest(".nd"); if (b) highlight(b); });
    lin.addEventListener("pointerout", (e) => { if (e.pointerType === "touch") return; const b = e.target.closest(".nd"); if (b && !b.contains(e.relatedTarget)) highlight(null); });
    let lastPointer = "mouse";
    lin.addEventListener("pointerdown", (e) => { lastPointer = e.pointerType; });
    lin.addEventListener("click", (e) => {
      const b = e.target.closest(".nd");
      if (!b) return;
      if (lastPointer === "touch" && selected !== b.dataset.nid) { selected = b.dataset.nid; pendingTouch = true; highlight(b); pendingTouch = false; return; }
      selected = null; nav(b.dataset.nid);
    });
    function nav(id) { setTree(k, id); render(root, true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    root.onclick = (e) => {
      const kb = e.target.closest("[data-kind]"); if (kb) { setKind(kb.dataset.kind); render(root, true); return; }
      const gb = e.target.closest("[data-gen]"); if (gb) { S().gen = +gb.dataset.gen; save(); render(root, true); return; }
      const cr = e.target.closest("[data-crumb]"); if (cr) { nav(cr.dataset.crumb); return; }
      const nv = e.target.closest("[data-nav]"); if (nv) { nav(nv.dataset.nav); return; }
      const mo = e.target.closest("[data-more2]"); if (mo) { const mm = ctx.store.get("sl.treeMore2", {}); mm[mo.dataset.more2] = !mm[mo.dataset.more2]; ctx.store.set("sl.treeMore2", mm); render(root); return; }
      const sh = e.target.closest("[data-sharetree]"); if (sh) { window.SL_SHARE.artist(sh.dataset.sharetree); return; }
      const ch = e.target.closest(".chip[data-id]");
      if (ch && ch.closest(".center")) { ctx.openArtist(ch.dataset.id); return; }
      if (e.target.closest("[data-copy]")) { const ids = JSON.parse(e.target.closest("[data-copy]").dataset.copy); ctx.copyText(ctx.playlistText(ids, e.target.closest("[data-copy]").dataset.title), e.target.closest("[data-copy]"), $("#copybox", root)); return; }
      if (e.target.closest("[data-pathgo]")) { runPath(root); return; }
    };
    if (k === "artist") wireConnect(root, x.id);
  }

  /* ---------- connect two artists ---------- */
  function connectHTML(fromId) {
    const ctx = C(), st = ctx.store.get("sl.connect", {});
    const from = st.from && ctx.A[st.from] ? st.from : fromId;
    const to = st.to && ctx.A[st.to] ? st.to : null;
    const ids = [...ctx.sortRel(ctx.A[fromId].up).slice(0, 4).map((r) => r.id).reverse(), fromId, ...ctx.sortRel(ctx.A[fromId].down).slice(0, 5).map((r) => r.id)];
    return `<section class="connect" id="connect">
      <div class="sec-h"><h2>How are they connected?</h2><div class="gbtns" data-spotbox>${window.SL_SPOT.saveBtn(`data-spotsave='${JSON.stringify(ids)}' data-title="${esc(`The lineage of ${ctx.A[fromId].name}`)}"`)}<button class="ghost small" data-copy='${JSON.stringify(ids)}' data-title="${esc(`The lineage of ${ctx.A[fromId].name}`)}">Copy as text</button><span data-spotout class="qmeta"></span></div></div>
      <p class="qmeta" style="margin:0">Pick any two artists. The shortest line between them through real influence links.</p>
      <div class="connect-row">
        <div class="pk"><input class="field" id="cfrom" placeholder="From" value="${esc(ctx.A[from].name)}" data-id="${from}" autocomplete="off"><div class="qres" id="cfromr" hidden></div></div>
        <span class="qmeta">to</span>
        <div class="pk"><input class="field" id="cto" placeholder="Pick an artist, e.g. Billie Eilish" value="${to ? esc(ctx.A[to].name) : ""}" data-id="${to || ""}" autocomplete="off"><div class="qres" id="ctor" hidden></div></div>
        <button class="solid" data-pathgo>Connect</button>
      </div>
      <div id="pathout"></div>
      <textarea class="copybox" id="copybox" hidden aria-label="Playlist text to copy"></textarea>
    </section>`;
  }
  function wireConnect(root) {
    const ctx = C();
    for (const [inp, res] of [["#cfrom", "#cfromr"], ["#cto", "#ctor"]]) {
      const i = $(inp, root), r = $(res, root);
      i.oninput = () => { i.dataset.id = ""; const hits = ctx.searchHits(i.value, ["artist"], 8); r.innerHTML = ctx.hitsHTML(hits, "No match on the map yet"); r.hidden = !i.value.trim(); };
      i.onfocus = () => i.select();
      r.onclick = (e) => { const b = e.target.closest("button[data-id]"); if (!b) return; i.value = ctx.A[b.dataset.id].name; i.dataset.id = b.dataset.id; r.hidden = true; if ($("#cfrom", root).dataset.id && $("#cto", root).dataset.id) runPath(root); };
      i.onkeydown = (e) => { if (e.key === "Enter") { const b = r.querySelector("button[data-id]"); if (b) b.click(); else runPath(root); } };
    }
    if ($("#cto", root).dataset.id) runPath(root);
  }
  function runPath(root) {
    const ctx = C(), A = ctx.A, from = $("#cfrom", root).dataset.id, to = $("#cto", root).dataset.id, out = $("#pathout", root);
    if (!from || !to) { out.innerHTML = `<p class="qmeta">Pick both artists from the suggestions.</p>`; return; }
    ctx.store.set("sl.connect", { from, to });
    const p = ctx.anyPath(from, to);
    if (!p) { out.innerHTML = `<p class="qmeta">No line between them yet. That's a gap in the map worth reporting.</p>`; return; }
    const forward = p.every((s, i) => !i || s.dir === "f"), backward = p.every((s, i) => !i || s.dir === "b");
    out.innerHTML = `<p class="qmeta" style="margin:0">${p.length - 1} step${p.length === 2 ? "" : "s"}${forward ? `, and it runs straight down the line: ${esc(A[from].name)} shaped everyone after them here.` : backward ? `, straight back in time: ${esc(A[to].name)} sits upstream of ${esc(A[from].name)}.` : `, through shared roots and branches.`}</p>
      <div class="path">${p.map((s, i) => `${i ? `<div class="arrow-hop ${s.dir}" title="${s.dir === "f" ? "influenced" : "was influenced by"}">${s.dir === "f" ? "→" : "←"}</div>` : ""}<div class="hop">${ctx.chip(s.id)}${i ? `<span class="why">${esc(ctx.edgeWhy(p[i - 1].id, s.id))}</span>` : ""}</div>`).join("")}</div>
      <div class="gbtns" data-spotbox><button class="playline" data-playitems="${esc(JSON.stringify(p.map((s, i) => ({ id: s.id, why: i ? ctx.edgeWhy(p[i - 1].id, s.id) : "start here" }))))}" data-ptitle="${esc(`${A[from].name} to ${A[to].name}`)}"><svg><use href="#i-play"/></svg>Play the path</button>${window.SL_SPOT.saveBtn(`data-spotsave='${JSON.stringify(p.map((s) => s.id))}' data-title="${esc(`${A[from].name} to ${A[to].name}`)}"`)}<button class="ghost small" data-copy='${JSON.stringify(p.map((s) => s.id))}' data-title="${esc(`${A[from].name} to ${A[to].name}`)}">Copy as text</button><span data-spotout class="qmeta"></span></div>`;
  }

  window.SL_TREE = { render: (root) => render(root, true), setTree, setKind, show };
})();
