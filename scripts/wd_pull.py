"""Pull musician influence links from Wikidata (runs on GitHub Actions, which can reach the internet).
Every artist in the output has a MusicBrainz ID, so the set stays limited to musicians and bands.
Writes raw/wd.json: {"edges": [[a, b, [urls]]], "items": {qid: {...}}}, where a was influenced by b."""
import json, time, sys, os, urllib.request, urllib.parse
os.makedirs("raw", exist_ok=True)
LOG = open("raw/log.txt", "a")
def log(*a): print(*a, file=sys.stderr); print(*a, file=LOG); LOG.flush()

UA = "SoundLineage/1.0 (https://github.com/scarusillo/Sound-Lineage)"
EP = "https://query.wikidata.org/sparql"

def q(sparql, tries=4):
    body = urllib.parse.urlencode({"query": sparql, "format": "json"}).encode()
    for t in range(tries):
        try:
            req = urllib.request.Request(EP, data=body, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as e:
            log("retry", t, str(e)[:200]); time.sleep(5 * (t + 1))
    log("query failed"); raise SystemExit("query failed")

qid = lambda u: u.rsplit("/", 1)[-1]
v = lambda row, k: row[k]["value"] if k in row else None

# 1. influence edges between musicians (simple query; references fetched per batch below)
edges = {}
rows = q("""SELECT ?a ?b WHERE { ?a wdt:P737 ?b . ?a wdt:P434 [] . ?b wdt:P434 [] . }""")
for r in rows:
    k = (qid(v(r, "a")), qid(v(r, "b")))
    if k[0] != k[1]: edges[k] = set()
log("edges", len(edges))
srcs = sorted({a for a, _ in edges})
for i in range(0, len(srcs), 200):
    vals = " ".join("wd:" + x for x in srcs[i:i + 200])
    try:
        rows = q(f"""SELECT ?a ?b ?url WHERE {{ VALUES ?a {{ {vals} }} ?a p:P737 ?st . ?st ps:P737 ?b . ?st prov:wasDerivedFrom/pr:P854 ?url . }}""", tries=3)
    except SystemExit:
        log("refs batch failed", i); continue
    for r in rows:
        k = (qid(v(r, "a")), qid(v(r, "b")))
        if k in edges: edges[k].add(v(r, "url"))
log("refs done", sum(1 for u in edges.values() if u))
ids = sorted({x for k in edges for x in k})
log("items", len(ids))

# 2. facts for every artist involved, through the entity API (50 per request; no query timeouts)
API = "https://www.wikidata.org/w/api.php"
def ents(qids, props):
    out = {}
    for i in range(0, len(qids), 50):
        url = API + "?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": props, "languages": "en", "sitefilter": "enwiki", "format": "json"})
        for t in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                    out.update(json.load(r).get("entities", {})); break
            except Exception as e:
                log("api retry", t, str(e)[:120]); time.sleep(3 * (t + 1))
        time.sleep(0.3)
    return out
def claim_vals(e, p):
    vals = []
    for c in e.get("claims", {}).get(p, []):
        dv = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if dv is None: continue
        if isinstance(dv, dict) and "id" in dv: vals.append(dv["id"])
        elif isinstance(dv, dict) and "time" in dv: vals.append(dv["time"].lstrip("+"))
        elif isinstance(dv, dict) and "latitude" in dv: vals.append(f"Point({dv['longitude']} {dv['latitude']})")
        else: vals.append(dv)
    return vals
E1 = ents(ids, "labels|descriptions|claims|sitelinks")
log("entities", len(E1))
refs = set()
for e in E1.values():
    for p in ("P136", "P740", "P19"): refs.update(claim_vals(e, p)[:6])
E2 = ents(sorted(refs), "labels|claims")
log("genres and places", len(E2))
lab = lambda q: E2.get(q, {}).get("labels", {}).get("en", {}).get("value")
items = {}
for q, e in E1.items():
    if "missing" in e: continue
    first = lambda p: (claim_vals(e, p) or [None])[0]
    it = {"label": e.get("labels", {}).get("en", {}).get("value"), "desc": e.get("descriptions", {}).get("en", {}).get("value"),
          "mbid": first("P434"), "article": ("https://en.wikipedia.org/wiki/" + e["sitelinks"]["enwiki"]["title"].replace(" ", "_")) if e.get("sitelinks", {}).get("enwiki") else None,
          "birth": first("P569"), "incep": first("P571"), "start": first("P2031"), "death": first("P570"), "end": first("P576") or first("P2032"),
          "genres": [g for g in (lab(x) for x in claim_vals(e, "P136")) if g], "place": None}
    if "Q5" not in claim_vals(e, "P31"): it["group"] = True
    for kind, p in (("form", "P740"), ("birth", "P19")):
        pl = first(p)
        if pl and pl in E2 and not it["place"]:
            pe = E2[pl]; c = (claim_vals(pe, "P17") or [None])[0]
            it["place"] = {"name": lab(pl), "country": None, "coord": (claim_vals(pe, "P625") or [None])[0], "kind": kind, "cq": c}
    items[q] = it
cq = sorted({it["place"]["cq"] for it in items.values() if it["place"] and it["place"].get("cq")})
E3 = ents(cq, "labels")
for it in items.values():
    if it["place"]:
        c = it["place"].pop("cq", None)
        it["place"]["country"] = E3.get(c, {}).get("labels", {}).get("en", {}).get("value") if c else None
log("facts", len(items))

os.makedirs("raw", exist_ok=True)
json.dump({"edges": [[a, b, sorted(u)] for (a, b), u in edges.items()], "items": items}, open("raw/wd.json", "w"))
log("done")
