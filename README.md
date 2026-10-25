# Sound Lineage

Live site: https://scarusillo.github.io/Sound-Lineage/ (installable: “Add to Home Screen”)

A music family tree from the 1900s to now. Tap any artist to see who shaped them and who they shaped, hear the
lineage as 30-second previews, and keep going. Album lineages, song sample trails, a 3D influence map and a city map,
a weekly Lineage Mix, Lineage Wrapped, daily games, listening journeys, taste comparison with friends, and Ask the lineage.

## Layout
- `site/` — the app (vanilla JS; d3, 3d-force-graph, topojson from CDNs). Installable as a web app (`manifest.webmanifest`, `sw.js`).
  - `app.js` shell, routing, search, Browse, Behind the music, artist sheet · `tree.js` Lineage + connect two artists · `map.js` 3D and flat maps · `cities.js` city map
  - `today.js` Home and Journeys · `mix.js` weekly mix, adventurousness dial, archive · `player.js` previews (Apple iTunes Search API)
  - `share.js` share cards, 15-second videos, taste DNA, compare and blend · `wrapped.js` Lineage Wrapped · `social.js` Ask, new releases, live shows, fan links, Own it
  - `games.js` daily games · `you.js` You · `spotify.js` live Spotify (inside Claude)
  - `site/data/` — `artists.json` (curated core), `artists_ext.json` (wider set from Wikidata), `sources.json` + `sources_ext.json` (a source per link),
    `releases.json` (weekly), `geo.json`, `scenes.json`, `albums.json`, `samples.json`, `journeys.json`, `world.json`
- `scripts/` — `build_artists.py` (curated core), `wd_pull.py` + `build_ext.py` (Wikidata layer), `releases.py` (new releases), `weekly_mix.py`, `geocode.js`, `build_sources.py`

## Jobs (GitHub Actions)
- **Publish site** — every push to `main`.
- **New releases** — Fridays; checks Apple's catalog for new music from artists on the map and republishes.
- **Data jobs** — by hand: `wd` pulls musician influence links from Wikidata into the `data-raw` branch; then
  `python3 scripts/build_ext.py raw/wd.json site/data` merges them.

## Notes
- Previews, cover art, live shows and video export run on the public site. Inside Claude, outside media is blocked, so the
  player opens Spotify instead, and live Spotify sync, Save to Spotify, Ask Claude and fan-link review work there.
- Live shows use Ticketmaster: paste a free key from developer.ticketmaster.com on the You tab.
- Curated links are graded 1–3 by how direct they are. Wikidata links are marked and cite the reference on the Wikidata
  statement, or the Wikidata entry itself.
