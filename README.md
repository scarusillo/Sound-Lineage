# Sound Lineage

Live site: https://scarusillo.github.io/Sound-Lineage/

A music family tree from the 1900s to now. Click any artist to see who shaped them and who they shaped,
two generations deep, and keep going. Album lineages, song sample trails, a 3D influence map, daily picks,
games, listening journeys, and a For You page built from your own listening.

## Layout
- `site/` — the website (vanilla JS; d3 for the flat and city maps, 3d-force-graph for the 3D map, topojson for borders)
  - `app.js` shell, search, Browse, artist panel · `tree.js` family tree + connect two artists · `map.js` 3D and flat maps · `cities.js` city map
  - `today.js` Today and Journeys · `games.js` daily games · `you.js` For You · `spotify.js` live Spotify (works inside Claude)
  - `site/data/` — built data: `artists.json` (1,557 artists and producers, ~7,000 links), `geo.json`, `scenes.json`, `albums.json`, `samples.json`, `journeys.json`, `world.json` (Natural Earth borders)
- `data/master.txt` + `data/parts/` — wave 1 research (432 artists)
- `data/wave2/` — wave 2: candidate lists, the full id list `all.txt`, research output `out/*.json`, scene write-ups
- `scripts/build_artists.py` — merges both waves into `site/data/artists.json` (folds duplicates, drops impossible links, keeps producer credits)
- `scripts/geocode.js` — places each artist's origin with the GeoNames city database (`npm i all-the-cities`)

## Rebuild and run locally
    python3 scripts/build_artists.py
    npm i all-the-cities && node scripts/geocode.js site/data/artists.json > site/data/geo.json
    cd site && python3 -m http.server 8765

## Notes
- Live Spotify sync, "Save to Spotify" and the corrections inbox use Claude's connectors, so they work in the Claude-hosted
  version. On GitHub Pages those buttons hide themselves and the Spotify/Apple data-file import is used instead.
- Influence links come from artist interviews, biographies and music histories, graded 1–3 by how direct they are. They have not yet been individually sourced.
