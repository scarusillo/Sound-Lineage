"""Weekly Lineage Mix: given the artists you listen to, pick ~12 songs that walk your taste backward and forward.
  3 roots (artists who shaped yours), 4 heirs (artists your artists shaped), 2 across-genre cousins,
  2 deep cuts (newer, lesser-known heirs), 1 wildcard from a scene you play. Rotates every ISO week.
Usage: python3 weekly_mix.py artists.json "The Beatles" "Kanye West" ... [--week 2026-W44]
Prints JSON: {"week": ..., "title": ..., "picks": [{"artist","song","kind","because"}]}"""
import json, sys, datetime, random, unicodedata, re

def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("&", " and ").replace("$", "s"); s = re.sub(r"^the\s+", "", s); s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)

def build(data, names, week=None):
    A = {a["id"]: a for a in data["artists"]}
    up, down = {i: [] for i in A}, {i: [] for i in A}
    for a in data["artists"]:
        for e in a["influencedBy"]:
            if e["id"] in A: up[a["id"]].append(e); down[e["id"]].append({"id": a["id"], "s": e["s"], "why": e["why"]})
    idx = {}
    for a in data["artists"]:
        idx.setdefault(norm(a["name"]), a["id"])
        lead = re.split(r" (?:&|and) the ", a["name"], flags=re.I)[0]
        idx.setdefault(norm(lead), a["id"])
    mine = []
    for n in names:
        i = idx.get(norm(n))
        if i and i not in mine: mine.append(i)
    week = week or datetime.date.today().strftime("%G-W%V")
    rnd = random.Random(week + "|" + ",".join(sorted(mine)))
    have = set(mine); used = set()
    def song(i): return (A[i].get("songs") or [""])[0]
    def pool(kind):
        out = []
        for rank, m in enumerate(mine):
            w = max(1, 30 - rank)
            if kind == "root":
                for e in up[m]:
                    if e["id"] not in have and A[e["id"]].get("role", "artist") == "artist": out.append((w * e["s"], e["id"], f"{A[e['id']]['name']} shaped {A[m]['name']}"))
            elif kind in ("heir", "deep"):
                for e in down[m]:
                    a = A[e["id"]]
                    if e["id"] in have or a.get("role", "artist") != "artist": continue
                    if kind == "deep" and (a["decade"] not in ("2000s", "2010s", "2020s") or len(down[e["id"]]) > 3): continue
                    out.append((w * e["s"], e["id"], f"{A[m]['name']} shaped them"))
            elif kind == "cousin":
                for c in A[m].get("cousins", []):
                    if c["id"] in A and c["id"] not in have: out.append((w * 2, c["id"], f"the {A[c['id']]['family']} cousin of {A[m]['name']}"))
        agg = {}
        for sc, i, why in out:
            if i not in agg or sc > agg[i][0]: agg[i] = (sc + agg.get(i, (0,))[0] * 0.5, why)
        ranked = sorted(agg.items(), key=lambda kv: -kv[1][0])[:25]
        rnd.shuffle(ranked)  # weekly variety among the strongest candidates
        return [(i, why) for i, (sc, why) in sorted(ranked[:12], key=lambda kv: -kv[1][0])]
    picks = []
    for kind, n in (("root", 3), ("heir", 4), ("cousin", 2), ("deep", 2)):
        got = 0
        for i, why in pool(kind):
            if got >= n: break
            if i in used or not song(i): continue
            used.add(i); got += 1
            picks.append({"artist": A[i]["name"], "id": i, "song": song(i), "kind": kind, "because": why})
    order = {"root": 0, "heir": 1, "deep": 2, "cousin": 3}
    picks.sort(key=lambda p: order[p["kind"]])
    monday = datetime.date.fromisocalendar(int(week[:4]), int(week[6:]), 1)
    return {"week": week, "title": f"Lineage Mix · {monday.strftime('%b %-d')}", "matched": [A[m]["name"] for m in mine], "picks": picks}

if __name__ == "__main__":
    args = sys.argv[1:]
    week = None
    if "--week" in args: k = args.index("--week"); week = args[k + 1]; args = args[:k] + args[k + 2:]
    data = json.load(open(args[0]))
    print(json.dumps(build(data, args[1:], week), indent=1, ensure_ascii=False))
