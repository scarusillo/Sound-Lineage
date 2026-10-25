// Sound Lineage API. Pure request handling over a small storage interface, so it runs on DynamoDB in Lambda
// and on an in-memory store in tests. Every user owns exactly one "person" record; the server makes sure you
// can only write your own, keeps reaction and notification indexes, and enforces private profiles.
//
// Items:  USER#<id>/PROFILE (person doc)          GSI1: DIR / <lowercase name>
//         USER#<id>/NOTE#<iso>#<rand> (notification for that user)
//         TARGET#<target>/REACT#<uid>#<reactId> (likes and comments on a log, list or club week)
//         CLUB#<id>/CLUB                           GSI1: CLUBS / <iso>
//         SITE/MAIN (featured curators, hidden content; admins only)

const CAP = { logs: 600, reacts: 800, want: 300, lists: 40, follows: 2000, clubs: 100, blocked: 500 };
const MAX_BYTES = 350_000; // DynamoDB items top out at 400 KB
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const str = (v, n) => String(v ?? "").slice(0, n);
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const ownerOf = (target) => { const m = String(target).match(/^(?:list:)?([^/:]+)\//); return m ? m[1] : null; };
const blank = (id, name = "") => ({ v: 1, id, name, handle: "", bio: "", fav4: [], logs: [], want: [], follows: [], lists: [], reacts: [], clubs: [], goal: { year: new Date().getFullYear(), n: 52 }, digs: {}, blocked: [], private: false, updated: new Date().toISOString() });

export function clean(doc, id) {
  const d = { ...blank(id), ...(doc && typeof doc === "object" ? doc : {}) };
  const out = {
    v: 1, id, name: str(d.name, 40), handle: str(d.handle, 24).toLowerCase().replace(/[^a-z0-9_]/g, ""), bio: str(d.bio, 200),
    fav4: arr(d.fav4, 4), logs: arr(d.logs, CAP.logs), want: arr(d.want, CAP.want), follows: arr(d.follows, CAP.follows).map((x) => str(x, 80)),
    lists: arr(d.lists, CAP.lists), reacts: arr(d.reacts, CAP.reacts).filter((r) => r && ["like", "comment", "report"].includes(r.t)).map((r) => ({ id: str(r.id, 40), t: r.t, target: str(r.target, 200), text: str(r.text, 1000), at: str(r.at, 40) })),
    clubs: arr(d.clubs, CAP.clubs).map((x) => str(x, 60)), goal: { year: +d.goal?.year || new Date().getFullYear(), n: Math.max(1, Math.min(1000, +d.goal?.n || 52)) },
    digs: d.digs && typeof d.digs === "object" ? d.digs : {}, blocked: arr(d.blocked, CAP.blocked).map((x) => str(x, 80)), private: !!d.private, updated: new Date().toISOString(),
  };
  if (JSON.stringify(out).length > MAX_BYTES) throw Object.assign(new Error("Your diary is too large to save. Remove some old entries."), { status: 413 });
  return out;
}

export function makeApp(db) {
  const getDoc = async (id) => (await db.get(`USER#${id}`, "PROFILE"))?.doc || null;
  const canSee = (doc, viewer) => doc && (!doc.private || doc.id === viewer || (doc.follows || []).includes(viewer));
  const note = (to, from, t, extra = {}) => { const at = new Date().toISOString(); return db.put({ PK: `USER#${to}`, SK: `NOTE#${at}#${Math.random().toString(36).slice(2, 8)}`, t, uid: from, at, ...extra }); };

  async function getMe(user) {
    let doc = await getDoc(user.sub);
    if (!doc) { doc = blank(user.sub, str(user.name || (user.email || "").split("@")[0], 40)); await saveDoc(doc); }
    return doc;
  }
  async function saveDoc(doc) {
    await db.put({ PK: `USER#${doc.id}`, SK: "PROFILE", doc, GSI1PK: doc.private ? "DIR_PRIVATE" : "DIR", GSI1SK: (doc.name || doc.handle || "~").toLowerCase() + "#" + doc.id });
  }
  async function putMe(user, body) {
    const prev = (await getDoc(user.sub)) || blank(user.sub);
    const doc = clean(body, user.sub);
    // reactions: keep the by-target index in step and notify whoever owns the target
    const before = new Map(prev.reacts.map((r) => [r.id, r])), after = new Map(doc.reacts.map((r) => [r.id, r]));
    for (const [id, r] of after) if (!before.has(id)) {
      if (r.t !== "report") await db.put({ PK: `TARGET#${r.target}`, SK: `REACT#${user.sub}#${id}`, uid: user.sub, ...r });
      const owner = ownerOf(r.target);
      if (owner && owner !== user.sub && r.t !== "report") await note(owner, user.sub, r.t, { target: r.target, text: r.text });
      if (r.t === "report") await db.put({ PK: "SITE", SK: `REPORT#${r.at}#${id}`, uid: user.sub, target: r.target, at: r.at });
    }
    for (const [id, r] of before) if (!after.has(id) && r.t !== "report") await db.del(`TARGET#${r.target}`, `REACT#${user.sub}#${id}`);
    for (const f of doc.follows) if (!prev.follows.includes(f) && f !== user.sub) await note(f, user.sub, "follow");
    await saveDoc(doc);
    return doc;
  }
  async function people(user, q) {
    const me = await getMe(user), out = new Map();
    const add = (d) => { if (d && canSee(d, user.sub) && !me.blocked.includes(d.id)) out.set(d.id, d); };
    if (q.ids) { for (const d of await db.batchDocs(String(q.ids).split(",").slice(0, 100).map((i) => `USER#${i}`))) add(d); }
    else if (q.q) { const t = String(q.q).toLowerCase().slice(0, 40); for (const it of await db.query("DIR", t, { index: "GSI1", limit: 50 })) add(it.doc); }
    else {
      for (const d of await db.batchDocs(me.follows.slice(0, 100).map((i) => `USER#${i}`))) add(d);
      for (const it of await db.query("DIR", "", { index: "GSI1", limit: 100 })) add(it.doc);
    }
    out.delete(user.sub);
    return { people: [...out.values()] };
  }
  async function site() { return (await db.get("SITE", "MAIN"))?.site || { featured: [], hidden: [] }; }

  return async function handle(event) {
    const method = event.requestContext?.http?.method || event.httpMethod, path = (event.rawPath || event.path || "").replace(/\/+$/, "");
    const claims = event.requestContext?.authorizer?.jwt?.claims || {};
    const user = { sub: claims.sub, name: claims.name, email: claims.email, admin: String(claims["cognito:groups"] || "").includes("admin") };
    if (!user.sub) return json(401, { error: "Sign in first." });
    const q = event.queryStringParameters || {};
    let body = null;
    try { body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body) : null; } catch { return json(400, { error: "That request wasn't valid JSON." }); }
    try {
      if (method === "GET" && path === "/me") return json(200, await getMe(user));
      if (method === "PUT" && path === "/me") return json(200, await putMe(user, body));
      if (method === "GET" && path === "/people") return json(200, await people(user, q));
      if (method === "GET" && path === "/reactions") { const items = await db.query(`TARGET#${str(q.target, 200)}`, "REACT#"); return json(200, { items: items.map(({ PK, SK, ...r }) => r) }); }
      if (method === "GET" && path === "/inbox") { const items = await db.query(`USER#${user.sub}`, "NOTE#", { desc: true, limit: 100 }); return json(200, { items: items.map(({ PK, SK, ...r }) => r) }); }
      if (method === "GET" && path === "/clubs") { const items = await db.query("CLUBS", "", { index: "GSI1", limit: 200 }); return json(200, { clubs: items.map((i) => i.club) }); }
      const cm = path.match(/^\/clubs\/([A-Za-z0-9_-]{1,40})$/);
      if (method === "PUT" && cm) {
        const prev = (await db.get(`CLUB#${cm[1]}`, "CLUB"))?.club;
        if (prev && prev.owner !== user.sub && !user.admin) return json(403, { error: "Only the club's creator can change it." });
        const club = { id: cm[1], name: str(body?.name, 60), desc: str(body?.desc, 400), owner: prev?.owner || user.sub, picks: arr(body?.picks, 60), at: prev?.at || new Date().toISOString() };
        if (!club.name) return json(400, { error: "A club needs a name." });
        await db.put({ PK: `CLUB#${club.id}`, SK: "CLUB", club, GSI1PK: "CLUBS", GSI1SK: club.at });
        return json(200, club);
      }
      if (method === "GET" && path === "/site") return json(200, await site());
      if (method === "PUT" && path === "/site") {
        if (!user.admin) return json(403, { error: "Only admins can change featured curators or hidden posts." });
        const s = { featured: arr(body?.featured, 200).map((x) => str(x, 80)), hidden: arr(body?.hidden, 5000).map((x) => str(x, 200)) };
        await db.put({ PK: "SITE", SK: "MAIN", site: s });
        return json(200, s);
      }
      return json(404, { error: "Not found." });
    } catch (e) {
      return json(e.status || 500, { error: e.status ? e.message : "Something went wrong on our side. Try again." });
    }
  };
}
