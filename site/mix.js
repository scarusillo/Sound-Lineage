/* Mix: a weekly Lineage Mix built from your artists, an adventurousness dial, and an archive of past weeks.
   The Balanced setting follows the same rules as scripts/weekly_mix.py (the Monday Spotify playlist). */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const enc = encodeURIComponent;

  const LEVELS = [
    { name: "Close to home", blurb: "Only the strongest links, mostly inside genres you already play.", plan: [["root", 4], ["heir", 5], ["deep", 2]], minS: 3, lean: "same" },
    { name: "Familiar", blurb: "Direct roots and heirs of your artists, with one step into another genre.", plan: [["root", 3], ["heir", 5], ["deep", 2], ["cousin", 1]] },
    { name: "Balanced", blurb: "One generation back and forward, plus deep cuts and two cross-genre cousins. This matches the Monday playlist.", plan: [["root", 3], ["heir", 4], ["deep", 2], ["cousin", 2]] },
    { name: "Curious", blurb: "Adds artists two steps out: the roots of your roots and the heirs of your heirs.", plan: [["root", 2], ["heir", 3], ["deep", 2], ["cousin", 3], ["far", 2]] },
    { name: "Far afield", blurb: "Mostly two steps out and across genres, leaning away from what you already play.", plan: [["root", 1], ["heir", 2], ["deep", 2], ["cousin", 3], ["far", 4]], lean: "other" },
  ];
  const LBL = { root: "Where it came from", heir: "Where it went", deep: "Deep cuts", cousin: "Across genres", far: "Two steps out" };
  const ORDER = { root: 0, far: 1, heir: 2, deep: 3, cousin: 4 };

  function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear(), wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    return `${y}-W${String(wk).padStart(2, "0")}`;
  }
  function mondayOf(week) {
    const [y, w] = week.split("-W").map(Number);
    const jan4 = new Date(Date.UTC(y, 0, 4)), m = new Date(jan4);
    m.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7);
    return m;
  }
  const weekLabel = (week) => mondayOf(week).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  function rng(seed) { let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const adv = () => Math.min(4, Math.max(0, C().store.get("sl.adv", 2)));

  function weekly(ids, level = adv(), week = isoWeek()) {
    const ctx = C(), A = ctx.A, L = LEVELS[level];
    if (!ids.length) return null;
    const R = rng(week + "|" + level + "|" + [...ids].sort().join(","));
    const have = new Set(ids), used = new Set();
    const myFams = new Set(ids.slice(0, 15).map((i) => A[i].family));
    const song = (i) => (A[i].songs || [])[0] || "";
    const artistOnly = (i) => !A[i].role;
    const leanW = (i) => (L.lean === "same" ? (myFams.has(A[i].family) ? 1.6 : 0.5) : L.lean === "other" ? (myFams.has(A[i].family) ? 0.45 : 2) : 1);
    const pool = (kind) => {
      const agg = {};
      const add = (i, sc, why) => { if (have.has(i) || !artistOnly(i)) return; sc *= leanW(i); if (!agg[i] || sc > agg[i][0]) agg[i] = [sc + (agg[i]?.[0] || 0) * 0.5, why]; };
      ids.forEach((m, rank) => {
        const w = Math.max(1, 30 - rank), me = A[m];
        if (kind === "root") for (const e of me.up) { if (!L.minS || e.s >= L.minS) add(e.id, w * e.s, `${A[e.id].name} shaped ${me.name}`); }
        if (kind === "heir" || kind === "deep") for (const e of me.down) {
          const a = A[e.id];
          if (kind === "deep" && (!["2000s", "2010s", "2020s"].includes(a.decade) || a.down.length > 3)) continue;
          if (kind === "heir" && L.minS && e.s < L.minS - 1) continue;
          add(e.id, w * e.s, `${me.name} shaped them`);
        }
        if (kind === "cousin") for (const c of me.cousins || []) { if (A[c.id]) add(c.id, w * 2, `the ${ctx.FAM[A[c.id].family].short.toLowerCase()} cousin of ${me.name}`); }
        if (kind === "far" && rank < 20) {
          const first = new Set([...me.up, ...me.down].map((e) => e.id));
          for (const u of me.up) for (const uu of A[u.id].up) if (!first.has(uu.id)) add(uu.id, w * (u.s + uu.s) * 0.5, `${A[uu.id].name} shaped ${A[u.id].name}, who shaped ${me.name}`);
          for (const d of me.down) for (const dd of A[d.id].down) if (!first.has(dd.id)) add(dd.id, w * (d.s + dd.s) * 0.5, `${me.name} shaped ${A[d.id].name}, who shaped them`);
        }
      });
      let ranked = Object.entries(agg).sort((a, b) => b[1][0] - a[1][0]).slice(0, 25);
      for (let i = ranked.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ranked[i], ranked[j]] = [ranked[j], ranked[i]]; }
      return ranked.slice(0, 14).sort((a, b) => b[1][0] - a[1][0]).map(([i, [, why]]) => [i, why]);
    };
    const picks = [];
    for (const [kind, n] of L.plan) {
      let got = 0;
      for (const [i, why] of pool(kind)) { if (got >= n) break; if (used.has(i) || !song(i)) continue; used.add(i); got++; picks.push({ id: i, song: song(i), kind, because: why }); }
    }
    picks.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
    return { week, level, title: `Lineage Mix · ${weekLabel(week)}`, picks };
  }

  const ids = () => window.SL_YOU.yourIds();
  function cover(mix, size = 132) {
    const A = C().A, f = [...new Set(mix.picks.map((p) => A[p.id]?.family).filter(Boolean))];
    while (f.length < 4) f.push(f[f.length % Math.max(1, f.length)] || "rock");
    return `<span class="mixcover" style="--vs:${size}px;background:conic-gradient(from 45deg, var(--f-${f[0]}) 0 25%, var(--f-${f[1]}) 0 50%, var(--f-${f[2]}) 0 75%, var(--f-${f[3]}) 0)" aria-hidden="true"><i>LINEAGE MIX</i><b>${esc(weekLabel(mix.week))}</b></span>`;
  }
  function songsOf(mix) { const A = C().A; return mix.picks.map((p) => `${p.song} by ${A[p.id].name}`); }
  function textOf(mix) { const A = C().A; return `${mix.title}\n\n${mix.picks.map((p) => `${p.song} - ${A[p.id].name}`).join("\n")}`; }

  /* the Home card */
  function cardHTML() {
    const list = ids(); if (!list.length) return "";
    const mix = weekly(list); if (!mix || mix.picks.length < 4) return "";
    const A = C().A;
    return `<button class="mixcard" data-go="mix">${cover(mix, 96)}<span style="min-width:0"><span class="eyebrow">This week's mix</span><span class="ht">${esc(mix.title)}</span><span class="s">${mix.picks.length} songs · ${esc(mix.picks.slice(0, 3).map((p) => A[p.id].name).join(", "))} and more</span></span></button>`;
  }

  /* ---------- the screen ---------- */
  function render(root) {
    const ctx = C(), A = ctx.A, list = ids(), level = adv();
    if (!list.length) {
      root.innerHTML = `<div class="screen-h"><span class="eyebrow">Every Monday</span><h1>Your Lineage Mix</h1><p class="lede">A weekly playlist built from the artists you play: the people who shaped them, the people they shaped, and a few cousins from other genres. Every pick is a real influence link, chosen by people, never AI filler.</p></div>
        <div class="panel-card"><h2>Tell it what you play</h2><p class="qmeta" style="margin:0">Sync Spotify, import your listening, or save a few favorite artists. The mix builds as soon as it knows three or more.</p>
          <div class="gbtns">${window.SL_SPOT.available === false ? "" : `<button class="spot-btn" data-spotsync><span class="sp" aria-hidden="true"></span>Sync with Spotify</button>`}<button class="solid" data-go="you">Pick favorites</button><button class="ghost" data-mixexample>Try an example listener</button></div><p class="qmeta" data-spotmsg style="margin:0"></p></div>`;
      root.onclick = (e) => { if (e.target.closest("[data-mixexample]")) { window.SL_YOU.useExample(); render(root); } };
      return;
    }
    const mix = weekly(list, level);
    const arch = ctx.store.get("sl.mixArchive", {});
    if (mix && mix.picks.length) { arch[mix.week] = { title: mix.title, level, at: Date.now(), picks: mix.picks.map((p) => ({ id: p.id, song: p.song, kind: p.kind })) }; ctx.store.set("sl.mixArchive", Object.fromEntries(Object.entries(arch).sort().slice(-52))); }
    const past = Object.entries(arch).filter(([w]) => w !== mix.week).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const from = [...new Set(mix.picks.map((p) => p.because.split(/ shaped | cousin of /).pop()).filter((n) => list.some((i) => A[i].name === n)))].slice(0, 3);
    let last = "";
    root.innerHTML = `
      <div class="mixhead">${cover(mix, 180)}<div class="screen-h" style="min-width:0">
        <span class="eyebrow">Your weekly mix</span><h1>${esc(mix.title)}</h1>
        <span class="qmeta">${mix.picks.length} songs${from.length ? ` · from ${esc(from.join(", "))}` : ""}</span>
        <span><span class="human" title="Every pick is a documented influence link between real artists">Human-curated · no AI tracks</span></span>
      </div></div>
      <div class="gbtns" data-spotbox>${window.SL_SPOT.saveBtn(`data-spotsave="" data-title="${esc(mix.title)}" data-songs="${esc(JSON.stringify(songsOf(mix)))}"`)}<button class="ghost" data-copymix>Copy as text</button><button class="ghost" data-sharemix>Share</button><span data-spotout class="qmeta"></span></div>
      <textarea class="copybox" id="mixbox" hidden aria-label="Mix as text"></textarea>

      <section class="dial">
        <div class="dial-h"><b>How adventurous?</b><span class="lv" id="lvname">${esc(LEVELS[level].name)}</span></div>
        <input type="range" id="advr" min="0" max="4" step="1" value="${level}" aria-label="How adventurous the mix should be" aria-valuetext="${esc(LEVELS[level].name)}">
        <div class="dial-ends"><span>Close to home</span><span>Far afield</span></div>
        <p id="lvblurb">${esc(LEVELS[level].blurb)}</p>
      </section>

      <ol class="tracks">${mix.picks.map((p, i) => {
        const head = p.kind !== last ? `<li class="mixh">${LBL[p.kind]}</li>` : ""; last = p.kind;
        return `${head}<li class="trk"><span class="n">${i + 1}</span>${ctx.vinyl(p.id)}<span style="min-width:0"><span class="t">${esc(p.song)}</span><button class="lnk a" data-open="${p.id}">${esc(A[p.id].name)}</button> <span class="qmeta" style="font-size:.76rem">${esc(A[p.id].decade)}</span><span class="w">${esc(p.because)}</span></span><a class="playbtn" aria-label="Play ${esc(p.song)} on Spotify" target="_blank" rel="noopener" href="https://open.spotify.com/search/${enc(p.song + " " + A[p.id].name)}"><svg><use href="#i-play"/></svg></a></li>`;
      }).join("")}</ol>
      <p class="notice">Every song here is by a real artist tied to yours through a documented influence link: an interview, a biography or a music history. Nothing is filler, and nothing is AI-generated.</p>

      <section class="sec archive"><div class="sec-h"><h2>Past mixes</h2><span class="qmeta">${past.length ? `${past.length} saved in this browser` : ""}</span></div>
        ${past.length ? past.map(([w, m]) => `<details><summary>${cover({ week: w, picks: m.picks }, 44)}<span><span class="t">${esc(m.title)}</span><span class="s">${m.picks.length} songs · ${esc(LEVELS[m.level ?? 2]?.name || "")}</span></span><button class="ghost small" data-copyold="${esc(w)}">Copy</button></summary><ol>${m.picks.map((p) => `<li>${esc(p.song)} · <button class="lnk" data-open="${p.id}">${esc(A[p.id]?.name || p.id)}</button></li>`).join("")}</ol></details>`).join("")
          : `<p class="qmeta" style="margin:0">Each week's mix is kept here, so last week's picks don't vanish. Your next one arrives Monday.</p>`}
      </section>`;
    const r = $("#advr", root);
    r.oninput = () => { $("#lvname", root).textContent = LEVELS[+r.value].name; $("#lvblurb", root).textContent = LEVELS[+r.value].blurb; };
    r.onchange = () => { ctx.store.set("sl.adv", +r.value); render(root); ctx.toast(`Mix set to ${LEVELS[+r.value].name}`); };
    root.onclick = (e) => {
      if (e.target.closest("[data-copymix]")) { ctx.copyText(textOf(mix), e.target.closest("[data-copymix]"), $("#mixbox", root)); return; }
      if (e.target.closest("[data-sharemix]")) { window.SL_SHARE.mix(mix); return; }
      const co = e.target.closest("[data-copyold]");
      if (co) { e.preventDefault(); const m = arch[co.dataset.copyold]; ctx.copyText(`${m.title}\n\n${m.picks.map((p) => `${p.song} - ${A[p.id]?.name || ""}`).join("\n")}`, co, $("#mixbox", root)); }
    };
  }

  window.SL_MIX = { weekly, render, cardHTML, cover, LEVELS, isoWeek, textOf };
})();
