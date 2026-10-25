// Local test server: the real API handler over the in-memory store. Trusts the token's claims without checking
// signatures, so it is for local testing only (API Gateway verifies tokens in production).
import http from "node:http";
import { makeApp } from "../src/app.mjs";
import { memoryStore } from "./memory.mjs";
const app = makeApp(memoryStore());
http.createServer(async (req, res) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, PUT, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
  let body = ""; for await (const c of req) body += c;
  const u = new URL(req.url, "http://x"), tok = (req.headers.authorization || "").replace("Bearer ", "");
  let claims = {}; try { claims = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()); } catch { /* no token */ }
  const r = await app({ rawPath: u.pathname, queryStringParameters: Object.fromEntries(u.searchParams), body: body || null, requestContext: { http: { method: req.method }, authorizer: { jwt: { claims } } } });
  res.writeHead(r.statusCode, { ...cors, ...r.headers }); res.end(r.body);
}).listen(process.env.PORT || 8790, () => console.log("api on", process.env.PORT || 8790));
