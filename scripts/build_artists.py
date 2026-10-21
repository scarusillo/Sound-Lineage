"""Wave-2 merge: old research parts + wave-2 research → data/artists.json (1,500+ artists).
Adds roles (producer/session), folds each artist's 'influenced' list into the target's influences,
drops unknown ids, self-links, duplicates and links that run backwards in time."""
import json, glob, os, re, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data"); W = os.path.join(D, "wave2")
FAMS = [("blues","Blues & Gospel","Blues"),("jazz","Jazz","Jazz"),("country","Country","Country"),("folk","Folk & Songwriters","Folk"),
  ("rock","Rock","Rock"),("alt","Punk & Alternative","Alt"),("metal","Metal","Metal"),("soul","Soul, R&B & Funk","Soul"),("pop","Pop","Pop"),
  ("hiphop","Hip-Hop","Hip-Hop"),("electronic","Electronic","Electronic"),("reggae","Reggae & Ska","Reggae"),("latin","Latin","Latin"),("global","Global","Global")]
DECADES = [f"{y}s" for y in range(1900, 2030, 10)]; di = {d: i for i, d in enumerate(DECADES)}
master = {}
for line in open(os.path.join(W, "all.txt")):
    if line.startswith("#") or not line.strip(): continue
    i, n, d, f, r = line.strip().split("|")[:5]
    master[i] = {"id": i, "name": n, "decade": d, "family": f, "role": r}
# duplicates folded into one record, and entries left out on purpose
ALIAS = {"coxsone-dodd-2": "coxsone-dodd", "puff-daddy-2": "puff-daddy", "the-swampers": "muscle-shoals-rhythm-section"}
DROP = {"burzum"}
for k in list(ALIAS) + list(DROP): master.pop(k, None)
canon = lambda i: ALIAS.get(i, i)
clean = lambda s: s.replace(" — ", ", ").replace("—", ", ").strip() if isinstance(s, str) else s
parts = {}
srcs = sorted(glob.glob(os.path.join(D, "parts", "artists-*.json"))) + sorted(glob.glob(os.path.join(W, "out", "*.json")))
for p in srcs:
    try: arr = json.load(open(p))
    except Exception as e: print("BAD FILE", p, e); continue
    if isinstance(arr, dict): arr = arr.get("artists", [])
    for a in arr:
        if not isinstance(a, dict): continue
        cid = canon(a.get("id"))
        if cid not in master: continue
        if cid in parts:  # fold a duplicate: keep the first record, add its links
            for k in ("influencedBy", "influenced", "cousins"): parts[cid].setdefault(k, []).extend(a.get(k, []) or [])
            for k in ("summary", "origin", "years", "genres", "know", "keyAlbums", "songs"):
                if not parts[cid].get(k) and a.get(k): parts[cid][k] = a[k]
        else: parts[cid] = dict(a, id=cid)
edges = collections.defaultdict(dict)  # target -> source -> {why,s}
dropped = collections.Counter()
def add(src, tgt, why, s):
    src, tgt = canon(src), canon(tgt)
    if src not in master or tgt not in master: dropped["unknown id"] += 1; return
    if src == tgt: dropped["self"] += 1; return
    if master[src]["role"] == "artist" and di[master[src]["decade"]] > di[master[tgt]["decade"]] + 1: dropped["backwards in time"] += 1; return
    try: s = int(s)
    except Exception: s = 2
    s = max(1, min(3, s))
    if src in edges[tgt]:
        if s > edges[tgt][src]["s"]: edges[tgt][src] = {"why": clean(why or edges[tgt][src]["why"]), "s": s}
        dropped["duplicate"] += 1; return
    edges[tgt][src] = {"why": clean(why or ""), "s": s}
for i, a in parts.items():
    for e in a.get("influencedBy", []) or []: add(e.get("id"), i, e.get("why"), e.get("s", 2))
    for e in a.get("influenced", []) or []: add(i, e.get("id"), e.get("why"), e.get("s", 2))
# real production / session credits that run "backwards" in time (a newer producer on an older artist's record)
EXTRA = [
 ("dave-cobb", "john-prine", "Produced his final album, The Tree of Forgiveness (2018).", 3),
 ("aaron-dessner", "taylor-swift", "Co-wrote and produced much of folklore and evermore (2020).", 3),
 ("aaron-dessner", "bon-iver", "Makes records with Justin Vernon as Big Red Machine.", 3),
 ("arca", "bjork", "Co-produced Vulnicura and Utopia.", 3),
 ("thundercat", "erykah-badu", "Played bass on New Amerykah.", 2),
 ("luther-vandross", "aretha-franklin", "Produced her 1982 comeback album Jump to It.", 3),
 ("jerry-reed", "elvis-presley", "Elvis cut Reed's Guitar Man in 1967 with Reed playing on it.", 3),
 ("glen-campbell", "frank-sinatra", "Played guitar on Strangers in the Night as a Wrecking Crew session player.", 2),
 ("diplo", "madonna", "Produced tracks on Rebel Heart (2015).", 2),
 ("sophie", "madonna", "Co-produced a single on Rebel Heart (2015).", 2),
]
for s_, t_, w_, k_ in EXTRA:
    if s_ in master and t_ in master and s_ not in edges[t_]: edges[t_][s_] = {"why": w_, "s": k_}
    elif s_ not in master or t_ not in master: print("EXTRA skipped (unknown id):", s_, t_)
out, missing = [], []
for i, m in master.items():
    a = parts.get(i)
    if not a: missing.append(i); a = {}
    rec = {k: m[k] for k in ("id", "name", "decade", "family")}
    if m["role"] != "artist": rec["role"] = m["role"]
    for k in ("years", "origin", "summary"):
        if a.get(k): rec[k] = clean(a[k])
    if a.get("born") and re.fullmatch(r"\d\d-\d\d", str(a["born"])): rec["born"] = a["born"]
    rec["genres"] = [clean(g) for g in a.get("genres", []) if isinstance(g, str)][:4]
    rec["know"] = [clean(k) for k in a.get("know", []) if isinstance(k, str)][:4]
    rec["keyAlbums"] = [[clean(t[0]), t[1] if len(t) > 1 else None] for t in a.get("keyAlbums", []) if isinstance(t, list) and t][:5]
    rec["songs"] = [clean(s) for s in a.get("songs", []) if isinstance(s, str)][:5]
    rec["influencedBy"] = [{"id": s, **v} for s, v in edges[i].items()]
    cs, cous = set(), []
    for c in a.get("cousins", []) or []:
        t = canon(c.get("id"))
        if t in master and t != i and t not in cs and master[t]["family"] != m["family"]: cs.add(t); cous.append({"id": t, "why": clean(c.get("why", ""))})
    rec["cousins"] = cous[:4]
    out.append(rec)
json.dump({"families": [{"id": a, "name": b, "short": c} for a, b, c in FAMS], "decades": DECADES, "artists": out},
          open(os.path.join(ROOT, "site", "data", "artists.json"), "w"), ensure_ascii=False, separators=(",", ":"))
deg = collections.Counter()
for r in out:
    for e in r["influencedBy"]: deg[r["id"]] += 1; deg[e["id"]] += 1
lonely = [r["id"] for r in out if deg[r["id"]] == 0]
print(f"artists {len(out)}  researched {len(parts)}  missing {len(missing)}  edges {sum(len(r['influencedBy']) for r in out)}")
print("dropped:", dict(dropped))
print("no links at all:", len(lonely), lonely[:20])
print("roles:", collections.Counter(r.get("role", "artist") for r in out))
if missing: print("missing:", len(missing), missing[:30])
