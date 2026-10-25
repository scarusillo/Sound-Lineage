/* Lineage Wrapped: your year in music, traced back to its roots. Story slides you tap through,
   a share card, and a playlist of the roots behind what you played. Built from your artists. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let GEO = null;
  const geo = () => (GEO ??= fetch("data/geo.json").then((r) => r.json()).catch(() => ({})));

  async function compute(ids) {
    const ctx = C(), A = ctx.A, G = await geo(), mine = new Set(ids), top = ids.slice(0, 30);
    // the root behind the most of your artists, counting two generations up
    const rootN = {};
    for (const id of top) {
      const seen = new Set();
      for (const u of A[id].up) { seen.add(u.id); for (const uu of A[u.id].up) seen.add(uu.id); }
      for (const r of seen) if (!mine.has(r) && !A[r].role) rootN[r] = (rootN[r] || 0) + 1;
    }
    const roots = Object.entries(rootN).sort((a, b) => b[1] - a[1]);
    // the oldest ancestor reachable within four generations of your top artists
    let oldest = null;
    for (const id of top.slice(0, 15)) {
      let frontier = [id]; const seen = new Set(frontier);
      for (let g = 0; g < 4; g++) {
        const nx = [];
        for (const f of frontier) for (const u of A[f].up) if (!seen.has(u.id)) { seen.add(u.id); nx.push(u.id); }
        frontier = nx;
      }
      for (const s of seen) if (s !== id && !A[s].role && (!oldest || ctx.decIdx(A[s].decade) < ctx.decIdx(A[oldest.id].decade) || (A[s].decade === A[oldest.id].decade && A[s].reach > A[oldest.id].reach))) oldest = { id: s, from: id };
    }
    const cityN = {};
    for (const id of top) { const g = G[id]; if (g) { const k = `${g[2]}, ${g[3]}`; cityN[k] = (cityN[k] || 0) + 1; } }
    const city = Object.entries(cityN).sort((a, b) => b[1] - a[1])[0];
    const cityArtists = city ? top.filter((id) => G[id] && `${G[id][2]}, ${G[id][3]}` === city[0]).slice(0, 4) : [];
    const decN = {}; top.forEach((id) => (decN[A[id].decade] = (decN[A[id].decade] || 0) + 1));
    const avg = top.reduce((s, id) => s + ctx.decIdx(A[id].decade), 0) / top.length;
    const recentShare = top.filter((id) => ["2010s", "2020s"].includes(A[id].decade)).length / top.length;
    const famN = new Set(top.map((id) => A[id].family)).size;
    const type = famN >= 7 ? ["The Cartographer", "You roam across genres the way other people roam a single playlist."]
      : avg < 6.5 ? ["The Root Digger", "Your listening leans old. You go back to where things started."]
      : recentShare > 0.6 ? ["The Scout", "You live at the front edge, and the map shows how far back your new favorites reach."]
      : ["The Connector", "You keep one foot in the classics and one in what's new, and the lineage runs right through you."];
    const parts = window.SL_SHARE.tasteDNA(ids);
    const next = window.SL_YOU.recommend(ids).filter((r) => ["2010s", "2020s"].includes(A[r.id].decade)).slice(0, 5);
    const yr = String(new Date().getFullYear()), logs = (window.SL_COMM?.me?.logs || []).filter((l) => (l.date || "").startsWith(yr));
    const best = [...logs].filter((l) => l.rating).sort((a, b) => b.rating - a.rating)[0];
    const diary = logs.length ? { n: logs.length, best, reviews: logs.filter((l) => l.text).length, goal: window.SL_COMM.me.goal?.n } : null;
    return { ids, top, roots, oldest, city, cityArtists, decN, type, parts, next, diary, year: new Date().getFullYear() };
  }

  function slides(W) {
    const ctx = C(), A = ctx.A, F = ctx.FAM;
    const r0 = W.roots[0], dmax = Math.max(...Object.values(W.decN));
    const bar = (parts) => `<div class="dna-bar w-dna">${parts.map(([f, p]) => `<i style="width:${(p * 100).toFixed(1)}%;background:var(--f-${f})"></i>`).join("")}</div>`;
    return [
      { c: A[W.top[0]].family, h: `<span class="w-k">Lineage Wrapped ${W.year}</span><span class="w-big">Your year, traced back to its roots.</span><span class="w-s">You played ${W.ids.length} artists on the map. Here is where their sound came from.</span>` },
      W.diary && { c: W.best ? A[W.diary.best?.artist]?.family || "rock" : A[W.top[0]].family, h: `<span class="w-k">Your diary</span><span class="w-big mono">${W.diary.n}</span><span class="w-s">albums logged this year${W.diary.goal ? `, ${Math.round((W.diary.n / W.diary.goal) * 100)}% of your goal` : ""}${W.diary.reviews ? `, with ${W.diary.reviews} written review${W.diary.reviews === 1 ? "" : "s"}` : ""}.${W.diary.best ? ` Your top rating went to ${esc(W.diary.best.title)} by ${esc(W.diary.best.artistName)}.` : ""}</span>` },
      { c: W.parts[0][0], h: `<span class="w-k">Your Genre DNA</span><span class="w-big">${Math.round(W.parts[0][1] * 100)}% ${esc(F[W.parts[0][0]].short.toLowerCase())}</span>${bar(W.parts)}<span class="w-s">${W.parts.slice(1, 4).map(([f, p]) => `${esc(F[f].short)} ${Math.round(p * 100)}%`).join(" · ")}. Counted from your artists and three generations of the people who shaped them.</span>` },
      r0 && { c: A[r0[0]].family, h: `<span class="w-k">Your number one root</span>${ctx.vinyl(r0[0])}<span class="w-big">${esc(A[r0[0]].name)}</span><span class="w-s">${r0[1]} of your top artists trace back to ${esc(A[r0[0]].name)} within two generations, including ${esc(W.top.filter((id) => A[id].up.some((u) => u.id === r0[0] || A[u.id].up.some((uu) => uu.id === r0[0]))).slice(0, 3).map((id) => A[id].name).join(", "))}.</span>` },
      W.oldest && { c: A[W.oldest.id].family, h: `<span class="w-k">How far back you go</span><span class="w-big mono">${esc(A[W.oldest.id].decade)}</span><span class="w-s">Follow ${esc(A[W.oldest.from].name)} back far enough and you reach ${esc(A[W.oldest.id].name)}${A[W.oldest.id].origin ? `, in ${esc(A[W.oldest.id].origin)}` : ""}.</span>` },
      W.city && { c: A[W.cityArtists[0]]?.family || "rock", h: `<span class="w-k">Your music city</span><span class="w-big">${esc(W.city[0].replace(/, US$/, ""))}</span><span class="w-s">${W.city[1]} of your top artists came up there: ${esc(W.cityArtists.map((id) => A[id].name).join(", "))}.</span>` },
      { c: "jazz", h: `<span class="w-k">Your decades</span><div class="w-decs">${ctx.DECADES.filter((d) => W.decN[d]).map((d) => `<span><i style="height:${(W.decN[d] / dmax) * 100}%"></i><b class="mono">${d.slice(2)}</b></span>`).join("")}</div><span class="w-s">Most of your artists broke through in the ${esc(Object.entries(W.decN).sort((a, b) => b[1] - a[1])[0][0])}.</span>` },
      { c: A[W.top[0]].family, h: `<span class="w-k">Your listening type</span><span class="w-big">${esc(W.type[0])}</span><span class="w-s">${esc(W.type[1])}</span>` },
      W.next.length && { c: A[W.next[0].id].family, h: `<span class="w-k">For next year</span><span class="w-big">Five heirs to try</span><ol class="w-list">${W.next.map((r) => `<li><b>${esc(A[r.id].name)}</b> <span>${esc(r.why[0])}</span></li>`).join("")}</ol>` },
    ].filter(Boolean);
  }

  async function render(root) {
    const ctx = C(), ids = window.SL_YOU.yourIds();
    if (ids.length < 3) {
      root.innerHTML = `<div class="screen-h"><span class="eyebrow">Lineage Wrapped</span><h1>Your year, traced back to its roots</h1><p class="lede">Your Genre DNA, the root behind most of what you played, how far back your music goes, your music city and five heirs for next year. It needs three or more of your artists.</p></div><div class="gbtns"><button class="solid" data-go="you">Add your artists</button><button class="ghost" data-wexample>Try an example listener</button></div>`;
      root.onclick = (e) => { if (e.target.closest("[data-wexample]")) { window.SL_YOU.useExample(); render(root); } };
      return;
    }
    root.innerHTML = `<p class="loading">Tracing your year…</p>`;
    const W = await compute(ids), S = slides(W);
    let i = 0;
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">Lineage Wrapped ${W.year}</span><h1>Your year in lineage</h1></div>
      <div class="story" id="story" tabindex="0" aria-roledescription="story" aria-label="Lineage Wrapped">
        <div class="story-pips">${S.map((_, k) => `<i data-pip="${k}"></i>`).join("")}</div>
        <div class="story-slide" id="sslide"></div>
        <button class="story-nav prev" data-snav="-1" aria-label="Previous"></button><button class="story-nav next" data-snav="1" aria-label="Next"></button>
      </div>
      <div class="gbtns"><button class="playline" data-playitems="${esc(JSON.stringify([...W.roots.slice(0, 5).map(([id]) => ({ id, why: "one of your roots" })), ...W.next.slice(0, 5).map((r) => ({ id: r.id, why: r.why[0] }))]))}" data-ptitle="My Lineage Wrapped ${W.year}"><svg><use href="#i-play"/></svg>Play your roots</button><button class="solid" data-wshare>Share my Wrapped</button><button class="ghost" data-go="mix">Your weekly mix</button></div>`;
    const show = (k) => {
      i = Math.max(0, Math.min(S.length - 1, k));
      const s = S[i], el = $("#sslide", root);
      el.style.setProperty("--c", `var(--f-${s.c})`); el.innerHTML = s.h; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
      root.querySelectorAll("[data-pip]").forEach((p) => p.classList.toggle("on", +p.dataset.pip <= i));
    };
    show(0);
    root.onclick = (e) => {
      const n = e.target.closest("[data-snav]"); if (n) { show(i + +n.dataset.snav); return; }
      if (e.target.closest("[data-wshare]")) window.SL_SHARE.wrapped(W);
    };
    $("#story", root).onkeydown = (e) => { if (e.key === "ArrowRight") show(i + 1); if (e.key === "ArrowLeft") show(i - 1); };
  }
  window.SL_WRAPPED = { render, compute };
})();
