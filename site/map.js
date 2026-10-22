/* The map: a 3D "time tube" (ForceGraph3D) with a flat canvas fallback.
   x = decade (left to right). Each genre owns a lane around the tube, so related genres sit side by side.
   Links run from influence to influenced; on selection, particles flow along them in that direction. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // the map is a night sky in both themes, so it uses its own bright genre palette
  const COL = { blues: "#6f97f0", jazz: "#a88bf2", country: "#e0ae55", folk: "#9cc96b", rock: "#f26a5c", alt: "#45cbbd", metal: "#b4b0c2",
    soul: "#f7ad4f", pop: "#f27fd3", hiphop: "#f4d047", electronic: "#5ec8f5", reggae: "#bede4f", latin: "#e09572", global: "#3ddc97" };
  const UP = "#92a8ff", DOWN = "#ff8c5e";
  // lane order puts neighbours next to each other around the tube
  const LANES = ["blues", "soul", "hiphop", "electronic", "pop", "latin", "global", "reggae", "jazz", "folk", "country", "rock", "alt", "metal"];
  const DX = 175, R = 330;

  let mode = null, built3 = false, builtF = false, G3 = null, F = null, isActive = false;
  let nodes = [], links = [], byId = {}, sel = null, hover = null, cutoff = 12, hidden = new Set(), raf = 0, playing = null;
  const deg = (a) => a.up.length + a.down.length;
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const X = (a) => (C().decIdx(a.decade) - (C().DECADES.length - 1) / 2) * DX;
  // in portrait the timeline runs top to bottom so all of history fits on a phone
  let vert = false;
  const isVert = () => { const el = $("#mapwrap"); return el.clientHeight > el.clientWidth * 1.1; };
  const P = (t, c, z) => (vert ? { x: c, y: -t, z } : { x: t, y: c, z });
  const ang = (f) => (LANES.indexOf(f) / LANES.length) * Math.PI * 2;
  const vis = (n) => !hidden.has(n.a.family) && C().decIdx(n.a.decade) <= cutoff;
  const webgl = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };

  function data() {
    if (nodes.length) return;
    const ctx = C();
    vert = isVert();
    nodes = ctx.ARTISTS.map((a) => {
      const t = ang(a.family), r = R + (Math.random() - 0.5) * 60;
      return { id: a.id, a, ...P(X(a) + (Math.random() - 0.5) * 60, Math.cos(t) * r, Math.sin(t) * r) };
    });
    byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    links = [];
    for (const a of ctx.ARTISTS) for (const u of a.up) links.push({ source: u.id, target: a.id, s: u.s });
  }

  /* ---------- init (filters, HUD, mode switch) ---------- */
  function init() {
    const ctx = C();
    hidden = new Set(ctx.store.get("sl.mapHide", []));
    mode = ctx.store.get("sl.mapMode", null) || (webgl() && typeof window.ForceGraph3D === "function" ? "3d" : "flat");
    if (mode === "3d" && !(webgl() && typeof window.ForceGraph3D === "function")) mode = "flat";
    drawFilter();
    document.querySelectorAll("[data-mapmode]").forEach((b) => b.onclick = () => { setMode(b.dataset.mapmode); });
    $("#era").max = ctx.DECADES.length - 1; $("#era").value = cutoff = ctx.DECADES.length - 1;
    $("#eralabel").textContent = ctx.DECADES[cutoff];
    $("#era").oninput = () => { stopPlay(); setCutoff(+$("#era").value); };
    $("#playhist").onclick = () => (playing ? stopPlay() : playHistory());
    const pop = $("#mappop"), fb = $("#mapfilterbtn"), ib = $("#mapinfobtn");
    const toggle = (btn) => { const on = btn.getAttribute("aria-expanded") !== "true"; fb.setAttribute("aria-expanded", "false"); ib.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-expanded", String(on)); pop.hidden = !on; pop.dataset.mode = btn === fb ? "filter" : "info"; $("#maplede").hidden = btn === fb; $("#mapfilter").hidden = btn !== fb; $("#scenes").hidden = btn !== fb || mode !== "cities"; };
    fb.onclick = () => toggle(fb); ib.onclick = () => toggle(ib);
    $("#mapwrap").addEventListener("pointerdown", (e) => { if (!e.target.closest(".map-pop, .map-top")) { pop.hidden = true; fb.setAttribute("aria-expanded", "false"); ib.setAttribute("aria-expanded", "false"); } });
    $("#zin").onclick = () => zoom(0.7); $("#zout").onclick = () => zoom(1.4); $("#zfit").onclick = fit;
    $("#mapfocus").addEventListener("click", (e) => { if (e.target.closest(".x")) { if (mode === "cities") { window.SL_CITIES.clear(); $("#mapfocus").hidden = true; } else select(null); } });
    window.addEventListener("resize", () => { if (isActive) size(); });
    if (!sessionStorage_get()) { ib.setAttribute("aria-expanded", "true"); }
  }
  function sessionStorage_get() { try { return sessionStorage.getItem("sl.mapSeen"); } catch { return "1"; } }
  function drawFilter() {
    const ctx = C(), mf = $("#mapfilter");
    $("#mapfiltern").textContent = hidden.size ? `${ctx.FAMS.length - hidden.size} of ${ctx.FAMS.length}` : "Genres";
    mf.innerHTML = ctx.FAMS.map((f) => `<button data-fam="${f.id}" aria-pressed="${!hidden.has(f.id)}" style="--c:${COL[f.id]}"><span class="dot" style="background:${COL[f.id]}"></span>${esc(f.name)}</button>`).join("")
      + `<span class="legend-ln"><i style="background:${UP}"></i>Influenced by</span><span class="legend-ln"><i style="background:${DOWN}"></i>Influenced</span>`;
    mf.onclick = (e) => {
      const b = e.target.closest("[data-fam]"); if (!b) return;
      const f = b.dataset.fam;
      if (e.altKey || e.metaKey) hidden = new Set(ctx.FAMS.map((x) => x.id).filter((x) => x !== f));
      else hidden.has(f) ? hidden.delete(f) : hidden.add(f);
      if (hidden.size === ctx.FAMS.length) hidden.clear();
      ctx.store.set("sl.mapHide", [...hidden]); drawFilter(); refresh();
    };
  }
  function setMode(m) {
    mode = m; C().store.set("sl.mapMode", m);
    if (isActive) show();
  }
  function active(on) {
    isActive = on;
    if (!on) { cancelAnimationFrame(raf); G3?.pauseAnimation(); stopPlay(); return; }
    show();
  }
  function show() {
    document.querySelectorAll("[data-mapmode]").forEach((b) => b.classList.toggle("on", b.dataset.mapmode === mode));
    $("#graph3d").hidden = mode !== "3d"; $("#graph").hidden = mode !== "flat"; $("#citymap").hidden = mode !== "cities"; $("#scenes").hidden = mode !== "cities" || $("#mappop").dataset.mode !== "filter";
    $("#maplede").textContent = mode === "cities"
      ? "Where the music came from. Each dot is a city, sized by how many artists came up there and colored by its main genre. Ringed cities had a scene. Tap a city to see its artists and where its sound spread."
      : `Every dot is an artist. Time runs ${isVert() ? "top to bottom" : "left to right"}, from ragtime to now, and each genre has its own lane. Drag to turn, pinch to zoom, and tap an artist to see influences flow in (blue) and their legacy flow out (orange).`;
    if ($("#mapinfobtn").getAttribute("aria-expanded") === "true") { $("#mappop").hidden = false; $("#mappop").dataset.mode = "info"; $("#mapfilter").hidden = true; $("#maplede").hidden = false; try { sessionStorage.setItem("sl.mapSeen", "1"); } catch { /* fine */ } }
    data();
    if (mode === "3d") { if (!built3) build3(); G3.resumeAnimation(); size(); loop(); focusCard(); }
    else if (mode === "flat") { G3?.pauseAnimation(); cancelAnimationFrame(raf); $("#labels").innerHTML = ""; labelEls = {}; if (!builtF) buildFlat(); size(); F.draw(); focusCard(); }
    else {
      G3?.pauseAnimation(); cancelAnimationFrame(raf); $("#labels").innerHTML = ""; labelEls = {}; $("#mapfocus").hidden = true;
      window.SL_CITIES.build({ COL, vis: (a) => !hidden.has(a.family) && C().decIdx(a.decade) <= cutoff }).then(() => { window.SL_CITIES.resize(); if (sel) window.SL_CITIES.selectArtist(sel); });
    }
  }
  function size() {
    const w = $("#mapwrap").clientWidth, h = $("#mapwrap").clientHeight;
    if (nodes.length && isVert() !== vert) {
      vert = isVert();
      if (G3) { G3.d3ReheatSimulation(); setTimeout(fit, 60); }
      if (F) { F.relayout(); }
      if (mode !== "cities") $("#maplede").textContent = $("#maplede").textContent.replace(/top to bottom|left to right/, vert ? "top to bottom" : "left to right");
    }
    if (G3 && mode === "3d") G3.width(w).height(h);
    if (F && mode === "flat") { F.canvas.width = 0; F.draw(); }
    if (mode === "cities") window.SL_CITIES.resize();
  }

  /* ---------- 3D ---------- */
  function build3() {
    built3 = true;
    const el = $("#graph3d");
    G3 = window.ForceGraph3D({ controlType: "orbit" })(el)
      .backgroundColor("#0a0b12")
      .showNavInfo(false)
      .nodeRelSize(5)
      .nodeVal((n) => 0.6 + Math.sqrt(deg(n.a)) * 1.5)
      .nodeResolution(16)
      .nodeOpacity(0.95)
      .nodeLabel(() => "")
      .nodeColor(nodeColor)
      .nodeVisibility(vis)
      .linkVisibility((l) => vis(l.source.a ? l.source : byId[l.source]) && vis(l.target.a ? l.target : byId[l.target]))
      .linkColor(linkColor)
      .linkWidth((l) => (isHL(l) ? 1.4 : 0))
      .linkOpacity(1)
      .linkCurvature(0.12)
      .linkDirectionalParticles((l) => (isHL(l) ? 3 : 0))
      .linkDirectionalParticleWidth(2.4)
      .linkDirectionalParticleSpeed(0.0075)
      .linkDirectionalParticleColor((l) => (sel && l.target.id === sel ? UP : DOWN))
      .onNodeClick((n) => select(n.id, true))
      .onNodeHover((n) => { hover = n || null; el.style.cursor = n ? "pointer" : "grab"; tipFor(n); })
      .onBackgroundClick(() => select(null))
      .warmupTicks(80)
      .cooldownTicks(140)
      .graphData({ nodes, links });
    G3.d3Force("charge").strength(-24).distanceMax(320);
    G3.d3Force("link").distance(60).strength(0.02);
    G3.d3Force("center", null);
    let ns = [];
    const lane = (alpha) => {
      for (const n of ns) {
        const t = ang(n.a.family), p = P(X(n.a), Math.cos(t) * R, Math.sin(t) * R);
        const kx = vert ? 0.08 : 0.35, ky = vert ? 0.35 : 0.08;
        n.vx += (p.x - n.x) * kx * alpha;
        n.vy += (p.y - n.y) * ky * alpha;
        n.vz += (p.z - n.z) * 0.08 * alpha;
      }
    };
    lane.initialize = (x) => { ns = x; };
    G3.d3Force("lane", lane);
    size();
    const d0 = frontDist();
    G3.cameraPosition({ x: -d0 * 0.4, y: d0 * 0.7, z: d0 * 1.9 }, { x: 0, y: 0, z: 0 }, 0);
    setTimeout(() => { if (!sel) fit(); }, 120);
    el.addEventListener("mousemove", (e) => { const r = el.getBoundingClientRect(); mouse = [e.clientX - r.left, e.clientY - r.top]; if (hover) tipFor(hover); });
  }
  let mouse = [0, 0];
  function tipFor(n) {
    const tip = $("#tip");
    if (!n || mode !== "3d") { tip.hidden = true; return; }
    const ctx = C();
    tip.innerHTML = `<b>${esc(n.a.name)}</b><br>${esc(ctx.FAM[n.a.family].name)} · ${esc(n.a.decade)}<br>${n.a.up.length} influences · influenced ${n.a.down.length}`;
    const w = $("#mapwrap").clientWidth;
    tip.style.left = Math.min(mouse[0] + 14, w - 270) + "px"; tip.style.top = mouse[1] + 14 + "px"; tip.hidden = false;
  }
  const upSet = () => new Set(sel ? C().A[sel].up.map((r) => r.id) : []);
  const downSet = () => new Set(sel ? C().A[sel].down.map((r) => r.id) : []);
  let US = new Set(), DS = new Set();
  function nodeColor(n) {
    if (!sel) return COL[n.a.family];
    if (n.id === sel) return "#ffffff";
    if (US.has(n.id) || DS.has(n.id)) return COL[n.a.family];
    return hexA(COL[n.a.family], 0.1);
  }
  const lid = (x) => (typeof x === "object" ? x.id : x);
  const isHL = (l) => sel && (lid(l.source) === sel || lid(l.target) === sel);
  function linkColor(l) {
    if (!sel) return "rgba(170,170,215,0.16)";
    if (lid(l.target) === sel) return UP;
    if (lid(l.source) === sel) return DOWN;
    return "rgba(170,170,215,0.025)";
  }
  function refresh() {
    US = upSet(); DS = downSet();
    if (G3) {
      G3.nodeColor(nodeColor).nodeVisibility(vis)
        .linkVisibility((l) => vis(l.source.a ? l.source : byId[l.source]) && vis(l.target.a ? l.target : byId[l.target]))
        .linkColor(linkColor).linkWidth((l) => (isHL(l) ? 1.4 : 0)).linkDirectionalParticles((l) => (isHL(l) ? 3 : 0));
    }
    if (F) F.draw();
    window.SL_CITIES?.refresh();
  }

  /* labels: HTML overlay projected each frame */
  let labelEls = {};
  function loop() {
    cancelAnimationFrame(raf);
    const tick = () => { if (!isActive || mode !== "3d") return; drawLabels(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }
  function drawLabels() {
    const ctx = C(), box = $("#labels"), cam = G3.camera(), m = cam.matrixWorldInverse.elements;
    const W = box.clientWidth, H = box.clientHeight;
    const want = new Map();
    // decade markers along the top of the tube, genre names at the start of each lane
    ctx.DECADES.forEach((d, i) => { if (i <= cutoff) want.set("d:" + d, { ...P((i - (ctx.DECADES.length - 1) / 2) * DX, vert ? -(R + 120) : R + 95, 0), text: d.toUpperCase(), cls: "dec" }); });
    if (!vert) for (const f of LANES) { if (hidden.has(f) || !ctx.FAM[f]) continue; const t = ang(f); want.set("f:" + f, { ...P(-((ctx.DECADES.length - 1) / 2) * DX - 70, Math.cos(t) * (R + 10), Math.sin(t) * (R + 10)), text: ctx.FAM[f].short, cls: "dec", color: COL[f] }); }
    let pick;
    if (sel) pick = [sel, ...US, ...DS];
    else pick = nodes.filter(vis).sort((a, b) => deg(b.a) - deg(a.a)).slice(0, $("#mapwrap").clientWidth < 600 ? 40 : 70).map((n) => n.id);
    if (hover && !pick.includes(hover.id)) pick.push(hover.id);
    for (const id of pick) {
      const n = byId[id]; if (!n || !vis(n)) continue;
      want.set(id, { x: n.x, y: n.y, z: n.z, text: n.a.name, cls: id === sel ? "sel" : US.has(id) ? "up" : DS.has(id) ? "down" : deg(n.a) > 25 ? "big" : "" });
    }
    const placed = [], show = new Map();
    const pri = (k, L) => (L.cls === "sel" ? 0 : L.cls === "dec" ? 1 : L.cls === "up" || L.cls === "down" ? 2 : 3);
    const order = [...want.entries()].sort((a, b) => pri(...a) - pri(...b));
    for (const [k, L] of order) {
      const zc = m[2] * L.x + m[6] * L.y + m[10] * L.z + m[14];
      if (zc > -10) continue;
      const p = G3.graph2ScreenCoords(L.x, L.y, L.z);
      if (p.x < -100 || p.x > W + 100 || p.y < -40 || p.y > H + 40) continue;
      const w = L.text.length * (L.cls === "sel" ? 8.5 : 7) + 12, h = L.cls === "sel" ? 20 : 15;
      const bx = L.cls === "dec" ? [p.x - w / 2, p.y - h / 2, w, h] : [p.x + 6, p.y - h / 2, w, h];
      if (L.cls !== "sel" && placed.some((q) => bx[0] < q[0] + q[2] && bx[0] + bx[2] > q[0] && bx[1] < q[1] + q[3] && bx[1] + bx[3] > q[1])) continue;
      placed.push(bx); show.set(k, { L, p, depth: -zc });
    }
    for (const k in labelEls) if (!show.has(k)) { labelEls[k].remove(); delete labelEls[k]; }
    for (const [k, { L, p, depth }] of show) {
      let el = labelEls[k];
      if (!el) { el = labelEls[k] = document.createElement("span"); box.appendChild(el); }
      el.className = L.cls; el.textContent = L.text;
      el.style.color = L.color || "";
      el.style.left = p.x + "px"; el.style.top = p.y + "px";
      el.style.opacity = L.cls === "sel" || L.cls === "dec" ? 1 : Math.max(0.35, Math.min(1, 1.7 - depth / (frontDist() * 1.3)));
    }
  }

  function frontDist() {
    const cam = G3.camera(), el = $("#mapwrap"), aspect = el.clientWidth / Math.max(1, el.clientHeight);
    const t = Math.tan((cam.fov * Math.PI) / 360);
    const timeHalf = ((C().DECADES.length - 1) / 2) * DX, ring = R + 150;
    const halfW = vert ? ring : timeHalf + 330, halfH = vert ? timeHalf + 230 : ring + 60;
    return Math.max(halfW / (t * aspect), halfH / t) * 1.04;
  }
  const home = (d) => (vert ? { x: d * 0.2, y: 0, z: d } : { x: 0, y: d * 0.22, z: d });
  const homeT = () => (vert ? { x: 0, y: 60, z: 0 } : { x: 0, y: 0, z: 0 });
  function fit() {
    if (mode === "cities") { window.SL_CITIES.fit(); return; }
    if (mode === "3d" && G3) { const t = homeT(), h = home(frontDist()); G3.cameraPosition({ x: h.x + t.x, y: h.y + t.y, z: h.z }, t, 900); }
    else if (F) F.fit();
  }
  function zoom(f) {
    if (mode === "cities") { window.SL_CITIES.zoom(f); return; }
    if (mode === "3d" && G3) {
      const c = G3.camera().position, t = G3.controls().target;
      G3.cameraPosition({ x: t.x + (c.x - t.x) * f, y: t.y + (c.y - t.y) * f, z: t.z + (c.z - t.z) * f }, t, 400);
    } else if (F) d3.select(F.canvas).transition().duration(250).call(F.zoom.scaleBy, 1 / f);
  }
  function flyTo(id) {
    const n = byId[id]; if (!n) return;
    if (mode === "3d" && G3) {
      const ra = vert ? n.x : n.y, len = Math.hypot(ra, n.z) || 1, out = vert ? 560 : 380;
      const pos = vert ? { x: n.x + (n.x / len) * out + 40, y: n.y + 60, z: n.z + (n.z / len) * out + 140 } : { x: n.x + 60, y: n.y + (n.y / len) * out + 40, z: n.z + (n.z / len) * out + 140 };
      G3.cameraPosition(pos, { x: n.x, y: n.y, z: n.z }, 1100);
    } else if (F) F.center(id);
  }

  /* ---------- selection ---------- */
  function select(id, fly) {
    sel = id && C().A[id] ? id : null;
    if (sel) { $("#mappop").hidden = true; $("#mapfilterbtn").setAttribute("aria-expanded", "false"); $("#mapinfobtn").setAttribute("aria-expanded", "false"); }
    if (sel && C().decIdx(C().A[sel].decade) > cutoff) setCutoff(C().DECADES.length - 1);
    if (sel && hidden.has(C().A[sel].family)) { hidden.delete(C().A[sel].family); C().store.set("sl.mapHide", [...hidden]); drawFilter(); }
    refresh();
    if (mode === "cities") { if (sel && isActive) window.SL_CITIES.selectArtist(sel); return; }
    focusCard();
    if (sel && fly && isActive) flyTo(sel);
  }
  function focusCard() {
    const box = $("#mapfocus"), ctx = C();
    if (!sel || !isActive) { box.hidden = true; return; }
    const a = ctx.A[sel];
    const top = (arr) => ctx.sortRel(arr).slice(0, 4).map((r) => esc(ctx.A[r.id].name)).join(", ");
    box.style.setProperty("--c", COL[a.family]);
    box.innerHTML = `<button class="x" aria-label="Clear selection">×</button>
      <div class="fh">${ctx.vinyl(a.id)}<div style="min-width:0"><span class="k">${esc(ctx.FAM[a.family].name)} · ${esc(a.decade)}</span><h2>${esc(a.name)}</h2></div></div>
      ${a.summary && $("#mapwrap").clientWidth >= 600 ? `<p>${esc(a.summary)}</p>` : ""}
      ${ctx.dnaHTML(a.id, true)}
      <div class="cnt"><span class="up">● <b>${a.up.length}</b> shaped them</span><span class="down">● <b>${a.down.length}</b> they shaped</span></div>
      ${a.up.length ? `<p><span class="up">From</span> ${top(a.up)}${a.up.length > 4 ? "…" : ""}</p>` : ""}
      ${a.down.length ? `<p><span class="down">To</span> ${top(a.down)}${a.down.length > 4 ? "…" : ""}</p>` : ""}
      <div class="gbtns"><button class="solid" data-open="${a.id}">Profile</button><button class="ghost small" data-tree="artist" data-id="${a.id}">Family tree</button></div>`;
    box.hidden = false;
  }

  /* ---------- history playback ---------- */
  function setCutoff(i) {
    cutoff = i; $("#era").value = i; $("#eralabel").textContent = C().DECADES[i];
    if (sel && C().decIdx(C().A[sel].decade) > i) { sel = null; focusCard(); }
    refresh();
  }
  function playHistory() {
    const big = $("#bigyear"), btn = $("#playhist");
    let i = 0; select(null); setCutoff(0);
    big.hidden = false; big.textContent = C().DECADES[0]; btn.innerHTML = "<span>■ Stop</span>";
    const start = -((C().DECADES.length - 1) / 2) * DX + 350;
    const cam = (c, ms) => { const d = frontDist() * 0.62, tgt = P(c, 0, 0), h = home(d); G3.cameraPosition({ x: tgt.x + h.x, y: tgt.y + h.y, z: h.z }, tgt, ms); };
    if (mode === "3d" && G3) cam(start, 1200);
    playing = setInterval(() => {
      i++;
      if (i >= C().DECADES.length) { stopPlay(); return; }
      setCutoff(i); big.textContent = C().DECADES[i];
      if (mode === "3d" && G3) cam(Math.min(start + i * 110, 0), 1000);
    }, 1100);
  }
  function stopPlay() {
    if (!playing) return;
    clearInterval(playing); playing = null;
    $("#bigyear").hidden = true; $("#playhist").innerHTML = `<svg><use href="#i-play"/></svg><span>History</span>`;
  }

  /* ---------- flat fallback (2D canvas, d3 zoom) ---------- */
  function buildFlat() {
    builtF = true;
    const ctx = C(), canvas = $("#graph"), c2 = canvas.getContext("2d");
    let W = 2800, H = 1500, xs, ys;
    const fn = nodes.map((n) => ({ id: n.id, a: n.a, r: 2.5 + Math.sqrt(deg(n.a)) * 1.2, x: 0, y: 0 }));
    const fb = Object.fromEntries(fn.map((n) => [n.id, n]));
    const fl = links.map((l) => ({ source: lid(l.source), target: lid(l.target) }));
    // time on x in landscape, on y in portrait; genre lanes on the other axis
    function layout() {
      W = vert ? 1300 : 2800; H = vert ? 2800 : 1500;
      xs = d3.scaleLinear().domain([0, ctx.DECADES.length - 1]).range(vert ? [-H / 2 + 100, H / 2 - 100] : [-W / 2 + 100, W / 2 - 100]);
      ys = d3.scalePoint().domain(LANES).range(vert ? [-W / 2 + 80, W / 2 - 80] : [-H / 2 + 120, H / 2 - 120]);
      const T = (d) => xs(ctx.decIdx(d.a.decade)), L = (d) => ys(d.a.family);
      for (const n of fn) { n.x = vert ? L(n) : T(n); n.y = vert ? T(n) : L(n); n.vx = n.vy = 0; }
      const sim = d3.forceSimulation(fn)
        .force("link", d3.forceLink(fl.map((l) => ({ ...l }))).id((d) => d.id).distance(70).strength(0.03))
        .force("charge", d3.forceManyBody().strength(-34).distanceMax(220))
        .force("x", d3.forceX(vert ? L : T).strength(vert ? 0.12 : 0.4))
        .force("y", d3.forceY(vert ? T : L).strength(vert ? 0.4 : 0.12))
        .force("collide", d3.forceCollide((d) => d.r + 2)).stop();
      for (let i = 0; i < 300; i++) sim.tick();
    }
    layout();
    F = { canvas, t: d3.zoomIdentity };
    const zoomB = d3.zoom().scaleExtent([0.15, 8]).on("zoom", (e) => { F.t = e.transform; F.draw(); });
    F.zoom = zoomB;
    d3.select(canvas).call(zoomB).on("dblclick.zoom", null);
    const fvis = (n) => !hidden.has(n.a.family) && ctx.decIdx(n.a.decade) <= cutoff;
    const pick = (ev) => {
      const [mx, my] = d3.pointer(ev, canvas), [x, y] = F.t.invert([mx, my]);
      let best = null, bd = Infinity;
      for (const n of fn) { if (!fvis(n)) continue; const d = (n.x - x) ** 2 + (n.y - y) ** 2, rr = Math.max(n.r, 8 / F.t.k); if (d < rr * rr && d < bd) { bd = d; best = n; } }
      return best;
    };
    let fh = null;
    canvas.addEventListener("mousemove", (ev) => {
      const n = pick(ev); if (n !== fh) { fh = n; F.draw(); }
      canvas.style.cursor = n ? "pointer" : "grab";
      const tip = $("#tip");
      if (n) { const [mx, my] = d3.pointer(ev, canvas); tip.innerHTML = `<b>${esc(n.a.name)}</b><br>${esc(ctx.FAM[n.a.family].name)} · ${esc(n.a.decade)}`; tip.style.left = Math.min(mx + 14, canvas.clientWidth - 270) + "px"; tip.style.top = my + 14 + "px"; tip.hidden = false; }
      else tip.hidden = true;
    });
    canvas.addEventListener("mouseleave", () => { $("#tip").hidden = true; fh = null; F.draw(); });
    canvas.addEventListener("click", (ev) => { const n = pick(ev); select(n ? n.id : null, false); });
    F.draw = () => {
      const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, w, h);
      const t = F.t;
      c2.save(); c2.translate(t.x, t.y); c2.scale(t.k, t.k);
      ctx.DECADES.forEach((d, i) => { if (i % 2) return; const bw = xs(1) - xs(0); c2.fillStyle = "rgba(255,255,255,0.025)"; if (vert) c2.fillRect(-W, xs(i) - bw / 2, W * 2, bw); else c2.fillRect(xs(i) - bw / 2, -H, bw, H * 2); });
      const focus = sel || fh?.id;
      const U = new Set(focus ? ctx.A[focus].up.map((r) => r.id) : []), D = new Set(focus ? ctx.A[focus].down.map((r) => r.id) : []);
      for (const l of fl) {
        const s = fb[l.source], g = fb[l.target]; if (!fvis(s) || !fvis(g)) continue;
        const isU = focus && l.target === focus, isD = focus && l.source === focus;
        c2.globalAlpha = focus ? (isU || isD ? 0.95 : 0.03) : 0.12;
        c2.strokeStyle = isU ? UP : isD ? DOWN : "#aab";
        c2.lineWidth = (isU || isD ? 1.8 : 0.7) / Math.sqrt(t.k);
        c2.beginPath(); c2.moveTo(s.x, s.y); c2.quadraticCurveTo((s.x + g.x) / 2, (s.y + g.y) / 2 - Math.abs(g.x - s.x) * 0.12, g.x, g.y); c2.stroke();
      }
      for (const n of fn) {
        if (!fvis(n)) continue;
        const dim = focus && n.id !== focus && !U.has(n.id) && !D.has(n.id);
        c2.globalAlpha = dim ? 0.12 : 1; c2.fillStyle = n.id === focus ? "#fff" : COL[n.a.family];
        c2.beginPath(); c2.arc(n.x, n.y, n.r, 0, 2 * Math.PI); c2.fill();
      }
      c2.textBaseline = "middle";
      for (const n of fn) {
        if (!fvis(n)) continue;
        const near = focus && (n.id === focus || U.has(n.id) || D.has(n.id));
        if (!(near || (!focus && n.r * t.k > 8.5) || (focus && n.r * t.k > 16))) continue;
        c2.globalAlpha = 1; c2.font = `${n.id === focus ? 700 : 600} ${Math.max(11, Math.min(15, n.r * t.k * 0.85)) / t.k}px "Instrument Sans", sans-serif`;
        c2.lineWidth = 3 / t.k; c2.strokeStyle = "#0a0b12"; c2.strokeText(n.a.name, n.x + n.r + 3 / t.k, n.y);
        c2.fillStyle = U.has(n.id) ? "#a9bbff" : D.has(n.id) ? "#ffb08f" : "#ecebf4"; c2.fillText(n.a.name, n.x + n.r + 3 / t.k, n.y);
      }
      c2.restore();
      c2.globalAlpha = 1; c2.fillStyle = "#8f8da3"; c2.textAlign = "center"; c2.textBaseline = "top"; c2.font = `600 11px "JetBrains Mono", monospace`;
      ctx.DECADES.forEach((d, i) => { if (i > cutoff) return; if (vert) { const y = t.applyY(xs(i)); if (y > -20 && y < h + 20) { c2.textAlign = "left"; c2.fillText(d.toUpperCase(), 10, y - 6); } } else { const x = t.applyX(xs(i)); if (x > -60 && x < w + 60) c2.fillText(d.toUpperCase(), x, 60); } });
      c2.textAlign = "left";
    };
    F.fit = () => { const w = canvas.clientWidth, h = canvas.clientHeight, k = Math.min(w / W, h / H) * 0.94; d3.select(canvas).transition().duration(400).call(zoomB.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(k)); };
    F.relayout = () => { layout(); F.fit(); };
    F.center = (id) => { const n = fb[id]; if (!n) return; const w = canvas.clientWidth, h = canvas.clientHeight, k = Math.max(F.t.k, 1.1); d3.select(canvas).transition().duration(500).call(zoomB.transform, d3.zoomIdentity.translate(w / 2 - n.x * k, h / 2 - n.y * k).scale(k)); };
    size(); F.fit();
  }

  window.SL_MAP = { init, active, select };
})();
