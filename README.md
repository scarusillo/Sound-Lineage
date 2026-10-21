# Sound Lineage

Live site: https://scarusillo.github.io/Sound-Lineage/

A music family tree from the 1900s to now. Click any artist to see who shaped them and who they shaped,
two generations deep, and keep going. Album lineages, song sample trails, a 3D influence map, daily picks,
games, listening journeys, and a For You page built from your own listening.

## Layout
- `data/master.txt` — the closed list of artists (id | name | decade | genre family)
- `data/parts/*.json` — curated research, one file per genre slice (influences with reasons and a 1–3 strength, cross-genre cousins, albums, songs), plus `albums.json`, `samples.json`, `journeys.json`
- `scripts/build_data.py` — merges the parts, drops unknown ids and impossible links → `site/data/*.json`
- `site/` — the website (vanilla JS, d3 for the flat map, 3d-force-graph for the 3D map)
  - `app.js` shell, search, Browse, artist panel · `tree.js` family tree + connect two artists · `map.js` 3D/flat map
  - `today.js` Today and Journeys · `games.js` daily games · `you.js` For You · `spotify.js` live Spotify (works inside Claude)

## Rebuild and run locally
    python3 scripts/build_data.py
    cd site && python3 -m http.server 8765

## Notes
- Live Spotify sync, "Save to Spotify" and the corrections inbox use Claude's connectors, so they work in the Claude-hosted
  version. On GitHub Pages those buttons hide themselves and the Spotify/Apple data-file import is used instead.
- Influence links come from artist interviews, biographies and music histories. They have not yet been individually sourced.
