/* City map layer: where artists came up, the scenes that formed there, and how each city's sound spread.
   d3-geo on a canvas, world borders from Natural Earth (world-atlas). Shares the time slider and genre filter with the map. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const UP = "#92a8ff", DOWN = "#ff8c5e";
  let built = false, ready = false, canvas, ctx2, proj, path, zoomB, t = d3.zoomIdentity, W = 0, H = 0;
  let land = null, borders = null, CITIES = [], CBY = {}, SCENES = [], selCity = null, hoverCity = null, opts = null;

  async function load() {
    const ctx = C();
    const [world, geo, scenes] = await Promise.all([
      fetch("data/world.json").then((r) => r.json()),
      fetch("data/geo.json").then((r) => r.json()),
      fetch("data/scenes.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    land = topojson.feature(world, world.objects.countries);
    borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
    for (const a of ctx.ARTISTS) {
      const g = geo[a.id]; if (!g) continue;
      const key = `${g[2]}|${g[3]}`;
      (CBY[key] ??= { key, name: g[2], cc: g[3], lat: g[0], lon: g[1], ids: [] }).ids.push(a.id);
      a.cityKey = key;
    }
    CITIES = Object.values(CBY);
    SCENES = (Array.isArray(scenes) ? scenes : scenes.scenes || []).map((s) => {
      // attach each scene to the city most of its artists came from, else the named city
      const counts = {};
      for (const id of s.artists || []) { const k = ctx.A[id]?.cityKey; if (k) counts[k] = (counts[k] || 0) + 1; }
      const named = CITIES.find((c) => c.name.toLowerCase() === String(s.city || "").split(",")[0].trim().toLowerCase());
      const key = named?.key || Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      return { ...s, key };
    }).filter((s) => s.key && CBY[s.key]);
    for (const s of SCENES) (CBY[s.key].scenes ??= []).push(s);
    ready = true;
  }

  function visIds(c) { return c.ids.filter((id) => opts.vis(C().A[id])); }
  function domFam(ids) { const m = {}; for (const id of ids) { const f = C().A[id].family; m[f] = (m[f] || 0) + 1; } return Object.keys(m).sort((a, b) => m[b] - m[a])[0]; }

  async function build(o) {
    opts = o;
    if (built) return;
    built = true;
    canvas = $("#citymap"); ctx2 = canvas.getContext("2d");
    $("#citynote").hidden = false; $("#citynote").textContent = "Loading the world map…";
    try { await load(); } catch (e) { $("#citynote").textContent = "The world map could not load. Reload the page to try again."; return; }
    $("#citynote").hidden = true;
    zoomB = d3.zoom().scaleExtent([1, 40]).on("zoom", (e) => { t = e.transform; draw(); });
    d3.select(canvas).call(zoomB).on("dblclick.zoom", null);
    canvas.addEventListener("mousemove", (ev) => { const c = pick(ev); if (c !== hoverCity) { hoverCity = c; draw(); } canvas.style.cursor = c ? "pointer" : "grab"; tip(ev, c); });
    canvas.addEventListener("mouseleave", () => { hoverCity = null; $("#tip").hidden = true; draw(); });
    canvas.addEventListener("click", (ev) => { const c = pick(ev); openCity(c ? c.key : null); });
    sceneChips();
    resize();
  }
  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1; W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    proj = d3.geoNaturalEarth1().fitExtent([[20, 40], [W - 20, H - 60]], W / H < 1 ? { type: "MultiPoint", coordinates: [[-100, 22], [-70, 50]] } : { type: "MultiPoint", coordinates: [[-122, 18], [28, 18], [-122, 60], [28, 60]] });
    path = d3.geoPath(proj, ctx2);
    draw();
  }
  const sxy = (c) => { const p = proj([c.lon, c.lat]); return [t.applyX(p[0]), t.applyY(p[1])]; };
  const rad = (n) => 2.2 + Math.sqrt(n) * 2.1 * Math.min(1.8, Math.pow(t.k, 0.25));

  function pick(ev) {
    const r = canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = Infinity;
    for (const c of CITIES) {
      const n = visIds(c).length; if (!n) continue;
      const [x, y] = sxy(c), d = (x - mx) ** 2 + (y - my) ** 2, rr = Math.max(rad(n), 8);
      if (d < rr * rr && d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function tip(ev, c) {
    const el = $("#tip");
    if (!c) { el.hidden = true; return; }
    const ids = visIds(c), ctx = C();
    const fams = {}; ids.forEach((id) => { const f = ctx.A[id].family; fams[f] = (fams[f] || 0) + 1; });
    el.innerHTML = `<b>${esc(c.name)}</b><br>${ids.length} artist${ids.length === 1 ? "" : "s"} · ${Object.entries(fams).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => esc(ctx.FAM[f].short)).join(", ")}${c.scenes ? `<br>${esc(c.scenes.map((s) => s.name).join(" · "))}` : ""}`;
    const r = canvas.getBoundingClientRect();
    el.style.left = Math.min(ev.clientX - r.left + 14, W - 270) + "px"; el.style.top = ev.clientY - r.top + 14 + "px"; el.hidden = false;
  }

  /* where a city's sound went, and where it came from */
  function flows(c) {
    const ctx = C(), out = {}, inn = {};
    for (const id of visIds(c)) {
      for (const d of ctx.A[id].down) { const k = ctx.A[d.id].cityKey; if (k && k !== c.key && opts.vis(ctx.A[d.id])) out[k] = (out[k] || 0) + 1; }
      for (const u of ctx.A[id].up) { const k = ctx.A[u.id].cityKey; if (k && k !== c.key && opts.vis(ctx.A[u.id])) inn[k] = (inn[k] || 0) + 1; }
    }
    return { out, inn };
  }

  function draw() {
    if (!ready || !canvas || canvas.hidden) return;
    const dpr = window.devicePixelRatio || 1, ctx = C(), c2 = ctx2;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, W, H);
    c2.save(); c2.translate(t.x, t.y); c2.scale(t.k, t.k);
    c2.beginPath(); path({ type: "Sphere" }); c2.fillStyle = "#0d0f19"; c2.fill();
    c2.beginPath(); path(land); c2.fillStyle = "#1b1e2c"; c2.fill();
    c2.beginPath(); path(borders); c2.strokeStyle = "#2c3045"; c2.lineWidth = 0.6 / t.k; c2.stroke();
    c2.restore();
    const sel = selCity ? CBY[selCity] : null;
    // spread arcs for the selected city
    if (sel) {
      const f = flows(sel), [sx, sy] = sxy(sel);
      const arc = (k, n, col) => {
        const [x, y] = sxy(CBY[k]), mx = (sx + x) / 2, my = (sy + y) / 2 - Math.hypot(x - sx, y - sy) * 0.25;
        c2.beginPath(); c2.moveTo(col === DOWN ? sx : x, col === DOWN ? sy : y); c2.quadraticCurveTo(mx, my, col === DOWN ? x : sx, col === DOWN ? y : sy);
        c2.strokeStyle = col; c2.globalAlpha = 0.35 + Math.min(0.6, n * 0.12); c2.lineWidth = 1 + Math.min(4, n * 0.8); c2.stroke();
      };
      for (const [k, n] of Object.entries(f.inn)) arc(k, n, UP);
      for (const [k, n] of Object.entries(f.out)) arc(k, n, DOWN);
      c2.globalAlpha = 1;
    }
    // cities, biggest last so they sit on top
    const vis = CITIES.map((c) => ({ c, ids: visIds(c) })).filter((x) => x.ids.length).sort((a, b) => a.ids.length - b.ids.length);
    for (const { c, ids } of vis) {
      const [x, y] = sxy(c); if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const r = rad(ids.length), col = opts.COL[domFam(ids)] || "#ccc";
      const dim = sel && c !== sel;
      c2.globalAlpha = dim ? 0.45 : 0.9;
      c2.beginPath(); c2.arc(x, y, r, 0, Math.PI * 2); c2.fillStyle = col; c2.fill();
      if (c.scenes) { c2.globalAlpha = dim ? 0.4 : 0.9; c2.beginPath(); c2.arc(x, y, r + 3.5, 0, Math.PI * 2); c2.strokeStyle = "#ffffff"; c2.lineWidth = 1.2; c2.stroke(); }
      if (c === sel || c === hoverCity) { c2.globalAlpha = 1; c2.beginPath(); c2.arc(x, y, r + 6, 0, Math.PI * 2); c2.strokeStyle = "#fff"; c2.lineWidth = 2; c2.stroke(); }
    }
    c2.globalAlpha = 1;
    // labels with simple collision avoidance
    const placed = [], order = [...vis].sort((a, b) => (b.c === sel) - (a.c === sel) || (!!b.c.scenes - !!a.c.scenes) || b.ids.length - a.ids.length);
    c2.textBaseline = "middle";
    for (const { c, ids } of order.slice(0, 80)) {
      const [x, y] = sxy(c); if (x < 0 || x > W || y < 0 || y > H) continue;
      const big = c === sel || ids.length >= 8 || c.scenes;
      if (!big && t.k < 2.5) continue;
      const label = c.name, fs = c === sel ? 14 : big ? 12 : 11;
      c2.font = `${c === sel ? 700 : 600} ${fs}px "Instrument Sans", system-ui, sans-serif`;
      const w = c2.measureText(label).width, r = rad(ids.length), bx = [x + r + 4, y - fs / 2, w + 4, fs];
      if (placed.some((q) => bx[0] < q[0] + q[2] && bx[0] + bx[2] > q[0] && bx[1] < q[1] + q[3] && bx[1] + bx[3] > q[1])) continue;
      placed.push(bx);
      c2.lineWidth = 3; c2.strokeStyle = "#0a0b12"; c2.strokeText(label, x + r + 4, y);
      c2.fillStyle = c === sel ? "#fff" : "#dcdbe8"; c2.fillText(label, x + r + 4, y);
    }
  }

  /* ---------- city card ---------- */
  function openCity(key, highlightId) {
    selCity = key && CBY[key] ? key : null;
    draw();
    const box = $("#mapfocus"), ctx = C();
    if (!selCity) { box.hidden = true; return; }
    const c = CBY[selCity], ids = visIds(c);
    const byDec = {};
    ids.sort((a, b) => ctx.A[b].reach - ctx.A[a].reach).forEach((id) => { (byDec[ctx.A[id].decade] ??= []).push(id); });
    const f = flows(c);
    const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => esc(CBY[k].name)).join(", ");
    box.style.setProperty("--c", opts.COL[domFam(ids)] || "#fff");
    box.innerHTML = `<button class="x" aria-label="Close">×</button>
      <span class="k">${ids.length} artist${ids.length === 1 ? "" : "s"}${c.scenes ? " · " + esc(c.scenes.map((s) => s.name.split(":").pop().trim()).join(", ")) : ""}</span>
      <h2>${esc(c.name)}</h2>
      ${(c.scenes || []).map((s) => `<p><b style="color:#fff">${esc(s.name)}</b>${s.decades?.length ? ` <span class="mono" style="font-size:.75rem">${esc(s.decades.join("–"))}</span>` : ""}<br>${esc(s.blurb)}${s.spread ? ` ${esc(s.spread)}` : ""}</p>`).join("")}
      ${Object.keys(f.out).length ? `<p><span class="down">Sound spread to</span> ${top(f.out)}</p>` : ""}
      ${Object.keys(f.inn).length ? `<p><span class="up">Drew from</span> ${top(f.inn)}</p>` : ""}
      ${Object.keys(byDec).sort().map((d) => `<div><span class="k" style="color:#8f8da3">${d}</span><div class="chips" style="margin-top:4px">${byDec[d].map((id) => `<button class="chip${id === highlightId ? " on" : ""}" data-id="${id}" style="--c:${opts.COL[ctx.A[id].family]};background:transparent;color:#fff;border-color:${id === highlightId ? "#fff" : "rgba(255,255,255,.18)"}">${esc(ctx.A[id].name)}</button>`).join("")}</div></div>`).join("")}`;
    box.hidden = false;
  }
  function focusOn(key, k = 5) {
    const c = CBY[key]; if (!c) return;
    const p = proj([c.lon, c.lat]);
    d3.select(canvas).transition().duration(700).call(zoomB.transform, d3.zoomIdentity.translate(W / 2 - p[0] * k - (W > 700 ? 160 : 0), H / 2 - p[1] * k + (W > 700 ? 0 : -60)).scale(k));
  }
  function selectArtist(id) {
    const k = C().A[id]?.cityKey; if (!k) return;
    focusOn(k, 5); openCity(k, id);
  }
  function sceneChips() {
    const el = $("#scenes");
    if (!SCENES.length) { el.innerHTML = ""; return; }
    el.innerHTML = `<span class="legend-ln" style="color:var(--muted)">Scenes</span>` + SCENES.map((s) => `<button data-scene="${esc(s.id)}">${esc(s.name)}</button>`).join("");
    el.onclick = (e) => {
      const b = e.target.closest("[data-scene]"); if (!b) return;
      const s = SCENES.find((x) => x.id === b.dataset.scene); if (!s) return;
      focusOn(s.key, s.key.startsWith("New York") || s.key.startsWith("London") ? 6 : 5); openCity(s.key);
    };
  }
  function fit() { if (canvas) d3.select(canvas).transition().duration(500).call(zoomB.transform, d3.zoomIdentity); }
  function zoom(f) { if (canvas) d3.select(canvas).transition().duration(250).call(zoomB.scaleBy, 1 / f); }
  function refresh() { if (built) { draw(); if (selCity) openCity(selCity); } }
  function clear() { selCity = null; draw(); }

  window.SL_CITIES = { build, resize, refresh, fit, zoom, selectArtist, clear, get ready() { return ready; } };
})();
