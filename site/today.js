/* Today (artist and album of the day, a pick just for you, born and released today, deep cut, games),
   Journeys (guided listening) and the owner's corrections inbox. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dayNum = (k) => Math.floor(Date.parse(k + "T12:00:00Z") / 864e5);

  function renderToday(root) {
    const ctx = C(), now = new Date(), dk = dayKey(now), md = dk.slice(5), n = dayNum(dk), A = ctx.A;
    const born = ctx.ARTISTS.filter((a) => a.born === md);
    const released = ctx.ALBUMS.filter((x) => x.released && x.released.slice(5) === md).sort((a, b) => a.year - b.year);
    const notable = ctx.ARTISTS.filter((a) => a.summary && a.up.length + a.down.length >= 6);
    const aotd = notable[(n * 7919) % notable.length];
    const withSum = ctx.ALBUMS.filter((x) => x.summary);
    const alotd = withSum[(n * 104729) % withSum.length];
    const cousin = alotd?.cousins?.find((c) => ctx.AL[c.id]);
    const big = ctx.ARTISTS.filter((a) => a.down.length >= 8);
    const root_ = big[(n * 31) % big.length];
    const deep = root_ ? [...root_.down].filter((d) => ["2000s", "2010s", "2020s"].includes(A[d.id].decade)).sort((a, b) => A[a.id].down.length - A[b.id].down.length)[0] : null;
    const mine = window.SL_YOU.personalPick(n);
    const G = window.SL_GAMES;
    const pick = (a, label, body, attrs) => `<button class="pick" ${attrs} ${ctx.famStyle(a.family)}><span class="lbl">${label}</span><span class="k"><span class="dot"></span>${esc(ctx.FAM[a.family].name)} · ${esc(a.decade)}</span><b>${esc(a.name)}</b><span class="d">${esc(body)}</span></button>`;
    const links = ctx.ARTISTS.reduce((s, a) => s + a.up.length, 0);
    root.innerHTML = `<div class="today">
      <section class="hero">
        <span class="eyebrow">${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
        <h1>Find your next favorite by following where music came from.</h1>
        ${window.SL_SPOT.nowHTML()}
        <div class="stats"><span><b>${ctx.ARTISTS.length}</b> artists</span><span><b>${links.toLocaleString()}</b> influence links</span><span><b>${ctx.ALBUMS.length}</b> landmark albums</span><span><b>${ctx.SONGS.length}</b> songs in sample trails</span><span><b>${ctx.DECADES[0]}</b> to now</span></div>
      </section>

      <div class="feature">
        ${mine ? `<button class="pick you" data-open="${mine.id}" ${ctx.famStyle(A[mine.id].family)}><span class="lbl">For you today</span><span class="k"><span class="dot"></span>${esc(ctx.FAM[A[mine.id].family].name)} · ${esc(A[mine.id].decade)}</span><b>${esc(A[mine.id].name)}</b><span class="d">Because ${esc(mine.why)}. ${esc(A[mine.id].summary || "")}</span></button>` : ""}
        ${pick(aotd, "Artist of the day", aotd.summary, `data-open="${aotd.id}"`)}
        ${alotd ? `<button class="pick" data-tree="album" data-id="${alotd.id}" ${ctx.famStyle(A[alotd.artist]?.family || "rock")}><span class="lbl">Album of the day</span><span class="k"><span class="dot"></span>${esc(A[alotd.artist]?.name || "")} · ${alotd.year}</span><b>${esc(alotd.title)}</b><span class="d">${esc(alotd.summary)}${cousin ? ` If it clicks, try ${esc(ctx.AL[cousin.id].title)} by ${esc(A[ctx.AL[cousin.id].artist]?.name || "")}.` : ""}</span></button>` : ""}
        ${!mine && deep ? pick(A[deep.id], "Deep cut", `Everyone knows ${root_.name}. Follow the line down: ${deep.why || A[deep.id].summary || ""}`, `data-open="${deep.id}"`) : ""}
      </div>
      ${!mine ? `<p class="notice">Sync your Spotify (or save a few favorites) in <a href="#you" data-go="you">For You</a>, and this page starts picking for you.</p>` : ""}

      ${born.length || released.length ? `<section class="onday">
        ${born.length ? `<div class="sec"><h3>Born today</h3><div class="chips">${born.map((a) => ctx.chip(a.id)).join("")}</div></div>` : ""}
        ${released.length ? `<div class="sec"><h3>Released on this day</h3><div class="mini">${released.map((x) => `<button data-tree="album" data-id="${x.id}"><span><b>${esc(x.title)}</b> · ${esc(A[x.artist]?.name || "")}</span><span class="yr">${x.year}</span></button>`).join("")}</div></div>` : ""}
      </section>` : ""}

      <section class="sec"><div class="sec-h"><h2>Today's games</h2><a href="#play" data-go="play" class="qmeta">All games</a></div>
        <div class="gmini">${G.GAMES.map((g) => `<button class="gm" data-go="${g.id}"><b>${g.name}</b><span>${G.playedToday(g.id) ? "✓ Played" : "Play today's"}${G.streak(g.id) ? ` · ${G.streak(g.id)} day streak` : ""}</span></button>`).join("")}</div>
      </section>
      <section class="sec" id="jcont"></section>
      <section class="sec" id="inbox" hidden></section>
    </div>`;
    const prog = ctx.store.get("sl.journeys", {});
    const active = ctx.JOURNEYS.find((j) => prog[j.id] && prog[j.id].length && prog[j.id].length < j.steps.length);
    if (active) {
      const k = prog[active.id].length, step = active.steps.find((_, i) => !prog[active.id].includes(i));
      $("#jcont", root).innerHTML = `<h2>Continue your journey</h2><button class="pick" data-journey="${active.id}" style="--c:var(--hot)"><span class="lbl">${esc(active.title)} · ${k} of ${active.steps.length}</span><b>${esc(step?.listen || "")}</b><span class="d">${step && A[step.artist] ? esc(A[step.artist].name) + ". " : ""}${esc(step?.note || "")}</span></button>`;
    } else if (ctx.JOURNEYS.length) {
      const j = ctx.JOURNEYS[n % ctx.JOURNEYS.length];
      $("#jcont", root).innerHTML = `<div class="sec-h"><h2>Today's listening journey</h2><a href="#journeys" data-go="journeys" class="qmeta">All journeys</a></div><button class="pick" data-journey="${j.id}" style="--c:var(--hot)"><span class="lbl">${j.steps.length} songs</span><b>${esc(j.title)}</b><span class="d">${esc(j.blurb)}</span></button>`;
    }
    renderInbox($("#inbox", root));
  }

  /* ---------- journeys ---------- */
  function renderJourneys(root, openId) {
    const ctx = C(), J = ctx.JOURNEYS;
    if (!J.length) { root.innerHTML = `<h1>Journeys</h1><p class="loading">Listening journeys are being prepared.</p>`; return; }
    const prog = ctx.store.get("sl.journeys", {});
    if (openId === undefined) openId = ctx.store.get("sl.journeyOpen", null);
    const j = J.find((x) => x.id === openId);
    if (!j) {
      root.innerHTML = `<div class="hub"><div class="ghead"><h1>Journeys</h1></div>
        <p class="lede">Guided listening, one song at a time. Each stop says what to listen for and how it connects to the one before, so you hear the lineage instead of reading about it.</p>
        <div class="gcards">${J.map((x) => {
          const done = (prog[x.id] || []).length;
          const fams = [...new Set(x.steps.map((s) => ctx.A[s.artist]?.family).filter(Boolean))].slice(0, 6);
          return `<button class="gcard" data-journey="${x.id}"><span class="chips">${fams.map((f) => `<span class="dot" style="background:var(--f-${f})"></span>`).join("")}</span><span class="gname">${esc(x.title)}</span><span class="gdesc">${esc(x.blurb)}</span>
            <span class="gstat">${x.steps.length} songs${done ? ` · ${done} heard` : ""}</span><span class="pbar"><i style="width:${(done / x.steps.length) * 100}%"></i></span></button>`;
        }).join("")}</div></div>`;
      return;
    }
    ctx.store.set("sl.journeyOpen", j.id);
    const done = new Set(prog[j.id] || []);
    const next = j.steps.findIndex((_, i) => !done.has(i));
    const playlist = `${j.title}\n\n${j.steps.map((s) => `${s.listen} - ${ctx.A[s.artist]?.name || ""}`).join("\n")}`;
    root.innerHTML = `<div class="journey"><div class="ghead"><button class="back" data-journey="">‹ All journeys</button></div>
      <h1>${esc(j.title)}</h1>
      <p class="lede" style="margin:0">${esc(j.blurb)}</p>
      <div class="copyline" data-spotbox><span class="pbar wide" style="flex:1 1 200px"><i style="width:${(done.size / j.steps.length) * 100}%"></i></span><span class="qmeta">${done.size} of ${j.steps.length} heard</span>${window.SL_SPOT.saveBtn(`data-spotsave="" data-title="${esc(j.title)}" data-songs="${esc(JSON.stringify(j.steps.map((s) => `${s.listen} by ${ctx.A[s.artist]?.name || ""}`)))}"`)}<button class="ghost small" id="jcopy">Copy as text</button><span data-spotout class="qmeta"></span></div>
      <textarea class="copybox" id="jbox" hidden aria-label="Playlist text"></textarea>
      <ol class="steps">${j.steps.map((s, i) => {
        const a = ctx.A[s.artist];
        return `<li class="step${done.has(i) ? " done" : ""}"><details ${i === next ? "open" : ""}><summary><span class="sn">${i + 1}</span><b>${esc(s.listen)}</b>${a ? `<span class="qmeta">${esc(a.name)} · ${esc(a.decade)}</span>` : ""}</summary>
          <div class="stepbody">
            <span class="eyebrow">${esc(s.title)}</span>
            <p>${esc(s.note)}</p>
            ${s.ask ? `<p class="reflect">${esc(s.ask)}</p>` : ""}
            <div class="nowplay">${ctx.listenLinks(`${s.listen} ${a?.name || ""}`)}${a ? ctx.chip(a.id) : ""}</div>
            <button class="qnext" data-step="${i}">${done.has(i) ? "Mark not heard" : "Mark heard"}</button></div></details></li>`;
      }).join("")}</ol></div>`;
    $("#jcopy", root).onclick = (e) => ctx.copyText(playlist, e.target, $("#jbox", root));
    root.querySelectorAll("[data-step]").forEach((b) => b.onclick = () => {
      const i = +b.dataset.step, set = new Set(prog[j.id] || []);
      set.has(i) ? set.delete(i) : set.add(i);
      prog[j.id] = [...set].sort((a, b) => a - b);
      ctx.store.set("sl.journeys", prog);
      renderJourneys(root, j.id);
    });
  }

  /* ---------- corrections (owner inbox) ---------- */
  async function renderInbox(el) {
    const db = await C().db(), user = await C().user();
    if (!db || !user?.isOwner()) return;
    try {
      const snap = await db.collection("corrections").get();
      const items = [];
      snap.docs?.forEach((d) => (d.data?.reports || []).forEach((r) => items.push(r)));
      items.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      el.hidden = false;
      el.innerHTML = `<h2>Corrections inbox <span class="qmeta">(only you see this)</span></h2>${items.length ? `<ul class="inbox">${items.slice(0, 50).map((r) => `<li>${C().chip(r.artist)} <span class="qmeta">${esc(r.field)} · ${esc((r.at || "").slice(0, 10))}</span><p>${esc(r.text)}</p></li>`).join("")}</ul>` : `<p class="qmeta">No corrections yet. Anyone you share with can send one from an artist's page.</p>`}`;
    } catch { /* not readable */ }
  }

  window.SL_TODAY = { renderToday, renderJourneys };
})();
