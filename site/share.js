/* Sharing: a drawn lineage card for any artist or mix, your taste as Genre DNA, and a link a friend
   can open to compare tastes. Links use the public site so they open for anyone. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SITE = "https://scarusillo.github.io/Sound-Lineage/";
  // the card is always drawn on a dark sleeve, so it uses the map's bright genre palette
  const COL = { blues: "#6f97f0", jazz: "#a88bf2", country: "#e0ae55", folk: "#9cc96b", rock: "#f26a5c", alt: "#45cbbd", metal: "#b4b0c2",
    soul: "#f7ad4f", pop: "#f27fd3", hiphop: "#f4d047", electronic: "#5ec8f5", reggae: "#bede4f", latin: "#e09572", global: "#3ddc97" };
  const UP = "#a9bbff", DOWN = "#ffb08f";

  /* ---------- taste ---------- */
  function tasteDNA(ids) {
    const ctx = C(), w = {};
    ids.slice(0, 25).forEach((id, i) => { const k = 1 / (1 + i * 0.15); for (const [f, p] of ctx.dna(id).length ? ctx.dna(id) : [[ctx.A[id].family, 1]]) w[f] = (w[f] || 0) + p * k; });
    const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    let parts = Object.entries(w).map(([f, v]) => [f, v / sum]).sort((a, b) => b[1] - a[1]);
    const keep = parts.filter(([, p]) => p >= 0.035), t = keep.reduce((s, [, p]) => s + p, 0);
    return keep.map(([f, p]) => [f, p / t]);
  }
  function dnaBar(parts, label) {
    const F = C().FAM;
    return `<div class="dna-bar" role="img" aria-label="${esc(label)}: ${parts.map(([f, p]) => `${F[f].name} ${Math.round(p * 100)}%`).join(", ")}">${parts.map(([f, p]) => `<i style="width:${(p * 100).toFixed(1)}%;background:var(--f-${f})"></i>`).join("")}</div>`;
  }
  function dnaKey(parts) { const F = C().FAM; return `<div class="dna-key">${parts.map(([f, p]) => `<span><i style="background:var(--f-${f})"></i>${esc(F[f].short)} <b>${Math.round(p * 100)}%</b></span>`).join("")}</div>`; }
  const code = (ids) => { const idx = C().ARTISTS.map((a) => a.id); return ids.slice(0, 12).map((id) => idx.indexOf(id)).filter((i) => i >= 0).map((i) => i.toString(36)).join("."); };
  const decode = (s) => { const arr = C().ARTISTS; return [...new Set(String(s || "").split(".").map((x) => arr[parseInt(x, 36)]?.id).filter(Boolean))]; };
  function tasteCardHTML(ids) {
    const parts = tasteDNA(ids);
    return `<section class="panel-card"><div class="sec-h"><h2>Your Genre DNA</h2><span class="qmeta">from ${Math.min(ids.length, 25)} artists you play and their roots</span></div>${dnaBar(parts, "Your Genre DNA")}${dnaKey(parts)}<div class="gbtns"><button class="solid" data-sharetaste><svg><use href="#i-share"/></svg>Compare with a friend</button><button class="ghost" data-go="mix">Open your mix</button></div></section>`;
  }

  /* ---------- drawing ---------- */
  async function fontsReady() { try { await Promise.all([document.fonts.load('400 120px "Instrument Serif"'), document.fonts.load('600 40px "Instrument Sans"'), document.fonts.load('600 30px "JetBrains Mono"')]); } catch { /* fall back */ } }
  function wrap(g, text, x, y, maxW, lh, maxLines) {
    const lines = []; let line = "";
    for (const w of String(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    const out = lines.slice(0, maxLines);
    if (lines.length > maxLines) { let l = out[maxLines - 1]; while (g.measureText(l + "…").width > maxW && l.length) l = l.slice(0, -1); out[maxLines - 1] = l + "…"; }
    out.forEach((l, i) => g.fillText(l, x, y + i * lh));
    return out.length;
  }
  function record(g, cx, cy, r, color, label) {
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = "#121218"; g.fill();
    g.strokeStyle = "#262630"; g.lineWidth = 1.2;
    for (let rr = r * 0.36; rr < r * 0.98; rr += 4) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); }
    const sh = g.createConicGradient ? g.createConicGradient(0.6, cx, cy) : null;
    if (sh) { sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.08, "rgba(255,255,255,.12)"); sh.addColorStop(0.16, "rgba(255,255,255,0)"); sh.addColorStop(0.55, "rgba(255,255,255,0)"); sh.addColorStop(0.62, "rgba(255,255,255,.08)"); sh.addColorStop(0.7, "rgba(255,255,255,0)"); g.fillStyle = sh; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(cx, cy, r * 0.31, 0, Math.PI * 2); g.fillStyle = color; g.fill();
    g.beginPath(); g.arc(cx, cy, r * 0.03, 0, Math.PI * 2); g.fillStyle = "#121218"; g.fill();
    if (label) { g.fillStyle = "#fff"; g.font = `400 ${r * 0.2}px "Instrument Serif", Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, cx, cy + r * 0.11); }
    g.restore();
  }
  function base(color) {
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
    const g = cv.getContext("2d");
    g.fillStyle = "#0b0b10"; g.fillRect(0, 0, 1080, 1350);
    const rg = g.createRadialGradient(980, 60, 40, 900, 200, 1100); rg.addColorStop(0, color + "cc"); rg.addColorStop(0.45, color + "33"); rg.addColorStop(1, "#0b0b1000"); g.fillStyle = rg; g.fillRect(0, 0, 1080, 1350);
    return [cv, g];
  }
  function footer(g, sub) {
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(80, 1230, 920, 2);
    record(g, 104, 1286, 24, "#ff8d5f");
    g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.font = `400 40px "Instrument Serif", Georgia, serif`; g.fillText("Sound Lineage", 142, 1288);
    g.fillStyle = "rgba(255,255,255,.6)"; g.font = `600 22px "JetBrains Mono", monospace`; g.textAlign = "right"; g.fillText(sub, 1000, 1290);
  }
  function bar(g, parts, x, y, w, h) {
    let cx = x; const F = C().FAM;
    for (const [f, p] of parts) { const ww = Math.max(4, p * w - 4); g.fillStyle = COL[f]; roundRect(g, cx, y, ww, h, h / 2); g.fill(); cx += p * w; }
    g.font = `600 24px "Instrument Sans", system-ui, sans-serif`; g.textBaseline = "top"; g.textAlign = "left";
    let lx = x, ly = y + h + 18;
    for (const [f, p] of parts.slice(0, 6)) { const t = `${F[f].short} ${Math.round(p * 100)}%`, tw = g.measureText(t).width + 44; if (lx + tw > x + w) { lx = x; ly += 36; } g.fillStyle = COL[f]; g.beginPath(); g.arc(lx + 8, ly + 13, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,.8)"; g.fillText(t, lx + 24, ly); lx += tw; }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  async function artistCard(id) {
    await fontsReady();
    const ctx = C(), a = ctx.A[id], color = COL[a.family];
    const [cv, g] = base(color);
    record(g, 830, 270, 190, color, ctx.initials(a.name));
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "rgba(255,255,255,.7)"; g.font = `600 26px "JetBrains Mono", monospace`; g.fillText(`${ctx.FAM[a.family].name.toUpperCase()} · ${a.decade.toUpperCase()}`, 80, 120);
    g.fillStyle = "#fff"; let size = 118; g.font = `400 ${size}px "Instrument Serif", Georgia, serif`;
    while (g.measureText(a.name).width > 520 && size > 64) { size -= 6; g.font = `400 ${size}px "Instrument Serif", Georgia, serif`; }
    const lines = wrap(g, a.name, 80, 120 + size + 10, 530, size * 0.98, 3);
    let y = 120 + size + 10 + lines * size * 0.98 + 20;
    y = Math.max(y, 500);
    const col = (title, arr, x, c) => {
      g.fillStyle = c; g.font = `700 24px "Instrument Sans", system-ui, sans-serif`; g.fillText(title.toUpperCase(), x, y);
      g.font = `600 40px "Instrument Sans", system-ui, sans-serif`;
      arr.slice(0, 6).forEach((r, i) => { const n = ctx.A[r.id].name; g.fillStyle = COL[ctx.A[r.id].family]; g.beginPath(); g.arc(x + 9, y + 52 + i * 62 - 13, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; let t = n; while (g.measureText(t).width > 400 && t.length > 3) t = t.slice(0, -2); g.fillText(t === n ? t : t + "…", x + 30, y + 52 + i * 62); });
    };
    col(`Came from · ${a.up.length}`, ctx.sortRel(a.up), 80, UP);
    col(`${a.role ? "Credits" : "Led to"} · ${a.down.length}`, ctx.sortRel(a.down), 560, DOWN);
    const parts = ctx.dna(id);
    if (parts.length > 1) { g.fillStyle = "rgba(255,255,255,.7)"; g.font = `700 24px "Instrument Sans", system-ui, sans-serif`; g.fillText("GENRE DNA", 80, 1010); bar(g, parts, 80, 1036, 920, 22); }
    footer(g, "WHO SHAPED WHOM");
    return cv.toDataURL("image/png");
  }
  async function mixCard(mix) {
    await fontsReady();
    const ctx = C(), A = ctx.A, f0 = A[mix.picks[0].id].family;
    const [cv, g] = base(COL[f0]);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "rgba(255,255,255,.7)"; g.font = `600 26px "JetBrains Mono", monospace`; g.fillText("LINEAGE MIX · HUMAN-CURATED, NO AI TRACKS", 80, 120);
    g.fillStyle = "#fff"; g.font = `400 104px "Instrument Serif", Georgia, serif`; g.fillText(mix.title.replace("Lineage Mix · ", "Week of "), 80, 230);
    mix.picks.slice(0, 12).forEach((p, i) => {
      const y = 330 + i * 70;
      g.fillStyle = "rgba(255,255,255,.45)"; g.font = `600 24px "JetBrains Mono", monospace`; g.fillText(String(i + 1).padStart(2, "0"), 80, y);
      g.fillStyle = COL[A[p.id].family]; g.beginPath(); g.arc(150, y - 9, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff"; g.font = `600 34px "Instrument Sans", system-ui, sans-serif`; let t = p.song; while (g.measureText(t).width > 470 && t.length > 3) t = t.slice(0, -2); g.fillText(t === p.song ? t : t + "…", 176, y);
      g.fillStyle = "rgba(255,255,255,.65)"; g.font = `400 30px "Instrument Sans", system-ui, sans-serif`; let n = A[p.id].name; while (g.measureText(n).width > 330 && n.length > 3) n = n.slice(0, -2); g.fillText(n === A[p.id].name ? n : n + "…", 670, y);
    });
    footer(g, "A NEW MIX EVERY MONDAY");
    return cv.toDataURL("image/png");
  }
  async function tasteImg(ids) {
    await fontsReady();
    const ctx = C(), parts = tasteDNA(ids), [cv, g] = base(COL[parts[0][0]]);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "rgba(255,255,255,.7)"; g.font = `600 26px "JetBrains Mono", monospace`; g.fillText("MY GENRE DNA", 80, 120);
    g.fillStyle = "#fff"; g.font = `400 110px "Instrument Serif", Georgia, serif`; wrap(g, `Mostly ${ctx.FAM[parts[0][0]].short.toLowerCase()}, with ${ctx.FAM[(parts[1] || parts[0])[0]].short.toLowerCase()} roots`, 80, 250, 920, 108, 3);
    bar(g, parts, 80, 640, 920, 34);
    g.fillStyle = "rgba(255,255,255,.7)"; g.font = `700 24px "Instrument Sans", system-ui, sans-serif`; g.fillText("ARTISTS I PLAY", 80, 860);
    g.fillStyle = "#fff"; g.font = `600 36px "Instrument Sans", system-ui, sans-serif`; wrap(g, ids.slice(0, 8).map((i) => ctx.A[i].name).join(" · "), 80, 912, 920, 50, 4);
    footer(g, "COMPARE YOURS");
    return cv.toDataURL("image/png");
  }

  /* ---------- the share sheet ---------- */
  function open(title, html) {
    $("#sharesheet .sheet-t").textContent = title;
    $("#sharebody").innerHTML = html;
    $("#sharesheet").hidden = false; $("#scrim").hidden = false; document.body.classList.add("lock");
  }
  function close() { $("#sharesheet").hidden = true; if ($("#panel").hidden) { $("#scrim").hidden = true; document.body.classList.remove("lock"); } }
  const inClaude = () => !!window.claude?.use;
  function sheetHTML(link, text, note) {
    return `<img class="share-card" id="shareimg" alt="Share card" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="1080" height="1350" style="height:auto;aspect-ratio:4/5;background:var(--sunk)">
      <p class="qmeta" style="text-align:center;margin:10px 0 0;font-size:.82rem">${inClaude() ? "Press and hold the image (or right-click it) to save it." : ""}</p>
      ${note ? `<p class="qmeta" style="margin:10px 0 0">${note}</p>` : ""}
      <div class="share-acts">
        <button class="solid" data-sharecopy="${esc(link)}">Copy link</button>
        <button class="ghost" data-sharetext="${esc(text)}">Copy as text</button>
        ${navigator.share && !inClaude() ? `<button class="ghost" data-sharenative>More…</button>` : ""}
        ${!inClaude() ? `<a class="ghost" id="sharedl" download="sound-lineage.png" href="#">Save image</a>` : ""}
      </div>
      <textarea class="copybox" id="sharebox" hidden aria-label="Text to copy" style="margin-top:12px"></textarea>`;
  }
  function fill(p, link, text) {
    p.then((url) => { const img = $("#shareimg"); if (img) img.src = url; const dl = $("#sharedl"); if (dl) dl.href = url; }).catch(() => { const img = $("#shareimg"); if (img) img.replaceWith(Object.assign(document.createElement("p"), { className: "notice", textContent: "The card image could not be drawn here. The link and text still work." })); });
    const body = $("#sharebody");
    body.onclick = async (e) => {
      const c = e.target.closest("[data-sharecopy]"); if (c) { await C().copyText(c.dataset.sharecopy, c, $("#sharebox")); return; }
      const t = e.target.closest("[data-sharetext]"); if (t) { await C().copyText(t.dataset.sharetext, t, $("#sharebox")); return; }
      if (e.target.closest("[data-sharenative]")) { try { await navigator.share({ title: "Sound Lineage", text, url: link }); } catch { /* cancelled */ } }
    };
  }
  function artist(id) {
    const ctx = C(), a = ctx.A[id]; if (!a) return;
    const link = SITE + "#" + id;
    const up = ctx.sortRel(a.up).slice(0, 5).map((r) => ctx.A[r.id].name), down = ctx.sortRel(a.down).slice(0, 5).map((r) => ctx.A[r.id].name);
    const text = `${a.name}: who shaped them and who they shaped.\nCame from: ${up.join(", ") || "a root of the tree"}\nLed to: ${down.join(", ") || "nobody mapped yet"}\n${link}`;
    open(`Share ${a.name}`, sheetHTML(link, text));
    fill(artistCard(id), link, text);
  }
  function mix(m) {
    const text = window.SL_MIX.textOf(m) + `\n\nMade with Sound Lineage: ${SITE}`;
    open("Share this mix", sheetHTML(SITE + "#mix", text, "The link opens Sound Lineage, where your friend's own mix is built from their artists."));
    fill(mixCard(m), SITE + "#mix", text);
  }
  function taste() {
    const ids = window.SL_YOU.yourIds(); if (!ids.length) return;
    const link = `${SITE}#taste.${code(ids)}`;
    const parts = tasteDNA(ids), F = C().FAM;
    const text = `My Genre DNA: ${parts.slice(0, 4).map(([f, p]) => `${F[f].short} ${Math.round(p * 100)}%`).join(", ")}. Compare yours: ${link}`;
    open("Compare with a friend", sheetHTML(link, text, "When a friend opens this link, Sound Lineage lines up your Genre DNA with theirs, finds the roots you share, and shows the shortest path between your favorite artists."));
    fill(tasteImg(ids), link, text);
  }

  /* ---------- compare screen ---------- */
  function renderCompare(root, codeStr) {
    const ctx = C(), A = ctx.A, theirs = decode(codeStr), mine = window.SL_YOU.yourIds();
    if (!theirs.length) { root.innerHTML = `<div class="screen-h"><h1>Compare taste</h1><p class="lede">This link doesn't hold any artists. Ask your friend to share again from the You tab.</p></div>`; return; }
    const tp = tasteDNA(theirs);
    let body = "";
    if (mine.length >= 3) {
      const mp = tasteDNA(mine), m = Object.fromEntries(mp), score = Math.round(tp.reduce((s, [f, p]) => s + Math.min(p, m[f] || 0), 0) * 100);
      const ms = new Set(mine), both = theirs.filter((i) => ms.has(i));
      const rootsOf = (ids) => { const r = {}; ids.forEach((i) => A[i].up.forEach((u) => (r[u.id] = (r[u.id] || 0) + 1))); return r; };
      const rm = rootsOf(mine), rt = rootsOf(theirs);
      const shared = Object.keys(rm).filter((k) => rt[k]).sort((a, b) => rm[b] + rt[b] - rm[a] - rt[a]).slice(0, 10);
      const path = ctx.anyPath(mine[0], theirs[0]);
      const tryThese = window.SL_YOU.recommend(theirs).filter((r) => !ms.has(r.id)).slice(0, 6);
      body = `<section class="panel-card vs">
          <div class="overlap"><span class="big">${score}%</span><span class="qmeta">genre overlap</span></div>
          <div class="vs-row"><b>You</b>${dnaBar(mp, "Your Genre DNA")}</div>
          <div class="vs-row"><b>Friend</b>${dnaBar(tp, "Their Genre DNA")}</div>
          ${dnaKey(tp)}
        </section>
        ${both.length ? `<section class="sec"><h3>You both play</h3><div class="chips">${both.map((i) => ctx.chip(i)).join("")}</div></section>` : ""}
        ${shared.length ? `<section class="sec"><h3>Roots you share</h3><p class="qmeta" style="margin:0">Artists behind the music you each play.</p><div class="chips">${shared.map((i) => ctx.chip(i)).join("")}</div></section>` : ""}
        ${path && path.length > 1 ? `<section class="sec"><h3>From your favorite to theirs</h3><div class="path">${path.map((s, i) => `${i ? `<div class="arrow-hop ${s.dir}">${s.dir === "f" ? "→" : "←"}</div>` : ""}<div class="hop">${ctx.chip(s.id)}</div>`).join("")}</div></section>` : ""}
        ${tryThese.length ? `<section class="sec"><h3>From their side, try</h3><ul class="lg">${tryThese.map((r) => `<li><button class="lrow wrap" data-open="${r.id}">${ctx.vinyl(r.id)}<span style="min-width:0"><span class="t">${esc(A[r.id].name)}</span><span class="s">${esc(r.why[0])}</span></span><span class="r">${A[r.id].decade}</span></button></li>`).join("")}</ul></section>` : ""}`;
    } else {
      body = `<section class="panel-card"><h2>Their Genre DNA</h2>${dnaBar(tp, "Their Genre DNA")}${dnaKey(tp)}<p class="qmeta" style="margin:0">Add three or more of your own artists to see how your tastes line up.</p><div class="gbtns"><button class="solid" data-go="you">Add your artists</button></div></section>`;
    }
    root.innerHTML = `<div class="screen-h"><span class="eyebrow">A friend shared their taste</span><h1>Compare taste</h1><p class="lede">They play ${esc(theirs.slice(0, 5).map((i) => A[i].name).join(", "))}${theirs.length > 5 ? " and more" : ""}.</p></div>${body}
      <section class="sec"><h3>What they play</h3><div class="row">${theirs.map((i) => `<button class="rcard" data-open="${i}">${ctx.vinyl(i)}<span class="t">${esc(A[i].name)}</span><span class="s">${esc(ctx.FAM[A[i].family].short)} · ${A[i].decade}</span></button>`).join("")}</div></section>`;
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-closeshare]")) { close(); return; }
    if (e.target.closest("[data-sharetaste]")) { taste(); }
  });
  window.SL_SHARE = { artist, mix, taste, close, tasteDNA, tasteCardHTML, renderCompare, code, decode };
})();
