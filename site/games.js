/* Daily games: Quiz, Six Degrees, Connections, Which Came First. Seeded by date so everyone gets the same puzzle. */
(() => {
  "use strict";
  const C = () => window.SL;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function rng(seedStr) { let s = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const GAMES = [
    { id: "quiz", name: "Daily Quiz", desc: "Five questions on who shaped whom, what came out when, and where it all started." },
    { id: "degrees", name: "Six Degrees", desc: "Get from an early legend to a modern artist using only real influence links. Beat par." },
    { id: "links", name: "Connections", desc: "Sixteen artists, four hidden groups. Find what ties each four together." },
    { id: "timeline", name: "Which Came First", desc: "Put five landmark albums in release order." },
  ];
  const gstore = (id) => C().store.get(`sl.g.${id}`, { days: {} });
  const gsave = (id, day, v) => { const s = gstore(id); s.days[day] = v; C().store.set(`sl.g.${id}`, s); };
  const playedToday = (id) => !!gstore(id).days[todayKey()]?.done;
  function streak(id) {
    const days = gstore(id).days; let n = 0;
    const d = new Date(); if (!days[keyOf(d)]?.done) d.setDate(d.getDate() - 1);
    for (; days[keyOf(d)]?.done; d.setDate(d.getDate() - 1)) n++;
    return n;
  }
  const head = (title, id) => `<div class="ghead"><button class="back" data-go="play">‹ Games</button><h1>${title}</h1><span class="qmeta">${streak(id)} day streak</span></div>`;

  /* ---------- hub ---------- */
  function hub(root) {
    const ctx = C(), b = ctx.badges();
    root.innerHTML = `<div class="hub"><div class="ghead"><h1>Play</h1></div>
      <p class="lede">New puzzles every day, built from the same influence map. Everyone gets the same puzzle on the same day.</p>
      <div class="gcards">${GAMES.map((g) => `<button class="gcard" data-go="${g.id}"><span class="gname">${g.name}</span><span class="gdesc">${g.desc}</span><span class="gstat">${playedToday(g.id) ? "✓ Played today" : "Play today's"}${streak(g.id) ? ` · ${streak(g.id)} day streak` : ""}</span></button>`).join("")}</div>
      <h2>Your record</h2>
      <p class="qmeta">You have opened ${ctx.explored()} of ${ctx.ARTISTS.length} artists.</p>
      <div class="badges">${b.map((x) => `<div class="badge${x.got ? " got" : ""}"><b>${esc(x.name)}</b>${esc(x.desc)}</div>`).join("")}</div></div>`;
  }

  /* ---------- quiz ---------- */
  const LEVELS = { easy: { min: 10, label: "Easy" }, medium: { min: 4, label: "Medium" }, hard: { min: 1, label: "Hard" } };
  function makeQuiz(day, level) {
    const ctx = C(), R = rng(day + level), A = ctx.A;
    const pickFrom = (arr) => arr[Math.floor(R() * arr.length)];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const lv = LEVELS[level];
    const deg = (a) => a.up.length + a.down.length;
    const pool = ctx.ARTISTS.filter((a) => deg(a) >= lv.min && (level !== "hard" || deg(a) < 14));
    const di = (d) => ctx.DECADES.indexOf(d);
    const opts4 = (right, cands) => { const s = new Set([right]); let g = 0; while (s.size < 4 && g++ < 300 && cands.length) s.add(pickFrom(cands)); return shuffle([...s]); };
    const makers = [
      () => { const a = pickFrom(pool.filter((x) => x.up.some((u) => u.s >= 2))); const r = pickFrom(a.up.filter((u) => u.s >= 2)); const ups = new Set(a.up.map((u) => u.id));
        const c = ctx.ARTISTS.filter((x) => !ups.has(x.id) && x.id !== a.id && di(x.decade) <= di(a.decade) && Math.abs(di(x.decade) - di(A[r.id].decade)) <= 1).map((x) => x.name);
        return { prompt: `Which of these artists directly influenced ${a.name}?`, opts: opts4(A[r.id].name, c), answer: A[r.id].name, id: a.id, exp: r.why }; },
      () => { const a = pickFrom(pool.filter((x) => x.down.length)); const r = pickFrom(a.down); const ds = new Set(a.down.map((u) => u.id));
        const c = ctx.ARTISTS.filter((x) => !ds.has(x.id) && x.id !== a.id && di(x.decade) >= di(a.decade) && Math.abs(di(x.decade) - di(A[r.id].decade)) <= 1).map((x) => x.name);
        return { prompt: `Which of these artists was influenced by ${a.name}?`, opts: opts4(A[r.id].name, c), answer: A[r.id].name, id: r.id, exp: r.why }; },
      () => { const a = pickFrom(pool); const i = di(a.decade); const c = ctx.DECADES.filter((d, j) => Math.abs(j - i) <= 3);
        return { prompt: `In which decade did ${a.name} break through?`, opts: opts4(a.decade, c).sort(), answer: a.decade, id: a.id, exp: a.summary }; },
      () => { const al = pickFrom(ctx.ALBUMS.filter((x) => A[x.artist] && deg(A[x.artist]) >= lv.min)); const a = A[al.artist];
        const c = ctx.ARTISTS.filter((x) => x.family === a.family && x.id !== a.id).map((x) => x.name);
        return { prompt: `Who released the album “${al.title}” (${al.year})?`, opts: opts4(a.name, c), answer: a.name, id: a.id, exp: al.summary }; },
      () => { const a = pickFrom(pool.filter((x) => x.know?.length)); const fact = pickFrom(a.know);
        const masked = [a.name, a.name.replace(/^The /, "")].reduce((t, n) => t.split(n).join("____"), fact);
        const c = ctx.ARTISTS.filter((x) => x.family === a.family && x.id !== a.id && Math.abs(di(x.decade) - di(a.decade)) <= 1).map((x) => x.name);
        if (c.length < 3) return null;
        return { prompt: `Which artist fits this fact? “${masked}”`, opts: opts4(a.name, c), answer: a.name, id: a.id, exp: a.summary }; },
      () => { const a = pickFrom(pool.filter((x) => x.origin)); const c = [...new Set(ctx.ARTISTS.filter((x) => x.origin && x.origin !== a.origin).map((x) => x.origin))];
        return { prompt: `Where is ${a.name} from?`, opts: opts4(a.origin, c), answer: a.origin, id: a.id, exp: a.summary }; },
    ];
    const qs = [], used = new Set(); let g = 0;
    while (qs.length < 5 && g++ < 200) {
      let q = null; try { q = makers[Math.floor(R() * makers.length)](); } catch { q = null; }
      if (q && q.opts.length === 4 && !used.has(q.prompt)) { used.add(q.prompt); qs.push(q); }
    }
    return qs;
  }
  function quiz(root) {
    const ctx = C(), day = todayKey(), level = ctx.store.get("sl.quizLevel", "medium");
    const qs = makeQuiz(day, level);
    let st = ctx.store.get("sl.quiz", {});
    if (st.day !== day || st.level !== level) st = { day, level, i: 0, picks: [] };
    const save = () => ctx.store.set("sl.quiz", st);
    const draw = () => {
      const done = st.picks.length >= qs.length;
      const score = st.picks.filter((x, i) => x === qs[i].answer).length;
      const dots = qs.map((q, i) => `<i class="${i < st.picks.length ? (st.picks[i] === q.answer ? "ok" : "no") : i === st.i ? "cur" : ""}"></i>`).join("");
      let body;
      if (done) {
        gsave("quiz", day, { done: true, score, level });
        body = `<div class="qcard"><h2>${score} of ${qs.length} today</h2><p class="qexp">${score === qs.length ? "A perfect round." : "Open the artists you missed and follow their trees."} A new quiz arrives tomorrow.</p>
          <div class="chips">${qs.map((q) => ctx.chip(q.id)).join("")}</div></div>`;
      } else {
        const q = qs[st.i], answered = st.picks.length > st.i;
        body = `<div class="qcard"><div class="qprompt">${esc(q.prompt)}</div>
          <div class="qopts">${q.opts.map((o) => `<button class="${answered ? (o === q.answer ? "right" : o === st.picks[st.i] ? "wrong" : "") : ""}" data-o="${esc(o)}" ${answered ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
          ${answered ? `<p class="qexp">${st.picks[st.i] === q.answer ? "Correct." : `The answer is ${esc(q.answer)}.`} ${esc(q.exp || "")}</p><div class="gbtns">${ctx.chip(q.id)}<button class="qnext">${st.i + 1 < qs.length ? "Next question" : "See results"}</button></div>` : ""}</div>`;
      }
      root.innerHTML = `<div class="game">${head("Daily Quiz", "quiz")}
        <div class="levels" role="group" aria-label="Difficulty">${Object.entries(LEVELS).map(([k, v]) => `<button class="${k === level ? "on" : ""}" data-level="${k}">${v.label}</button>`).join("")}</div>
        <div class="dots">${dots}</div>${body}</div>`;
    };
    root.onclick = (e) => {
      const lv = e.target.closest("[data-level]");
      if (lv) { ctx.store.set("sl.quizLevel", lv.dataset.level); quiz(root); return; }
      const o = e.target.closest("button[data-o]");
      if (o && st.picks.length === st.i) { st.picks.push(o.dataset.o); save(); draw(); return; }
      if (e.target.closest(".qnext")) { st.i++; save(); draw(); }
    };
    draw();
  }

  /* ---------- six degrees ---------- */
  function makeDegrees(day) {
    const ctx = C(), R = rng(day + "deg"), A = ctx.A, di = (d) => ctx.DECADES.indexOf(d);
    const starts = ctx.ARTISTS.filter((a) => di(a.decade) <= di("1960s") && a.reach >= 25);
    for (let g = 0; g < 400; g++) {
      const s = starts[Math.floor(R() * starts.length)];
      const ends = ctx.ARTISTS.filter((a) => di(a.decade) >= di("2000s") && a.up.length >= 2);
      const t = ends[Math.floor(R() * ends.length)];
      const p = s && t && ctx.shortestPath(s.id, t.id);
      if (p && p.length >= 4 && p.length <= 6) return { from: s.id, to: t.id, par: p.length - 1 };
    }
    return null;
  }
  function degrees(root) {
    const ctx = C(), A = ctx.A, day = todayKey(), P = makeDegrees(day);
    if (!P) { root.innerHTML = `<div class="game">${head("Six Degrees", "degrees")}<p class="loading">Today's puzzle could not be built. Try again tomorrow.</p></div>`; return; }
    let st = ctx.store.get("sl.deg", {});
    if (st.day !== day) st = { day, chain: [P.from], hints: 0, moves: 0 };
    const save = () => ctx.store.set("sl.deg", st);
    const draw = () => {
      const cur = st.chain[st.chain.length - 1], done = cur === P.to;
      const path = ctx.shortestPath(cur, P.to);
      const chain = `<div class="chain">${st.chain.map((id, i) => `${i ? `<span class="arrow">→</span>` : ""}${ctx.chip(id)}`).join("")}</div>`;
      let body;
      if (done) {
        const steps = st.chain.length - 1;
        gsave("degrees", day, { done: true, steps, par: P.par });
        body = `<div class="qcard"><h2>${steps === P.par ? "Par. A perfect line." : steps < P.par ? "Under par." : `${steps} steps (par ${P.par})`}</h2>
          <p class="qexp">${st.hints ? `${st.hints} hint${st.hints === 1 ? "" : "s"} used. ` : ""}Every arrow is a documented influence. Tap any artist to read why.</p>${chain}
          <p class="qexp">Shortest line: ${ctx.shortestPath(P.from, P.to).map((id) => esc(A[id].name)).join(" → ")}</p></div>`;
      } else {
        const opts = [...A[cur].down].sort((a, b) => A[a.id].name.localeCompare(A[b.id].name));
        body = `${!path ? `<p class="notice">Dead end. Nobody downstream of ${esc(A[cur].name)} leads to ${esc(A[P.to].name)}. Step back and try another branch.</p>` : ""}
          <div class="qcard"><div class="qprompt">Who did <b>${esc(A[cur].name)}</b> influence? Pick the next link.</div>
          <div class="optgrid">${opts.map((o) => `<button data-pick="${o.id}" ${ctx.famStyle(A[o.id].family)}><span>${esc(A[o.id].name)}</span><small>${esc(A[o.id].decade)} · ${esc(ctx.FAM[A[o.id].family].short)}</small></button>`).join("") || `<p class="qexp">No one is mapped downstream of this artist.</p>`}</div>
          <div class="gbtns"><button class="ghost" data-undo ${st.chain.length < 2 ? "disabled" : ""}>Step back</button><button class="ghost" data-hint ${!path ? "disabled" : ""}>Hint</button><span class="qmeta">${st.chain.length - 1} step${st.chain.length === 2 ? "" : "s"} so far · par ${P.par}</span></div>
          ${st.showHint && path ? `<p class="qexp">Try ${esc(A[path[1]].name)}.</p>` : ""}</div>`;
      }
      root.innerHTML = `<div class="game">${head("Six Degrees", "degrees")}
        <div class="target"><span class="eyebrow">Get from</span><b>${esc(A[P.from].name)} → ${esc(A[P.to].name)}</b><span class="qmeta">Follow influence links forward in time. Par is ${P.par}.</span></div>
        ${chain}${body}</div>`;
    };
    root.onclick = (e) => {
      const p = e.target.closest("[data-pick]");
      if (p) { st.chain.push(p.dataset.pick); st.showHint = false; save(); draw(); return; }
      if (e.target.closest("[data-undo]")) { if (st.chain.length > 1) st.chain.pop(); st.showHint = false; save(); draw(); return; }
      if (e.target.closest("[data-hint]")) { st.hints++; st.showHint = true; save(); draw(); }
    };
    draw();
  }

  /* ---------- connections ---------- */
  function makeLinks(day) {
    const ctx = C(), A = ctx.A;
    const known = ctx.ARTISTS.filter((a) => a.up.length + a.down.length >= 4);
    const K = new Set(known.map((a) => a.id));
    const cands = [];
    for (const a of ctx.ARTISTS) {
      const d = a.down.map((x) => x.id).filter((id) => K.has(id));
      if (d.length >= 5) cands.push({ label: `Influenced by ${a.name}`, members: d, test: (id) => A[id].up.some((u) => u.id === a.id) });
    }
    const fd = {};
    for (const a of known) (fd[`${a.family}|${a.decade}`] ??= []).push(a.id);
    for (const [k, m] of Object.entries(fd)) if (m.length >= 5) { const [f, d] = k.split("|"); cands.push({ label: `${ctx.FAM[f].name}, ${d}`, members: m, test: (id) => A[id].family === f && A[id].decade === d }); }
    const tg = {};
    for (const a of known) for (const g of a.genres || []) (tg[g.toLowerCase()] ??= []).push(a.id);
    for (const [g, m] of Object.entries(tg)) if (m.length >= 4 && m.length <= 14) cands.push({ label: g.replace(/\b\w/g, (c) => c.toUpperCase()), members: m, test: (id) => (A[id].genres || []).some((x) => x.toLowerCase() === g) });
    const oc = {};
    for (const a of known) { const c = (a.origin || "").split(",")[0].trim(); if (c) (oc[c] ??= []).push(a.id); }
    for (const [c, m] of Object.entries(oc)) if (m.length >= 4) cands.push({ label: `From ${c}`, members: m, test: (id) => (A[id].origin || "").split(",")[0].trim() === c });
    for (let attempt = 0; attempt < 60; attempt++) {
      const R = rng(day + "links" + attempt);
      const pick = (arr) => arr[Math.floor(R() * arr.length)];
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const groups = [], used = new Set();
      let g = 0;
      while (groups.length < 4 && g++ < 200) {
        const c = pick(cands);
        if (groups.some((x) => x.label === c.label)) continue;
        const free = shuffle(c.members.filter((id) => !used.has(id) && !groups.some((x) => x.test(id))));
        if (free.length < 4) continue;
        const four = free.slice(0, 4);
        if (four.some((id) => groups.some((x) => x.test(id)))) continue;
        if (groups.some((x) => x.members.some((id) => c.test(id)))) continue;
        groups.push({ label: c.label, members: four, test: c.test });
        four.forEach((id) => used.add(id));
      }
      if (groups.length === 4) return { groups, tiles: shuffle([...used]) };
    }
    return null;
  }
  function links(root) {
    const ctx = C(), A = ctx.A, day = todayKey(), P = makeLinks(day);
    if (!P) { root.innerHTML = `<div class="game">${head("Connections", "links")}<p class="loading">Today's puzzle could not be built.</p></div>`; return; }
    let st = ctx.store.get("sl.links", {});
    if (st.day !== day) st = { day, solved: [], sel: [], miss: 0, msg: "" };
    const save = () => ctx.store.set("sl.links", st);
    const draw = () => {
      const solvedIds = new Set(st.solved.flatMap((i) => P.groups[i].members));
      const over = st.solved.length === 4 || st.miss >= 4;
      if (over) gsave("links", day, { done: true, won: st.solved.length === 4, miss: st.miss });
      const showGroups = over ? [0, 1, 2, 3].sort((a, b) => st.solved.includes(b) - st.solved.includes(a)) : st.solved;
      root.innerHTML = `<div class="game">${head("Connections", "links")}
        <p class="lede">Find four groups of four. A group can be a shared influence, a genre and decade, a style tag or a hometown.</p>
        <div class="lsolved">${showGroups.map((i, k) => `<div class="lgroup d${(k % 4) + 1}"><b>${esc(P.groups[i].label)}</b><div class="chips" style="justify-content:center">${P.groups[i].members.map((id) => ctx.chip(id)).join("")}</div></div>`).join("")}</div>
        ${over ? `<div class="qcard"><h2>${st.solved.length === 4 ? "Solved." : "Out of guesses."}</h2><p class="qexp">${st.miss} mistake${st.miss === 1 ? "" : "s"}. A new board arrives tomorrow.</p></div>` : `
        <div class="lgrid">${P.tiles.filter((id) => !solvedIds.has(id)).map((id) => `<button class="ltile${st.sel.includes(id) ? " on" : ""}" data-t="${id}">${esc(A[id].name)}</button>`).join("")}</div>
        <div class="gbtns"><button class="qnext" data-submit ${st.sel.length !== 4 ? "disabled" : ""}>Submit</button><button class="ghost" data-clear>Deselect</button><span class="qmeta">Mistakes left: ${"● ".repeat(4 - st.miss)}</span></div>
        ${st.msg ? `<p class="qexp">${esc(st.msg)}</p>` : ""}`}</div>`;
    };
    root.onclick = (e) => {
      const t = e.target.closest("[data-t]");
      if (t) { const id = t.dataset.t; st.sel = st.sel.includes(id) ? st.sel.filter((x) => x !== id) : st.sel.length < 4 ? [...st.sel, id] : st.sel; st.msg = ""; save(); draw(); return; }
      if (e.target.closest("[data-clear]")) { st.sel = []; save(); draw(); return; }
      if (e.target.closest("[data-submit]") && st.sel.length === 4) {
        const hit = P.groups.findIndex((g) => st.sel.every((id) => g.members.includes(id)));
        if (hit >= 0) { st.solved.push(hit); st.msg = ""; }
        else { st.miss++; st.msg = P.groups.some((g) => st.sel.filter((id) => g.members.includes(id)).length === 3) ? "One away." : "Not a group."; }
        st.sel = []; save(); draw();
      }
    };
    draw();
  }

  /* ---------- which came first ---------- */
  function timeline(root) {
    const ctx = C(), day = todayKey(), R = rng(day + "tl");
    const pool = ctx.ALBUMS.filter((x) => ctx.A[x.artist]);
    const pick = [];
    let g = 0;
    while (pick.length < 5 && g++ < 500) { const x = pool[Math.floor(R() * pool.length)]; if (!pick.some((p) => p.year === x.year || p.id === x.id)) pick.push(x); }
    let st = ctx.store.get("sl.tl", {});
    if (st.day !== day) st = { day, order: [] };
    const save = () => ctx.store.set("sl.tl", st);
    const sorted = [...pick].sort((a, b) => a.year - b.year);
    const draw = () => {
      const done = st.order.length === pick.length;
      const correct = done ? st.order.filter((id, i) => sorted[i].id === id).length : 0;
      if (done) gsave("timeline", day, { done: true, correct });
      const list = done ? st.order.map((id) => pick.find((p) => p.id === id)) : pick;
      root.innerHTML = `<div class="game">${head("Which Came First", "timeline")}
        <p class="lede">Tap the albums from earliest to latest release.</p>
        <div class="tl">${list.map((x, i) => {
          const pos = st.order.indexOf(x.id);
          const cls = done ? (sorted[i].id === x.id ? "ok" : "no") : pos >= 0 ? "picked" : "";
          return `<button class="${cls}" data-al="${x.id}" ${done || pos >= 0 ? "disabled" : ""}><span class="n">${done ? i + 1 : pos >= 0 ? pos + 1 : ""}</span><span><b>${esc(x.title)}</b><br><span class="qmeta">${esc(ctx.A[x.artist].name)}</span></span>${done ? `<span class="yr mono">${x.year}</span>` : ""}</button>`;
        }).join("")}</div>
        ${done ? `<div class="qcard"><h2>${correct} of 5 in the right spot</h2><p class="qexp">Correct order: ${sorted.map((x) => `${esc(x.title)} (${x.year})`).join(", ")}.</p></div>` : `<div class="gbtns"><button class="ghost" data-reset ${!st.order.length ? "disabled" : ""}>Start over</button></div>`}</div>`;
    };
    root.onclick = (e) => {
      const b = e.target.closest("[data-al]");
      if (b && !st.order.includes(b.dataset.al)) { st.order.push(b.dataset.al); save(); draw(); return; }
      if (e.target.closest("[data-reset]")) { st.order = []; save(); draw(); }
    };
    draw();
  }

  function mount(view, root) {
    root.onclick = null;
    ({ play: hub, quiz, degrees, links, timeline }[view] || hub)(root);
  }
  window.SL_GAMES = { GAMES, mount, playedToday, streak };
})();
