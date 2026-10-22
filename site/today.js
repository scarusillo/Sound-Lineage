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
    const links = ctx.ARTISTS.reduce((s, a) => s + a.up.length, 0);
    const hr = now.getHours(), hello = hr < 5 ? "Up late" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    const heroA = mine ? A[mine.id] : aotd;
    const heroWhy = mine ? `Because ${mine.why}. ${A[mine.id].summary || ""}` : aotd.summary;
    const rc = (id, s2) => `<button class="rcard" data-open="${id}">${ctx.vinyl(id)}<span class="t">${esc(A[id].name)}</span><span class="s">${esc(s2)}</span></button>`;
    const rcAlbum = (x, s2) => `<button class="rcard" data-tree="album" data-id="${x.id}" style="--vs:148px">${ctx.sleeve(x)}<span class="t">${esc(x.title)}</span><span class="s">${esc(s2)}</span></button>`;
    const picks = [];
    if (mine) picks.push(rc(aotd.id, "Artist of the day"));
    if (alotd) picks.push(rcAlbum(alotd, `Album of the day · ${A[alotd.artist]?.name || ""}`));
    if (deep) picks.push(rc(deep.id, `Deep cut · heir of ${root_.name}`));
    if (cousin) picks.push(rcAlbum(ctx.AL[cousin.id], `If ${alotd.title} clicks`));
    const fresh = ctx.ARTISTS.filter((a) => !a.role && ["2010s", "2020s"].includes(a.decade) && a.summary && a.up.length >= 2);
    for (let i = 0; picks.length < 8 && i < 12; i++) { const a = fresh[(n * 37 + i * 101) % fresh.length]; if (a && !picks.some((p) => p.includes(`"${a.id}"`))) picks.push(rc(a.id, `New lineage · ${A[ctx.sortRel(a.up)[0].id].name} heir`)); }
    const recs = mine ? window.SL_YOU.recommend(window.SL_YOU.yourIds()).filter((r) => r.id !== mine.id).slice(0, 10) : [];
    const played = G.GAMES.filter((g) => G.playedToday(g.id)).length;
    root.innerHTML = `<div class="view-in" style="display:grid;gap:28px">
      <div class="greet"><span class="date">${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span><h1>${hello}</h1></div>
      ${window.SL_SPOT.nowHTML()}
      <button class="hero" data-open="${heroA.id}" ${ctx.famStyle(heroA.family)}>
        <span style="min-width:0"><span class="lbl">${mine ? "Picked for you today" : "Artist of the day"}</span><span class="ht">${esc(heroA.name)}</span><span class="d">${esc(heroWhy)}</span><span class="k"><span class="dot" style="background:#fff"></span>${esc(ctx.FAM[heroA.family].name)} · ${esc(heroA.decade)} · ${heroA.up.length} roots · ${heroA.down.length} heirs</span></span>
        ${ctx.vinyl(heroA.id)}
      </button>
      ${window.SL_MIX.cardHTML() || `<button class="mixcard" data-go="mix"><span class="mixcover" style="--vs:96px;background:conic-gradient(from 45deg, var(--f-soul) 0 25%, var(--f-rock) 0 50%, var(--f-jazz) 0 75%, var(--f-hiphop) 0)" aria-hidden="true"><i>LINEAGE MIX</i></span><span style="min-width:0"><span class="eyebrow">New every Monday</span><span class="ht">Get your weekly mix</span><span class="s">Tell Sound Lineage what you play and it builds a playlist from the people who shaped your artists and the people they shaped.</span></span></button>`}

      <section class="shelf"><div class="shelf-h"><h2>Today's picks</h2></div><div class="row">${picks.join("")}</div></section>
      ${recs.length ? `<section class="shelf"><div class="shelf-h"><h2>Where to go next</h2><a href="#you" data-go="you">See all</a></div><div class="row">${recs.map((r) => rc(r.id, r.why[0])).join("")}</div></section>` : ""}
      ${born.length ? `<section class="shelf"><div class="shelf-h"><h2>Born today</h2></div><div class="row">${born.map((a) => rc(a.id, `${a.years || a.decade}`)).join("")}</div></section>` : ""}
      ${released.length ? `<section class="shelf"><div class="shelf-h"><h2>Released on this day</h2></div><div class="row">${released.map((x) => rcAlbum(x, `${A[x.artist]?.name || ""} · ${x.year}`)).join("")}</div></section>` : ""}

      <section class="sec"><div class="shelf-h"><h2>Explore</h2></div><div class="tiles">
        <a class="tile" href="#journeys" data-go="journeys"><svg><use href="#i-route"/></svg><b>Journeys</b><span>${ctx.JOURNEYS.length} guided listens, one song at a time</span></a>
        <a class="tile" href="#play" data-go="play"><svg><use href="#i-games"/></svg><b>Daily games</b><span>${played ? `${played} of ${G.GAMES.length} played today` : `${G.GAMES.length} new puzzles today`}</span></a>
        <a class="tile" href="#credits" data-go="credits"><svg><use href="#i-credits"/></svg><b>Behind the music</b><span>Producers and session players</span></a>
        <a class="tile" href="#browse" data-go="browse"><svg><use href="#i-grid"/></svg><b>Browse</b><span>${ctx.ARTISTS.length.toLocaleString()} artists, ${ctx.ALBUMS.length} albums</span></a>
      </div></section>
      <section class="sec" id="jcont"></section>
      <p class="stats"><span><b>${ctx.ARTISTS.length.toLocaleString()}</b> artists</span><span><b>${links.toLocaleString()}</b> influence links</span><span><b>${ctx.SONGS.length}</b> songs in sample trails</span><span><b>${ctx.DECADES[0]}</b> to now</span><span class="human">Human-curated</span></p>
      <section class="sec" id="inbox" hidden></section>
    </div>`;
    const prog = ctx.store.get("sl.journeys", {});
    const active = ctx.JOURNEYS.find((j) => prog[j.id] && prog[j.id].length && prog[j.id].length < j.steps.length);
    if (active) {
      const k = prog[active.id].length, step = active.steps.find((_, i) => !prog[active.id].includes(i));
      $("#jcont", root).innerHTML = `<div class="shelf-h"><h2>Continue your journey</h2></div><button class="hero" data-journey="${active.id}" style="--c:var(--f-${A[step?.artist]?.family || "soul"})"><span style="min-width:0"><span class="lbl">${esc(active.title)} · ${k} of ${active.steps.length}</span><span class="ht">${esc(step?.listen || "")}</span><span class="d">${step && A[step.artist] ? esc(A[step.artist].name) + ". " : ""}${esc(step?.note || "")}</span></span>${step && A[step.artist] ? ctx.vinyl(step.artist) : ""}</button>`;
    } else if (ctx.JOURNEYS.length) {
      const j = ctx.JOURNEYS[n % ctx.JOURNEYS.length];
      $("#jcont", root).innerHTML = `<div class="shelf-h"><h2>Today's journey</h2><a href="#journeys" data-go="journeys">All journeys</a></div><button class="hero" data-journey="${j.id}" style="--c:var(--f-${A[j.steps[0].artist]?.family || "soul"})"><span style="min-width:0"><span class="lbl">${j.steps.length} songs</span><span class="ht">${esc(j.title)}</span><span class="d">${esc(j.blurb)}</span></span>${A[j.steps[0].artist] ? ctx.vinyl(j.steps[0].artist) : ""}</button>`;
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
      root.innerHTML = `<div class="hub"><div class="screen-h"><h1>Journeys</h1>
        <p class="lede">Guided listening, one song at a time. Each stop says what to listen for and how it connects to the one before, so you hear the lineage instead of reading about it.</p></div>
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
    root.innerHTML = `<div class="journey"><button class="back" data-journey="">All journeys</button>
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
