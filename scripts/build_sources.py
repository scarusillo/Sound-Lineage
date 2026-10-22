"""Compile sourcing results (data/sources/out/*.jsonl) into data/sources.json for the app.
Keeps supports/partial; lists contradicts for review; reports coverage."""
import json, glob, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out, review, verdicts = {}, [], collections.Counter()
for p in sorted(glob.glob(os.path.join(ROOT, "data", "sources", "out", "*.jsonl"))):
    for line in open(p):
        line = line.strip()
        if not line: continue
        try: r = json.loads(line)
        except Exception: continue
        v = r.get("verdict", "none"); verdicts[v] += 1
        if v in ("supports", "partial") and str(r.get("url", "")).startswith("http"):
            out[f"{r['src']}>{r['tgt']}"] = {"u": r["url"], "t": r.get("title", ""), "p": r.get("publisher", ""), "n": r.get("note", ""), "v": v[0]}
        elif v == "contradicts": review.append(r)
json.dump(out, open(os.path.join(ROOT, "site", "data", "sources.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(review, open(os.path.join(ROOT, "data", "sources", "review.json"), "w"), ensure_ascii=False, indent=1)
print("sourced links:", len(out), "verdicts:", dict(verdicts), "to review:", len(review))
