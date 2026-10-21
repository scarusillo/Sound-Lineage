"""Merge research parts into the app's data files. Drops unknown ids, self-links, forward-in-time artist links,
duplicate edges; reports gaps. Run: python3 build/merge.py"""
import json, glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
FAMS = [
    ("blues", "Blues & Gospel", "Blues"), ("jazz", "Jazz", "Jazz"), ("country", "Country", "Country"),
    ("folk", "Folk & Songwriters", "Folk"), ("rock", "Rock", "Rock"), ("alt", "Punk & Alternative", "Alt"),
    ("metal", "Metal", "Metal"), ("soul", "Soul, R&B & Funk", "Soul"), ("pop", "Pop", "Pop"),
    ("hiphop", "Hip-Hop", "Hip-Hop"), ("electronic", "Electronic", "Electronic"), ("reggae", "Reggae & Ska", "Reggae"),
    ("latin", "Latin & Global", "Global"),
]
DECADES = [f"{y}s" for y in range(1900, 2030, 10)]
master = {}
for line in open(os.path.join(D, "master.txt")):
    if line.startswith("#") or not line.strip(): continue
    i, n, d, f = line.strip().split("|")
    master[i] = {"id": i, "name": n, "decade": d, "family": f}

def clean(s):
    if not isinstance(s, str): return s
    return s.replace(" — ", ", ").replace("—", ", ").strip()

parts = {}
for p in sorted(glob.glob(os.path.join(D, "parts", "artists-*.json"))):
    try:
        arr = json.load(open(p))
    except Exception as e:
        print("BAD", p, e); continue
    if isinstance(arr, dict): arr = arr.get("artists", [])
    for a in arr:
        if a.get("id") in master: parts[a["id"]] = a
        else: print("unknown artist id in", os.path.basename(p), a.get("id"))

di = {d: i for i, d in enumerate(DECADES)}
out, missing, dropped = [], [], 0
for i, m in master.items():
    a = parts.get(i)
    if not a: missing.append(i); a = {}
    rec = dict(m)
    for k in ("years", "origin", "summary", "born"):
        if a.get(k): rec[k] = clean(a[k])
    rec["genres"] = [clean(g) for g in a.get("genres", [])][:4]
    rec["know"] = [clean(k) for k in a.get("know", [])][:4]
    rec["keyAlbums"] = [[clean(t[0]), t[1] if len(t) > 1 else None] for t in a.get("keyAlbums", []) if t][:5]
    rec["songs"] = [clean(s) for s in a.get("songs", [])][:5]
    if rec.get("born") and not re.fullmatch(r"\d\d-\d\d", str(rec["born"])): rec.pop("born")
    seen, ib = set(), []
    for e in a.get("influencedBy", []):
        t = e.get("id")
        if t not in master or t == i or t in seen: dropped += 1; continue
        if di[master[t]["decade"]] > di[m["decade"]] + 1: dropped += 1; continue  # influence can't come from far later
        seen.add(t); ib.append({"id": t, "why": clean(e.get("why", "")), "s": int(e.get("s", 2)) if str(e.get("s", 2)).isdigit() else 2})
    rec["influencedBy"] = ib
    cs, cous = set(), []
    for c in a.get("cousins", []):
        t = c.get("id")
        if t in master and t != i and t not in cs and master[t]["family"] != m["family"]:
            cs.add(t); cous.append({"id": t, "why": clean(c.get("why", ""))})
    rec["cousins"] = cous[:4]
    out.append(rec)

json.dump({"families": [{"id": a, "name": b, "short": c} for a, b, c in FAMS], "decades": DECADES, "artists": out},
          open(os.path.join(ROOT, "site", "data", "artists.json"), "w"), ensure_ascii=False, separators=(",", ":"))
edges = sum(len(a["influencedBy"]) for a in out)
print(f"artists {len(out)}  researched {len(parts)}  missing {len(missing)}  edges {edges}  dropped {dropped}")
if missing: print("missing:", " ".join(missing))

# albums
ap = os.path.join(D, "parts", "albums.json")
if os.path.exists(ap):
    al = json.load(open(ap)); al = al.get("albums", al)
    ids = {x["id"]: x for x in al if x.get("artist") in master}
    keep = []
    bad = 0
    for x in ids.values():
        x["title"] = clean(x["title"]); x["summary"] = clean(x.get("summary", "")); x["sub"] = clean(x.get("sub", ""))
        if x.get("released") and not re.fullmatch(r"\d{4}-\d\d-\d\d", str(x["released"])): x["released"] = None
        ib = []
        for e in x.get("influencedBy", []):
            t = ids.get(e.get("id"))
            if not t or t["id"] == x["id"] or t["year"] > x["year"]: bad += 1; continue
            ib.append({"id": t["id"], "why": clean(e.get("why", ""))})
        x["influencedBy"] = ib
        x["cousins"] = [{"id": c["id"], "why": clean(c.get("why", ""))} for c in x.get("cousins", []) if c.get("id") in ids and c["id"] != x["id"]][:3]
        keep.append(x)
    keep.sort(key=lambda x: x["year"])
    json.dump({"albums": keep}, open(os.path.join(ROOT, "site", "data", "albums.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"albums {len(keep)} edges {sum(len(x['influencedBy']) for x in keep)} dropped {bad}")
else:
    print("albums: MISSING part")

sp = os.path.join(D, "parts", "samples.json")
if os.path.exists(sp):
    s = json.load(open(sp))
    songs = {}
    for x in s["songs"]:
        if x.get("artist") and x["artist"] not in master: x["artistName"] = x.get("artistName") or x["artist"]; x["artist"] = None
        if not x.get("artistName") and x.get("artist"): x["artistName"] = master[x["artist"]]["name"]
        x["title"] = clean(x["title"]); songs[x["id"]] = x
    ed = [dict(e, what=clean(e.get("what", ""))) for e in s["edges"] if e.get("from") in songs and e.get("to") in songs and e["from"] != e["to"]]
    json.dump({"songs": list(songs.values()), "edges": ed}, open(os.path.join(ROOT, "site", "data", "samples.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"songs {len(songs)} edges {len(ed)}")
else:
    print("samples: MISSING part")

jp = os.path.join(D, "parts", "journeys.json")
if os.path.exists(jp):
    j = json.load(open(jp)); j = j.get("journeys", j)
    for x in j:
        x["blurb"] = clean(x.get("blurb", ""))
        x["steps"] = [dict(st, note=clean(st.get("note", "")), ask=clean(st.get("ask", "")), title=clean(st.get("title", ""))) for st in x["steps"] if st.get("artist") in master]
    json.dump({"journeys": j}, open(os.path.join(ROOT, "site", "data", "journeys.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"journeys {len(j)} steps {sum(len(x['steps']) for x in j)}")
else:
    print("journeys: MISSING part")
