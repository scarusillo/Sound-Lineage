"""Merge the Wikidata pull (raw/wd.json) into Sound Lineage as an extended layer.
- Artists already curated keep their hand-written data; Wikidata only adds links between them that we lacked.
- New artists get a short profile from Wikidata (description, genres, years, origin) and are marked as such.
- Every Wikidata link carries a source: the reference URL on the statement when there is one, else the Wikidata entry.
Usage: python3 scripts/build_ext.py raw/wd.json site/data   -> artists_ext.json, sources_ext.json, geo.json (merged)"""
import json, re, sys, unicodedata
from collections import Counter, defaultdict
from urllib.parse import urlparse

raw = json.load(open(sys.argv[1])); out = sys.argv[2]
core = json.load(open(f"{out}/artists.json"))
DEC = core["decades"]
A = {a["id"]: a for a in core["artists"]}

def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("&", " and ").replace("$", "s"); s = re.sub(r"^the\s+", "", s); s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)
def slug(s):
    s = unicodedata.normalize("NFD", s.lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "artist"
def year(v):
    m = re.match(r"^(-?\d{4})", v or ""); return int(m.group(1)) if m else None

items, edges = raw["items"], raw["edges"]
deg = Counter()
for a, b, _ in edges: deg[a] += 1; deg[b] += 1

# 1. match Wikidata items to curated artists by name (ties go to the best-connected item)
byname = defaultdict(list)
for q, it in items.items():
    if it.get("label"): byname[norm(it["label"])].append(q)
q2id = {}
def keys_of(name):
    ks = {norm(name), norm(re.sub(r"\s*\(.*\)", "", name))}
    lead = re.split(r" (?:&|and) (?:the )?", name, flags=re.I)[0]
    if lead != name: ks.add(norm(lead))
    m = re.search(r"\(([^)]+)\)", name)
    if m: ks.add(norm(m.group(1)))
    return {k for k in ks if k}
curkey = {}
for a in core["artists"]:
    for k in keys_of(a["name"]): curkey.setdefault(k, a["id"])
for a in core["artists"]:
    keys = keys_of(a["name"])
    cands = [q for k in keys for q in byname.get(k, [])]
    if not cands: continue
    def plausible(q):
        it = items[q]; y = year(it.get("start")) or year(it.get("incep")) or ((year(it.get("birth")) or 0) + 20 if it.get("birth") else None)
        return y is None or abs(DEC.index(a["decade"]) * 10 + 1900 - y) <= 35
    cands = [q for q in cands if plausible(q)]
    if cands: q2id[max(cands, key=lambda q: deg[q])] = a["id"]

for q, it in items.items():
    if q not in q2id and it.get("label") and norm(it["label"]) in curkey: q2id[q] = curkey[norm(it["label"])]
    elif q not in q2id and it.get("label") and slug(it["label"]) in A: q2id[q] = slug(it["label"])

# 2. genre families
RULES = [("metal", r"metal|doom|thrash|sludge|grindcore|djent|black metal|death metal"),
         ("hiphop", r"hip.?hop|\brap\b|trap music|grime|drill|boom bap|gangsta|turntablism"),
         ("electronic", r"electronic|techno|\bhouse\b|ambient|edm|trance|drum and bass|dubstep|idm|industrial|synth|electro|downtempo|trip hop|breakbeat|jungle|krautrock|electronica"),
         ("reggae", r"reggae|\bska\b|\bdub\b|dancehall|rocksteady"),
         ("latin", r"latin|salsa|bossa|samba|tango|reggaeton|cumbia|\bmpb\b|tropic|bolero|mariachi|ranchera|nueva|son cubano|merengue|bachata"),
         ("global", r"world music|afrobeat|afro|k-pop|j-pop|highlife|qawwali|flamenco|fado|chanson|bollywood|filmi|mbalax|soukous|juju|rai\b|arabic|turkish|indian|celtic|klezmer|gnawa|c-pop|mandopop|cantopop|enka"),
         ("blues", r"blues|gospel|spiritual"),
         ("jazz", r"jazz|swing|bebop|ragtime|big band|bop\b|dixieland|fusion"),
         ("country", r"country|bluegrass|americana|honky|western swing|outlaw|cowboy"),
         ("soul", r"soul|r&b|rhythm and blues|contemporary r|funk|disco|motown|doo.?wop|new jack|quiet storm"),
         ("alt", r"alternative|indie|punk|post-punk|new wave|grunge|shoegaze|emo\b|noise|garage|lo-fi|math rock|post-rock|dream pop|no wave|britpop|gothic"),
         ("folk", r"folk|singer-songwriter|acoustic|protest"),
         ("pop", r"\bpop\b|teen|dance-pop|bubblegum|schlager|easy listening|traditional pop|crooner|adult contemporary|vocal"),
         ("rock", r"rock|psychedelic|progressive|glam|rockabilly|surf|beat music|blues rock|hard rock")]
def family(genres):
    score = Counter()
    for i, g in enumerate(genres[:6]):
        for f, rx in RULES:
            if re.search(rx, g.lower()): score[f] += 6 - i; break
    return score.most_common(1)[0][0] if score else None

# 3. new artists
def decade_of(it):
    y = year(it.get("start")) or year(it.get("incep")) or ((year(it.get("birth")) + 21) if year(it.get("birth")) else None)
    if not y or y < 1890: return None
    y = min(max(y, 1900), 2029); return f"{y // 10 * 10}s"
MUSIC = re.compile(r"sing|music|band|rapper|\brap\b|compos|guitar|pian|drumm|\bdj\b|producer|songwriter|\bduo\b|trio|quartet|vocal|saxophon|trumpet|bass|orchestra|ensemble|record|\bmc\b|organist|violin|cellist|conductor|lyricist|percussion|keyboard|idol|group|hip hop|jazz|rock|pop|folk|blues|soul|metal|punk|reggae|country|electronic|crooner|chanteu|cantante", re.I)
def is_music(it):
    if MUSIC.search(it.get("desc") or ""): return True
    return any(re.search(rx, g.lower()) for g in it.get("genres", []) for _, rx in RULES)
used = set(A)
ext, q2ext, seen_name = [], {}, {}
for q in sorted(items, key=lambda q: -deg[q]):
    it = items[q]
    if q in q2id or not it.get("label") or re.match(r"^Q\d+$", it["label"]): continue
    if not is_music(it): continue
    if norm(it["label"]) in seen_name: q2ext[q] = seen_name[norm(it["label"])]; continue
    d = decade_of(it)
    if not d: continue
    sid = slug(it["label"]); base = sid; n = 2
    while sid in used: sid = f"{base}-{n}"; n += 1
    used.add(sid); q2ext[q] = sid; seen_name[norm(it["label"])] = sid
    b, s, e = year(it.get("birth")), year(it.get("start")) or year(it.get("incep")), year(it.get("end")) or year(it.get("death"))
    if it.get("group"): yrs = f"{s or '?'}–{e or 'present'}" if s else ""
    else: yrs = f"{b}–{e}" if b and e else (f"born {b}" if b else "")
    pl = it.get("place") or {}
    origin = ", ".join(x for x in [pl.get("name"), pl.get("country") if pl.get("country") not in (None, pl.get("name")) else None] if x)
    desc = (it.get("desc") or "").strip()
    summary = (desc[0].upper() + desc[1:] + ".") if desc and not desc.endswith(".") else desc
    ext.append({"id": sid, "q": q, "name": it["label"], "decade": d, "family": family(it.get("genres", [])), "years": yrs, "origin": origin,
                "genres": [g.lower() for g in it.get("genres", [])[:3]], "summary": summary, "wiki": it.get("article"), "mbid": it.get("mbid"),
                "influencedBy": [], "ext": 1, "_place": pl})
E = {a["id"]: a for a in ext}
idOf = lambda q: q2id.get(q) or q2ext.get(q)

# 4. links, each with a source
host = lambda u: urlparse(u).netloc.replace("www.", "")
PUB = {"rollingstone.com": "Rolling Stone", "theguardian.com": "The Guardian", "pitchfork.com": "Pitchfork", "allmusic.com": "AllMusic", "npr.org": "NPR", "bbc.co.uk": "BBC", "bbc.com": "BBC", "billboard.com": "Billboard", "nytimes.com": "The New York Times"}
src, extra = {}, []
nameOf = lambda i: (A.get(i) or E.get(i))["name"]
for qa, qb, urls in edges:
    a, b = idOf(qa), idOf(qb)
    if not a or not b or a == b: continue
    tgt = A.get(a) or E.get(a); frm = A.get(b) or E.get(b)
    if DEC.index(frm["decade"]) > DEC.index(tgt["decade"]) + 1: continue  # an influence can't come from much later
    good = [u for u in urls if host(u) and "wikidata" not in host(u)]
    if a in A and any(u["id"] == b for u in A[a]["influencedBy"]):
        if good: src[f"{b}>{a}"] = {"u": good[0], "p": PUB.get(host(good[0]), host(good[0])), "t": "", "v": "s"}  # a source for a link we already had
        continue
    why = f"{nameOf(a)} counts {nameOf(b)} among their influences."
    link = {"id": b, "why": why, "s": 2 if good else 1, "wd": 1}
    if a in E: E[a]["influencedBy"].append(link)
    else: extra.append({"to": a, **link})
    key = f"{b}>{a}"
    if good: src[key] = {"u": good[0], "p": PUB.get(host(good[0]), host(good[0])), "t": "", "v": "s"}
    else: src[key] = {"u": f"https://www.wikidata.org/wiki/{qa}#P737", "p": "Wikidata", "t": "Influenced by", "v": "p"}

# fill missing families from neighbours; drop artists left with no links at all
nbr = defaultdict(list)
for a in ext:
    for l in a["influencedBy"]: nbr[a["id"]].append(l["id"]); nbr[l["id"]].append(a["id"])
for l in extra: nbr[l["to"]].append(l["id"]); nbr[l["id"]].append(l["to"])
fam = lambda i: (A.get(i) or E.get(i) or {}).get("family")
for _ in range(3):
    for a in ext:
        if not a["family"]:
            c = Counter(f for f in (fam(x) for x in nbr[a["id"]]) if f)
            if c: a["family"] = c.most_common(1)[0][0]
for a in ext:
    a["family"] = a["family"] or "rock"
    if not a["summary"]: a["summary"] = f"{a['name']}, {a['genres'][0] if a['genres'] else 'musician'}."
keep = {a["id"] for a in ext if nbr[a["id"]]}
ext = [a for a in ext if a["id"] in keep]

# 5. geo for the city map
geo = json.load(open(f"{out}/geo.json"))
for a in ext:
    pl = a.pop("_place"); a.pop("q", None)
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", (pl or {}).get("coord") or "")
    if m and a["id"] not in geo: geo[a["id"]] = [round(float(m.group(2)), 3), round(float(m.group(1)), 3), pl.get("name"), (pl.get("country") or "")[:20]]

json.dump({"artists": ext, "links": extra}, open(f"{out}/artists_ext.json", "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(src, open(f"{out}/sources_ext.json", "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(geo, open(f"{out}/geo.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"matched {len(q2id)} curated, {len(ext)} new artists, {sum(len(a['influencedBy']) for a in ext)} new-artist links, {len(extra)} links added to curated artists, {sum(1 for v in src.values() if v['v'] == 's')} with a cited reference", file=sys.stderr)
print(Counter(a["family"] for a in ext).most_common(), file=sys.stderr)
print(Counter(a["decade"] for a in ext).most_common(), file=sys.stderr)
