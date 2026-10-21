/* Live Spotify, through the viewer's own Spotify connector in claude.ai (the page never sees a token).
   Reads: your top artists, most-played and recent tracks, what's playing, similar artists.
   Writes (only on a click): build a playlist from a tree / chain / journey, follow an artist. */
(() => {
  "use strict";
  const C = () => window.SL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SERVER = "Spotify", LANG = (navigator.language || "en-US");
  let mcpP = null;
  const mcp = () => (mcpP ??= (window.claude?.use ? window.claude.use("mcp").catch(() => null) : Promise.resolve(null)));

  /* ---------- error copy, by code ---------- */
  function errText(e) {
    const code = e?.code || "upstream_error";
    const raw = JSON.stringify(e?.result || e?.message || "");
    if (/PREMIUM|NOT_SUBSCRIBED/i.test(raw)) return "Spotify only creates playlists for Premium accounts. You can still copy the list and paste it into a playlist.";
    return ({
      server_not_connected: "Spotify isn't connected to your Claude account. Add it in claude.ai Settings › Connectors, then reload this page.",
      needs_reauth: "Your Spotify connection expired. Reconnect Spotify in claude.ai Settings › Connectors.",
      selection_required: "You have more than one Spotify connection. Pick one when Claude asks, then try again.",
      not_in_manifest: "Spotify is turned off for this page. Turn it back on from this page's permissions, then try again.",
      approval_required: "Spotify needs your OK for this page. Try again and choose Allow when Claude asks.",
      blocked_by_policy: "Your organization blocks this Spotify action.",
      server_unavailable: "Spotify didn't answer just now. Try again in a moment.",
      tool_error: "Spotify couldn't do that. " + (typeof e?.message === "string" && e.message.length < 160 ? e.message : ""),
      not_granted: "Live Spotify isn't available in this view. Open the page in Claude to use it.",
      capability_disabled: "Live Spotify isn't available in this view. Open the page in Claude to use it.",
    })[code] || "Something went wrong talking to Spotify. Try again.";
  }
  async function call(tool, input, opts) {
    const m = await mcp();
    if (!m) throw { code: "not_granted" };
    const r = await m.callTool(SERVER, tool, input, opts);
    return r.payload ?? r;
  }
  const entities = (p) => (p && Array.isArray(p.entities) ? p.entities : []);

  /* ---------- state ---------- */
  const get = () => C().store.get("sl.spot", null);
  const set = (v) => C().store.set("sl.spot", v);
  let available = null; // null unknown, true/false
  mcp().then((m) => {
    available = !!m;
    const ready = () => { if (!window.SL) { setTimeout(ready, 200); return; } refreshUI(true); if (m && get() && Date.now() - (get().t || 0) > 6 * 36e5) sync(true); };
    ready();
  });

  /* map names to our artist ids */
  const idFor = (name) => (window.SL_YOU?.matchId ? window.SL_YOU.matchId(name) : null);

  async function sync(silent) {
    const msg = (t) => { if (!silent) document.querySelectorAll("[data-spotmsg]").forEach((el) => (el.textContent = t)); };
    msg("Reading your Spotify…");
    try {
      const opts = { cache: { staleTime: 60000 } };
      const [top, most, recent] = await Promise.allSettled([
        call("search", { prompt: "my top artists", language: LANG, limit: 20 }, opts),
        call("search", { prompt: "my most played tracks", language: LANG, limit: 20 }, opts),
        call("search", { prompt: "my recently played tracks", language: LANG, limit: 20 }, opts),
      ]);
      if (top.status === "rejected" && most.status === "rejected") throw top.reason;
      const artists = [], seen = new Set(), tracks = [];
      const addArtist = (name, uri, url, src) => {
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase()); artists.push({ name, uri: uri || null, url: url || null, id: idFor(name), src });
      };
      for (const e of entities(top.value)) if (e.entity_type === "CREATOR" || /artist/.test(e.uri || "")) addArtist(e.name, e.uri, e.url, "top");
      for (const [res, src] of [[most, "most"], [recent, "recent"]]) for (const e of entities(res.value)) {
        if (!(e.entity_type === "MUSIC" || /track/.test(e.uri || ""))) continue;
        const c = (e.creators || [])[0];
        tracks.push({ name: e.name, artist: c?.name || "", url: e.url || null, src });
        if (c) addArtist(c.name, c.uri, null, src);
      }
      set({ t: Date.now(), artists: artists.slice(0, 60), tracks: tracks.slice(0, 40) });
      msg("");
      refreshUI(true);
    } catch (e) { msg(errText(e)); }
  }
  function ids() { const s = get(); return s ? s.artists.filter((a) => a.id).map((a) => a.id) : []; }
  function urlFor(name) { const a = get()?.artists.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); return a?.url || null; }

  /* ---------- now playing ---------- */
  function findPlaying(p) {
    // payload shapes vary; look for a playable item with a name and creators
    const list = entities(p); if (list.length) return list[0];
    let hit = null;
    const walk = (o, d = 0) => { if (!o || typeof o !== "object" || hit || d > 5) return; if (typeof o.name === "string" && (o.creators || o.artists || o.artist)) { hit = o; return; } for (const v of Object.values(o)) walk(v, d + 1); };
    walk(p); return hit;
  }
  async function nowPlaying(btn) {
    const out = btn.closest("[data-spotnowbox]")?.querySelector("[data-spotnowout]") || btn.parentElement;
    btn.disabled = true; const t = btn.textContent; btn.textContent = "Checking Spotify…";
    try {
      const p = await call("get_currently_playing", undefined, { cache: false });
      const it = findPlaying(p);
      if (!it) { out.innerHTML = `<span class="qmeta">Nothing is playing on Spotify right now. Start a song and tap again.</span>`; return; }
      const names = (it.creators || it.artists || [it.artist]).map((c) => (typeof c === "string" ? c : c?.name)).filter(Boolean);
      const hitId = names.map(idFor).find(Boolean);
      const ctx = C();
      out.innerHTML = `<span class="spot-now"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span><b>${esc(it.name)}</b> · ${esc(names.join(", "))}</span>${it.url ? `<a class="ghost small" href="${esc(it.url)}" target="_blank" rel="noopener">Open in Spotify</a>` : ""}${hitId ? `<button class="solid" data-tree="artist" data-id="${hitId}">See ${esc(ctx.A[hitId].name)}'s family tree</button>` : `<span class="qmeta">${esc(names[0] || "This artist")} isn't on the map yet.</span>`}</span>`;
    } catch (e) { out.innerHTML = `<span class="qmeta">${esc(errText(e))}</span>`; }
    finally { btn.disabled = false; btn.textContent = t; }
  }

  /* ---------- save a playlist ---------- */
  function deepFind(o, re, d = 0) {
    if (!o || d > 6) return null;
    if (typeof o === "string") return re.test(o) ? o : null;
    if (typeof o !== "object") return null;
    for (const v of Object.values(o)) { const f = deepFind(v, re, d + 1); if (f) return f; }
    return null;
  }
  async function savePlaylist(btn) {
    const title = btn.dataset.title || "Sound Lineage";
    let lines;
    if (btn.dataset.songs) lines = JSON.parse(btn.dataset.songs);
    else {
      const A = C().A;
      lines = JSON.parse(btn.dataset.spotsave).map((id) => A[id]).filter(Boolean).map((a) => `${a.songs?.[0] || a.keyAlbums?.[0]?.[0] || "a signature song"} by ${a.name}`);
    }
    const out = btn.closest("[data-spotbox]")?.querySelector("[data-spotout]") || btn.parentElement;
    btn.disabled = true; const t = btn.textContent; btn.textContent = "Building playlist…";
    try {
      const prompt = `Create a playlist called "${title}" with exactly these songs, in this order: ${lines.join("; ")}.`;
      const p = await call("generate_playlist", { prompt, language: LANG }, { cache: false });
      const link = deepFind(p, /^https:\/\/open\.spotify\.com\/playlist\//);
      const note = deepFind(p, /PREMIUM|NOT_SUBSCRIBED/i);
      out.innerHTML = note ? `<span class="qmeta">${esc(errText({ result: note }))}</span>`
        : link ? `<span class="spot-ok">✓ Playlist saved to your Spotify. <a href="${esc(link)}" target="_blank" rel="noopener">Open it</a></span>`
        : `<span class="spot-ok">✓ Spotify built the playlist. Look for “${esc(title)}” in your library.</span>`;
      btn.textContent = "Saved";
      return;
    } catch (e) {
      out.innerHTML = `<span class="qmeta">${esc(errText(e))}${e?.code === "server_unavailable" || e?.code === "upstream_error" ? " Check your Spotify library before trying again, in case it was already made." : ""}</span>`;
    }
    btn.disabled = false; btn.textContent = t;
  }

  /* ---------- follow + similar (artist panel) ---------- */
  async function findArtist(name) {
    const known = get()?.artists.find((x) => x.name.toLowerCase() === name.toLowerCase() && x.uri);
    if (known) return known;
    const p = await call("search", { prompt: name, language: LANG, limit: 5 }, { cache: { staleTime: 300000 } });
    const ents = entities(p).filter((e) => e.entity_type === "CREATOR" || /artist/.test(e.uri || ""));
    return ents.find((e) => C().norm(e.name) === C().norm(name)) || ents[0] || null;
  }
  async function follow(btn) {
    const name = btn.dataset.spotfollow, out = btn.parentElement.parentElement.querySelector("[data-spotpanelout]");
    btn.disabled = true; btn.textContent = "Following…";
    try {
      const a = await findArtist(name);
      if (!a?.uri || !/^spotify:artist:/.test(a.uri)) { out.innerHTML = `<span class="qmeta">Couldn't find ${esc(name)} on Spotify.</span>`; btn.disabled = false; btn.textContent = "Follow on Spotify"; return; }
      await call("save_to_library", { uri: a.uri }, { cache: false });
      btn.textContent = "✓ Following";
    } catch (e) { out.innerHTML = `<span class="qmeta">${esc(errText(e))}</span>`; btn.disabled = false; btn.textContent = "Follow on Spotify"; }
  }
  async function similar(btn) {
    const name = btn.dataset.spotsimilar, out = btn.parentElement.parentElement.querySelector("[data-spotpanelout]");
    btn.disabled = true; btn.textContent = "Asking Spotify…";
    try {
      const p = await call("search", { prompt: `artists similar to ${name}`, language: LANG, limit: 12 }, { cache: { staleTime: 300000 } });
      const ents = entities(p).filter((e) => e.entity_type === "CREATOR" || /artist/.test(e.uri || "")).filter((e) => C().norm(e.name) !== C().norm(name));
      const ctx = C();
      out.innerHTML = ents.length ? `<p class="qmeta" style="margin:0">Spotify's listeners also play these. Dots mark artists on the map; open them to see if there's a real lineage.</p><div class="chips">${ents.map((e) => { const id = idFor(e.name); return id ? ctx.chip(id) : `<a class="ghost small" href="${esc(e.url || "#")}" target="_blank" rel="noopener">${esc(e.name)} ↗</a>`; }).join("")}</div>` : `<span class="qmeta">Spotify didn't return similar artists.</span>`;
      btn.hidden = true;
    } catch (e) { out.innerHTML = `<span class="qmeta">${esc(errText(e))}</span>`; btn.disabled = false; btn.textContent = "Spotify's similar artists"; }
  }

  /* ---------- UI snippets other modules drop in ---------- */
  function saveBtn(attrs) { return available === false ? "" : `<button class="spot-btn" ${attrs}><span class="sp" aria-hidden="true"></span>Save to Spotify</button>`; }
  function panelHTML(a) {
    if (available === false) return "";
    return `<div class="p-sec"><h3>On Spotify</h3><div class="gbtns"><button class="spot-btn" data-spotfollow="${esc(a.name)}"><span class="sp" aria-hidden="true"></span>Follow on Spotify</button><button class="ghost small" data-spotsimilar="${esc(a.name)}">Spotify's similar artists</button></div><div class="chips" data-spotpanelout></div></div>`;
  }
  function nowHTML() {
    if (available === false) return "";
    return `<div class="spot-strip" data-spotnowbox><button class="spot-btn" data-spotnow><span class="sp" aria-hidden="true"></span>What am I playing?</button><span data-spotnowout class="qmeta">Find the song playing on your Spotify and jump into its family tree.</span></div>`;
  }
  function cardHTML() {
    const s = get();
    if (available === false) return `<div class="conn"><span class="st soon">Open in Claude</span><b>Live Spotify</b><p class="qmeta" style="margin:0">Live Spotify works when this page is open in Claude with the Spotify connector added. The file import works everywhere.</p></div>`;
    const ctx = C();
    return `<div class="conn spot-card">
      <span class="st ${s ? "ok" : ""}">${s ? `✓ Synced ${new Date(s.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Live"}</span>
      <b>Spotify</b>
      ${s ? `<p class="qmeta" style="margin:0">${s.artists.length} artists from your top artists, most played and recent tracks. ${s.artists.filter((a) => a.id).length} are on the map.</p>
        <div class="chips">${s.artists.filter((a) => a.id).slice(0, 10).map((a) => ctx.chip(a.id)).join("")}</div>`
        : `<p class="qmeta" style="margin:0">Read your top artists and listening from your connected Spotify account. Nothing is posted or changed.</p>`}
      <div class="gbtns"><button class="spot-btn" data-spotsync><span class="sp" aria-hidden="true"></span>${s ? "Refresh from Spotify" : "Sync with Spotify"}</button>${s ? `<button class="ghost small" data-spotclear>Disconnect here</button>` : ""}</div>
      <p class="qmeta" data-spotmsg style="margin:0"></p>
    </div>`;
  }
  function refreshUI(changed) {
    if (!changed) return;
    const v = C()?.store.get("sl.view", "");
    if (["you", "today"].includes(v)) C().go(v);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-spotsync],[data-spotclear],[data-spotnow],[data-spotsave],[data-spotfollow],[data-spotsimilar]");
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (t.matches("[data-spotsync]")) sync(false);
    else if (t.matches("[data-spotclear]")) { C().store.del("sl.spot"); refreshUI(true); }
    else if (t.matches("[data-spotnow]")) nowPlaying(t);
    else if (t.matches("[data-spotsave]")) savePlaylist(t);
    else if (t.matches("[data-spotfollow]")) follow(t);
    else if (t.matches("[data-spotsimilar]")) similar(t);
  }, true);

  window.SL_SPOT = { ids, urlFor, saveBtn, panelHTML, nowHTML, cardHTML, get, get available() { return available; } };
})();
