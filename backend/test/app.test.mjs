import test from "node:test";
import assert from "node:assert/strict";
import { makeApp } from "../src/app.mjs";
import { memoryStore } from "./memory.mjs";

const ev = (sub, method, path, body, q, extra = {}) => ({ rawPath: path, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub, name: sub.toUpperCase(), ...extra } } } }, body: body ? JSON.stringify(body) : null, queryStringParameters: q });
const call = async (app, ...a) => { const r = await app(ev(...a)); return { status: r.statusCode, body: JSON.parse(r.body) }; };

test("sign-in required", async () => {
  const app = makeApp(memoryStore());
  const r = await app({ rawPath: "/me", requestContext: { http: { method: "GET" } } });
  assert.equal(r.statusCode, 401);
});

test("me is created on first visit and only the owner can write it", async () => {
  const app = makeApp(memoryStore());
  const me = await call(app, "alex", "GET", "/me");
  assert.equal(me.status, 200); assert.equal(me.body.id, "alex"); assert.equal(me.body.name, "ALEX");
  const put = await call(app, "alex", "PUT", "/me", { ...me.body, id: "someone-else", name: "Alex", logs: [{ id: "l1", key: "radiohead::ok-computer", title: "OK Computer", artist: "radiohead", rating: 9, at: "2026-10-25T10:00:00Z" }] });
  assert.equal(put.body.id, "alex", "id is forced to the signed-in user");
  assert.equal((await call(app, "alex", "GET", "/me")).body.logs.length, 1);
});

test("follow, like and comment create notifications and reaction indexes", async () => {
  const app = makeApp(memoryStore());
  const a = (await call(app, "alex", "PUT", "/me", { name: "Alex", logs: [{ id: "l1", title: "OK Computer" }] })).body;
  const s = (await call(app, "scott", "GET", "/me")).body;
  s.follows = ["alex"];
  s.reacts = [{ id: "r1", t: "like", target: "alex/l1", at: "2026-10-25T11:00:00Z" }, { id: "r2", t: "comment", target: "alex/l1", text: "Lucky is the one", at: "2026-10-25T11:01:00Z" }];
  await call(app, "scott", "PUT", "/me", s);
  const inbox = (await call(app, "alex", "GET", "/inbox")).body.items;
  assert.deepEqual(inbox.map((i) => i.t).sort(), ["comment", "follow", "like"]);
  const reacts = (await call(app, "alex", "GET", "/reactions", null, { target: "alex/l1" })).body.items;
  assert.equal(reacts.length, 2);
  // unliking removes it from the index
  s.reacts = s.reacts.filter((r) => r.id !== "r1");
  await call(app, "scott", "PUT", "/me", s);
  assert.equal((await call(app, "alex", "GET", "/reactions", null, { target: "alex/l1" })).body.items.length, 1);
  // following again does not notify twice
  await call(app, "scott", "PUT", "/me", s);
  assert.equal((await call(app, "alex", "GET", "/inbox")).body.items.filter((i) => i.t === "follow").length, 1);
  assert.equal(a.id, "alex");
});

test("people: directory, follows, search and private profiles", async () => {
  const app = makeApp(memoryStore());
  await call(app, "alex", "PUT", "/me", { name: "Alex" });
  await call(app, "pat", "PUT", "/me", { name: "Pat", private: true, follows: [] });
  await call(app, "scott", "PUT", "/me", { name: "Scott", follows: ["alex", "pat"] });
  let ppl = (await call(app, "scott", "GET", "/people")).body.people.map((p) => p.id);
  assert.ok(ppl.includes("alex")); assert.ok(!ppl.includes("pat"), "private until they follow back"); assert.ok(!ppl.includes("scott"));
  await call(app, "pat", "PUT", "/me", { name: "Pat", private: true, follows: ["scott"] });
  ppl = (await call(app, "scott", "GET", "/people", null, { ids: "pat,alex" })).body.people.map((p) => p.id);
  assert.deepEqual(ppl.sort(), ["alex", "pat"]);
  const found = (await call(app, "scott", "GET", "/people", null, { q: "al" })).body.people.map((p) => p.id);
  assert.deepEqual(found, ["alex"]);
});

test("clubs: creator edits, others cannot", async () => {
  const app = makeApp(memoryStore());
  assert.equal((await call(app, "alex", "PUT", "/clubs/jazz1", { name: "Sunday Jazz", picks: [] })).status, 200);
  assert.equal((await call(app, "scott", "PUT", "/clubs/jazz1", { name: "Hijacked" })).status, 403);
  assert.equal((await call(app, "scott", "GET", "/clubs")).body.clubs[0].name, "Sunday Jazz");
});

test("site settings are admin only; oversize diaries are refused", async () => {
  const app = makeApp(memoryStore());
  assert.equal((await call(app, "alex", "PUT", "/site", { featured: ["alex"] })).status, 403);
  assert.equal((await call(app, "scott", "PUT", "/site", { featured: ["alex"] }, null, { "cognito:groups": "[admin]" })).status, 200);
  assert.deepEqual((await call(app, "alex", "GET", "/site")).body.featured, ["alex"]);
  const huge = { logs: Array.from({ length: 600 }, (_, i) => ({ id: "l" + i, text: "x".repeat(1900) })) };
  const r = await call(app, "alex", "PUT", "/me", huge);
  assert.equal(r.status, 413);
});
