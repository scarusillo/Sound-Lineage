# Sourcing influence links

Each line of your batch file (tab separated) is one link: source_id, Source name, target_id, Target name, our claim.
It means: Source influenced Target, for the reason in "our claim".

For each link, find ONE real, public web page that supports it: an interview where the target names the source, a biography,
a reputable article (Rolling Stone, Pitchfork, NPR, The Guardian, AllMusic, BBC, Billboard, Wikipedia with a cited claim, etc.).

How:
- Use WebSearch with focused queries like `"Kurt Cobain" Pixies influence interview` or `Jimmy Page Muddy Waters influence`.
- Only use a URL that actually appears in your search results (or that you fetched). Never build or guess a URL.
- Prefer pages that state the connection directly. Wikipedia is acceptable when the article states the influence.
- If the evidence contradicts our claim, mark it. If you find nothing solid after two searches, mark it "none". Do not stretch.

Write results as JSON lines (one object per line) to your output file, appending as you go so nothing is lost:
{"src":"<source_id>","tgt":"<target_id>","url":"https://...","title":"Page title","publisher":"Rolling Stone","note":"short phrase of what the page says, under 20 words","verdict":"supports"}
verdict is one of: supports | partial | contradicts | none   (for none, url/title can be empty).

Work through every line. Reply at the end with counts by verdict only.
