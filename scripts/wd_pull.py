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

# 2. facts for every artist involved, in batches
items = {}
def batch(lst, n):
    for i in range(0, len(lst), n): yield lst[i:i + n]
json.dump({"edges": [[a, b, sorted(u)] for (a, b), u in edges.items()]}, open("raw/wd_edges.json", "w"))
def facts(chunk):
    vals = " ".join("wd:" + x for x in chunk)
    rows = q(f"""SELECT ?i ?label ?desc ?mbid ?article ?birth ?incep ?start ?death ?end ?human WHERE {{
      VALUES ?i {{ {vals} }}
      OPTIONAL {{ ?i rdfs:label ?label FILTER(lang(?label)="en") }}
      OPTIONAL {{ ?i schema:description ?desc FILTER(lang(?desc)="en") }}
      OPTIONAL {{ ?i wdt:P434 ?mbid }}
      OPTIONAL {{ ?article schema:about ?i ; schema:isPartOf <https://en.wikipedia.org/> }}
      OPTIONAL {{ ?i wdt:P569 ?birth }} OPTIONAL {{ ?i wdt:P571 ?incep }} OPTIONAL {{ ?i wdt:P2031 ?start }}
      OPTIONAL {{ ?i wdt:P570 ?death }} OPTIONAL {{ ?i wdt:P576 ?end }} OPTIONAL {{ ?i wdt:P2032 ?stop }}
      BIND(EXISTS {{ ?i wdt:P31 wd:Q5 }} AS ?human)
    }}""")
    for r in rows:
        i = qid(v(r, "i")); it = items.setdefault(i, {"genres": [], "place": None})
        for k in ("label", "desc", "mbid", "article", "birth", "incep", "start", "death", "end"):
            if v(r, k) and not it.get(k): it[k] = v(r, k)
        if v(r, "human") == "false": it["group"] = True
    try: rows = q(f"""SELECT ?i ?g ?gl WHERE {{ VALUES ?i {{ {vals} }} ?i wdt:P136 ?g . ?g rdfs:label ?gl FILTER(lang(?gl)="en") }}""", tries=3)
    except SystemExit: rows = []
    for r in rows:
        it = items.setdefault(qid(v(r, "i")), {"genres": [], "place": None})
        if v(r, "gl") not in it["genres"]: it["genres"].append(v(r, "gl"))
    # where they came from: formation place for groups, birthplace for people, with coordinates
    try: rows = q(f"""SELECT ?i ?pl ?pll ?coord ?cl ?kind WHERE {{ VALUES ?i {{ {vals} }}
      {{ ?i wdt:P740 ?pl . BIND("form" AS ?kind) }} UNION {{ ?i wdt:P19 ?pl . BIND("birth" AS ?kind) }}
      ?pl rdfs:label ?pll FILTER(lang(?pll)="en")
      OPTIONAL {{ ?pl wdt:P625 ?coord }}
      OPTIONAL {{ ?pl wdt:P17 ?c . ?c rdfs:label ?cl FILTER(lang(?cl)="en") }} }}""", tries=3)
    except SystemExit: rows = []
    for r in rows:
        it = items.setdefault(qid(v(r, "i")), {"genres": [], "place": None})
        p = {"name": v(r, "pll"), "country": v(r, "cl"), "coord": v(r, "coord"), "kind": v(r, "kind")}
        if not it["place"] or (it["place"]["kind"] == "birth" and p["kind"] == "form"): it["place"] = p

for chunk in batch(ids, 120):
    try: facts(chunk)
    except SystemExit:
        for small in batch(chunk, 30):
            try: facts(small)
            except SystemExit: log("chunk skipped", small[0])
    log("facts", len(items)); time.sleep(1)

os.makedirs("raw", exist_ok=True)
json.dump({"edges": [[a, b, sorted(u)] for (a, b), u in edges.items()], "items": items}, open("raw/wd.json", "w"))
log("done")
