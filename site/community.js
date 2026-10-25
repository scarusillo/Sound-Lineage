/* Community data layer. Every user is one "person" record: profile, diary (logs), want-to-hear shelf, Four Favorites,
   follows, lists, reactions (likes, comments, reports, club posts), clubs, goal and weekly digs.
   Three interchangeable backends:
   - local:  this browser only (public site until accounts launch); export/import moves the diary to an account later
   - claude: Claude's shared database, so everyone the page is shared with is a real member today
   - aws:    the Sound Lineage API (Cognito sign-in, DynamoDB) once window.SL_CONFIG.api is set
   Feeds, notifications and counts are computed from person records, so the UI is the same on all three. */
(() => {
  "use strict";
  const C = () => window.SL;
  const now = () => new Date().toISOString();
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const blank = (id) => ({ v: 1, id, name: "", handle: "", bio: "", fav4: [], logs: [], want: [], follows: [], lists: [], reacts: [], clubs: [], goal: { year: new Date().getFullYear(), n: 52 }, digs: {}, blocked: [], private: false, updated: now() });
  const CAP = { logs: 600, reacts: 800, want: 300, lists: 40 };
  function trim(doc) {
    doc.logs = doc.logs.slice(0, CAP.logs); doc.reacts = doc.reacts.slice(0, CAP.reacts); doc.want = doc.want.slice(0, CAP.want); doc.lists = doc.lists.slice(0, CAP.lists);
    return doc;
  }
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } } };

  /* ---------- backends ---------- */
  const local = {
    kind: "local", social: false,
    async init() { const me = store.get("sl.me", null) || blank("me"); if (!me.id) me.id = "me"; return me; },
    async saveMe(doc) { store.set("sl.me", doc); },
    async people() { return {}; },
    async clubs() { return store.get("sl.clubs", {}); },
    async saveClub(c) { const all = store.get("sl.clubs", {}); all[c.id] = c; store.set("sl.clubs", all); },
    async site() { return { featured: [], hidden: [] }; },
    async names() { return {}; },
  };

  const claude = {
    kind: "claude", social: true, db: null, user: null,
    async init() {
      const [db, user] = await Promise.all([window.claude.use("db").catch(() => null), window.claude.use("user").catch(() => null)]);
      if (!db || !user) return null;
      const id = await user.id(); if (!id) return null;
      this.db = db; this.user = user; this.owner = user.isOwner?.() ?? false;
      const snap = await db.doc(`people/${id}`).get().catch(() => null);
      const data = snap?.exists ? snap.data() : null;
      return data ? { ...blank(id), ...data, id } : blank(id);
    },
    async saveMe(doc) { await this.db.doc(`people/${doc.id}`).set(JSON.parse(JSON.stringify(trim(doc)))); },
    async people() {
      const snap = await this.db.collection("people").limit(1000).get().catch(() => null);
      const out = {}; snap?.docs.forEach((d) => { const v = d.data(); if (v) out[d.id] = { ...blank(d.id), ...v, id: d.id }; });
      return out;
    },
    async clubs() { const s = await this.db.collection("clubs").limit(500).get().catch(() => null); const o = {}; s?.docs.forEach((d) => (o[d.id] = { ...d.data(), id: d.id })); return o; },
    async saveClub(c) { await this.db.doc(`clubs/${c.id}`).set(JSON.parse(JSON.stringify(c))); },
    async site() { const s = await this.db.doc("site/main").get().catch(() => null); const v = s?.exists ? s.data() : {}; return { featured: v.featured || [], hidden: v.hidden || [] }; },
    async saveSite(v) { await this.db.doc("site/main").set(v); },
    async names(ids) { const ps = await this.user.profiles(ids).catch(() => ({})); const o = {}; for (const id of ids) o[id] = ps[id]?.name || ""; return o; },
  };

  /* AWS: Cognito hosted sign-in (authorization code + PKCE), then the REST API from backend/ */
  const aws = {
    kind: "aws", social: true,
    cfg: () => window.SL_CONFIG || {},
    token() { const t = store.get("sl.auth", null); return t && t.exp > Date.now() / 1000 + 30 ? t.id : null; },
    async api(path, opts = {}) {
      const r = await fetch(this.cfg().api + path, { ...opts, headers: { "content-type": "application/json", authorization: `Bearer ${this.token()}`, ...(opts.headers || {}) } });
      if (r.status === 401) { store.set("sl.auth", null); throw new Error("signin"); }
      if (!r.ok) throw new Error(`api ${r.status}`);
      return r.status === 204 ? null : r.json();
    },
    async signIn() {
      const c = this.cfg(), ver = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const dig = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ver)));
      const chal = btoa(String.fromCharCode(...dig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      sessionStorage.setItem("sl.pkce", ver);
      location.href = `${c.authDomain}/oauth2/authorize?response_type=code&client_id=${c.clientId}&redirect_uri=${encodeURIComponent(c.redirect)}&scope=openid+email+profile&code_challenge_method=S256&code_challenge=${chal}`;
    },
    async finishSignIn() {
      const q = new URLSearchParams(location.search), code = q.get("code"), ver = sessionStorage.getItem("sl.pkce");
      if (!code || !ver) return;
      const c = this.cfg();
      const r = await fetch(`${c.authDomain}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: c.clientId, code, redirect_uri: c.redirect, code_verifier: ver }) });
      const t = await r.json();
      if (t.id_token) { const p = JSON.parse(atob(t.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); store.set("sl.auth", { id: t.id_token, exp: p.exp, sub: p.sub, admin: String(p["cognito:groups"] || "").includes("admin") }); }
      sessionStorage.removeItem("sl.pkce"); history.replaceState(null, "", location.pathname + "#profile");
    },
    signOut() { store.set("sl.auth", null); location.reload(); },
    async init() {
      await this.finishSignIn().catch(() => {});
      if (!this.token()) return null;
      const me = await this.api("/me");
      this.owner = !!store.get("sl.auth", {}).admin;
      return { ...blank(me.id), ...me };
    },
    async saveMe(doc) { await this.api("/me", { method: "PUT", body: JSON.stringify(trim(doc)) }); },
    async people(ids) { const r = await this.api(`/people${ids ? `?ids=${ids.join(",")}` : ""}`); const o = {}; for (const p of r.people) o[p.id] = { ...blank(p.id), ...p }; return o; },
    async search(q) { return (await this.api(`/people?q=${encodeURIComponent(q)}`)).people; },
    async inbox() { return (await this.api("/inbox")).items; },
    async reactions(target) { return (await this.api(`/reactions?target=${encodeURIComponent(target)}`)).items; },
    async clubs() { const r = await this.api("/clubs"); const o = {}; for (const c of r.clubs) o[c.id] = c; return o; },
    async saveClub(c) { await this.api(`/clubs/${c.id}`, { method: "PUT", body: JSON.stringify(c) }); },
    async site() { return this.api("/site").catch(() => ({ featured: [], hidden: [] })); },
    async saveSite(v) { await this.api("/site", { method: "PUT", body: JSON.stringify(v) }); },
    async names() { return {}; },
  };

  /* ---------- state ---------- */
  const S = { backend: local, me: null, people: {}, clubs: {}, site: { featured: [], hidden: [] }, names: {}, ready: null, listeners: new Set() };
  const emit = () => S.listeners.forEach((f) => { try { f(); } catch { /* listener error */ } });
  async function init() {
    if (S.ready) return S.ready;
    S.ready = (async () => {
      let me = null;
      if (window.SL_CONFIG?.api) { S.backend = aws; me = await aws.init().catch(() => null); if (!me) { S.signedOut = true; S.backend = local; me = await local.init(); } }
      else if (window.claude?.use) { me = await claude.init().catch(() => null); if (me) S.backend = claude; }
      if (!me) { S.backend = local; me = await local.init(); }
      S.me = me;
      if (S.backend !== local) {
        // first sign-in on a device that already has a local diary: bring it along
        const old = store.get("sl.me", null);
        if (old?.logs?.length && !store.get("sl.migrated", false) && !me.logs.length) { Object.assign(me, { logs: old.logs, want: old.want, fav4: old.fav4, lists: old.lists, goal: old.goal, digs: old.digs, name: me.name || old.name, bio: me.bio || old.bio }); await save(); store.set("sl.migrated", true); }
      }
      await refresh();
      return S;
    })();
    return S.ready;
  }
  async function refresh() {
    const B = S.backend;
    const [people, clubs, site] = await Promise.all([B.people().catch(() => ({})), B.clubs().catch(() => ({})), B.site().catch(() => ({ featured: [], hidden: [] }))]);
    if (S.me) people[S.me.id] = S.me;
    if (B.inbox) S.remoteInbox = await B.inbox().catch(() => null);
    S.people = people; S.clubs = clubs; S.site = site;
    const ids = Object.keys(people);
    if (B.names) S.names = { ...S.names, ...(await B.names(ids).catch(() => ({}))) };
    emit();
  }
  let saveT = null, saveP = null;
  function save() {
    S.me.updated = now(); trim(S.me);
    clearTimeout(saveT);
    return (saveP = new Promise((res) => { saveT = setTimeout(async () => { try { await S.backend.saveMe(S.me); } catch (e) { C()?.toast?.(e.message === "signin" ? "Sign in again to save." : "Couldn't save just now. Your change is kept on this device."); store.set("sl.me.pending", S.me); } res(); emit(); }, 250); }));
  }

  /* ---------- helpers ---------- */
  const nameOf = (uid) => { const p = S.people[uid]; return p?.name || S.names[uid] || (uid === S.me?.id ? "You" : "A member"); };
  const handleOf = (uid) => S.people[uid]?.handle || "";
  const isHidden = (target, uid) => S.site.hidden.includes(target) || (uid && S.me?.blocked?.includes(uid));
  const visible = (p) => p && (!p.private || p.id === S.me.id || (p.follows || []).includes(S.me.id));
  function reactionsOn(target) {
    const out = [];
    for (const p of Object.values(S.people)) for (const r of p.reacts || []) if (r.target === target && !isHidden(`${p.id}/${r.id}`, p.id)) out.push({ ...r, uid: p.id });
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }
  const likes = (target) => reactionsOn(target).filter((r) => r.t === "like");
  const comments = (target) => reactionsOn(target).filter((r) => r.t === "comment");
  const liked = (target) => (S.me.reacts || []).some((r) => r.t === "like" && r.target === target);

  /* ---------- actions ---------- */
  function logAlbum(a, { rating = 0, text = "", date, re = false } = {}) {
    const entry = { id: rid(), key: a.key, title: a.title, artist: a.artist, artistName: a.artistName, year: a.year || null, rating, text: String(text).slice(0, 2000), date: date || new Date().toISOString().slice(0, 10), re, at: now() };
    S.me.logs.unshift(entry);
    S.me.want = S.me.want.filter((w) => w.key !== a.key);
    const wk = window.SL_MIX?.isoWeek(); const dig = S.me.digs?.[wk];
    if (dig && dig.key === a.key) dig.done = true;
    save(); return entry;
  }
  function editLog(id, patch) { const l = S.me.logs.find((x) => x.id === id); if (l) { Object.assign(l, patch); save(); } }
  function deleteLog(id) { S.me.logs = S.me.logs.filter((x) => x.id !== id); S.me.reacts = S.me.reacts.filter((r) => !r.target.endsWith(`/${id}`)); save(); }
  function toggleWant(a) { const has = S.me.want.some((w) => w.key === a.key); S.me.want = has ? S.me.want.filter((w) => w.key !== a.key) : [{ key: a.key, title: a.title, artist: a.artist, artistName: a.artistName, year: a.year || null, at: now() }, ...S.me.want]; save(); return !has; }
  function setFav(slot, a) { const f = [...(S.me.fav4 || [])]; while (f.length < 4) f.push(null); f[slot] = a ? { key: a.key, title: a.title, artist: a.artist, artistName: a.artistName, year: a.year || null } : null; S.me.fav4 = f; save(); }
  function follow(uid) { const on = !S.me.follows.includes(uid); S.me.follows = on ? [...S.me.follows, uid] : S.me.follows.filter((x) => x !== uid); save(); return on; }
  function react(t, target, text = "") {
    if (t === "like") { if (liked(target)) { S.me.reacts = S.me.reacts.filter((r) => !(r.t === "like" && r.target === target)); save(); return false; } }
    S.me.reacts.unshift({ id: rid(), t, target, text: String(text).slice(0, 1000), at: now() });
    save(); return true;
  }
  function unreact(id) { S.me.reacts = S.me.reacts.filter((r) => r.id !== id); save(); }
  function saveList(list) { const i = S.me.lists.findIndex((l) => l.id === list.id); if (i >= 0) S.me.lists[i] = list; else S.me.lists.unshift({ ...list, id: list.id || rid(), at: now() }); save(); }
  function deleteList(id) { S.me.lists = S.me.lists.filter((l) => l.id !== id); save(); }
  function joinClub(id) { const on = !S.me.clubs.includes(id); S.me.clubs = on ? [...S.me.clubs, id] : S.me.clubs.filter((x) => x !== id); save(); return on; }
  async function createClub({ name, desc }) { const c = { id: rid(), name: String(name).slice(0, 60), desc: String(desc || "").slice(0, 400), owner: S.me.id, picks: [], at: now() }; S.clubs[c.id] = c; await S.backend.saveClub(c); joinClub(c.id); return c; }
  async function setClubPick(id, week, album) {
    const c = S.clubs[id]; if (!c) return;
    c.picks = (c.picks || []).filter((p) => p.week !== week); c.picks.push({ week, key: album.key, title: album.title, artist: album.artist, artistName: album.artistName, year: album.year || null });
    c.picks = c.picks.slice(-60); await S.backend.saveClub(c); emit();
  }

  /* ---------- derived: feed and notifications ---------- */
  function feed(limit = 60) {
    const out = [];
    for (const uid of S.me.follows || []) {
      const p = S.people[uid]; if (!visible(p) || isHidden("", uid)) continue;
      for (const l of p.logs || []) if (!isHidden(`${uid}/${l.id}`)) out.push({ kind: "log", uid, at: l.at, item: l });
      for (const L of p.lists || []) out.push({ kind: "list", uid, at: L.at, item: L });
      for (const r of p.reacts || []) if (r.t === "comment" && !r.target.startsWith("club:")) out.push({ kind: "comment", uid, at: r.at, item: r });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }
  function inbox() {
    if (S.remoteInbox) return S.remoteInbox.filter((x) => !isHidden("", x.uid)).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    const me = S.me.id, out = [];
    for (const p of Object.values(S.people)) {
      if (p.id === me || isHidden("", p.id)) continue;
      if ((p.follows || []).includes(me)) out.push({ t: "follow", uid: p.id, at: p.updated || "" });
      for (const r of p.reacts || []) {
        if (r.target.startsWith(`${me}/`) || r.target.startsWith(`list:${me}/`)) out.push({ t: r.t, uid: p.id, at: r.at, target: r.target, text: r.text });
      }
    }
    return out.filter((x) => x.t !== "report").sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  }
  const unread = () => { const seen = store.get("sl.inboxSeen", ""); return inbox().filter((x) => (x.at || "") > seen).length; };
  const markRead = () => store.set("sl.inboxSeen", now());
  /* what members think of an album or artist */
  function albumStats(key) { const rs = []; for (const p of Object.values(S.people)) for (const l of p.logs || []) if (l.key === key && l.rating) rs.push(l.rating); return { n: rs.length, avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length / 2 : 0 }; }
  function artistStats(id) { let n = 0; const who = new Set(); for (const p of Object.values(S.people)) for (const l of p.logs || []) if (l.artist === id) { n++; who.add(p.id); } return { logs: n, people: who.size }; }

  window.SL_COMM = {
    S, init, refresh, save, rid, nameOf, handleOf, visible, isHidden,
    logAlbum, editLog, deleteLog, toggleWant, setFav, follow, react, unreact, saveList, deleteList, joinClub, createClub, setClubPick,
    reactionsOn, likes, comments, liked, feed, inbox, unread, markRead, albumStats, artistStats,
    on: (f) => { S.listeners.add(f); return () => S.listeners.delete(f); },
    get me() { return S.me; }, get backend() { return S.backend; }, aws, claude, local,
    exportDiary: () => JSON.stringify({ v: 1, exported: now(), me: S.me }, null, 1),
    importDiary(text) { const d = JSON.parse(text); const m = d.me || d; if (!Array.isArray(m.logs)) throw new Error("not a diary"); const keep = new Set(S.me.logs.map((l) => l.id)); S.me.logs = [...S.me.logs, ...m.logs.filter((l) => !keep.has(l.id))].sort((a, b) => b.at.localeCompare(a.at)); S.me.want = [...S.me.want, ...(m.want || []).filter((w) => !S.me.want.some((x) => x.key === w.key))]; if (!S.me.fav4?.some(Boolean)) S.me.fav4 = m.fav4 || []; save(); },
  };
})();
