"""Weekly: find new albums, EPs and singles from artists on the map, using Apple's public iTunes Search API.
Writes site/data/releases.json. Runs on GitHub Actions every Friday."""
import json, time, re, sys, unicodedata, urllib.request, urllib.parse, datetime

def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("&", " and "); s = re.sub(r"^the\s+", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)

data = json.load(open("site/data/artists.json"))
arts = [a for a in data["artists"] if not a.get("role") and data["decades"].index(a["decade"]) >= 7]
try:
    ext = json.load(open("site/data/artists_ext.json"))
    arts += [a for a in ext["artists"] if data["decades"].index(a["decade"]) >= 9 and len(a.get("influencedBy", [])) >= 1][:600]
except FileNotFoundError:
    pass
today = datetime.date.today(); cutoff = today - datetime.timedelta(days=120)
items, n = [], 0
for a in arts:
    n += 1
    url = "https://itunes.apple.com/search?" + urllib.parse.urlencode({"term": a["name"], "entity": "album", "attribute": "artistTerm", "limit": 25})
    for t in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "SoundLineage/1.0"}), timeout=30) as r:
                res = json.load(r).get("results", [])
            break
        except Exception as e:
            res = []; time.sleep(20 * (t + 1))
    seen = set()
    for x in res:
        if norm(x.get("artistName", "")) != norm(a["name"]): continue
        d = (x.get("releaseDate") or "")[:10]
        if not d or d < cutoff.isoformat() or d > (today + datetime.timedelta(days=30)).isoformat(): continue
        title = re.sub(r"\s*-\s*(Single|EP)$", "", x.get("collectionName", ""))
        if norm(title) in seen: continue
        seen.add(norm(title))
        kind = "Single" if x.get("collectionName", "").endswith("- Single") else "EP" if x.get("collectionName", "").endswith("- EP") else "Album"
        items.append({"id": a["id"], "title": title, "date": d, "kind": kind, "art": (x.get("artworkUrl100") or "").replace("100x100bb", "300x300bb"), "url": x.get("collectionViewUrl")})
    if n % 50 == 0: print(n, len(items), file=sys.stderr)
    time.sleep(3.2)
items.sort(key=lambda r: r["date"], reverse=True)
json.dump({"updated": today.isoformat(), "items": items}, open("site/data/releases.json", "w"), ensure_ascii=False)
print("releases", len(items), file=sys.stderr)
