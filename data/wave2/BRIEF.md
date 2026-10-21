# Sound Lineage, wave 2: candidate artists

The app maps who influenced whom in music, 1900s to now. It already has 432 artists in
/home/claude/music/data/master.txt (format: id|Name|decade|family). We are growing to ~1,500.

Families (pick exactly one per artist):
blues (blues & gospel), jazz, country, folk (folk & songwriters), rock, alt (punk, post-punk, indie, emo, shoegaze, grunge),
metal, soul (soul, R&B, funk, disco), pop, hiphop, electronic (incl. house, techno, EDM, ambient), reggae (reggae, ska, dancehall),
latin (Latin America, Spain, Brazil), global (Africa, Asia incl. K-pop and J-pop, Middle East, Europe outside the English-language mainstream, India).

decade = the decade they broke through (1900s ... 2020s).
role = artist | producer | session  (producer = known mainly as a producer, e.g. Rick Rubin; session = session player/house band, e.g. The Funk Brothers).

Rules
- Do NOT include anyone already in master.txt (check by name, ignoring "The", case and punctuation).
- Pick artists that matter for lineage: clear influence on others, or clearly influenced by artists on the list, or big enough that users will search for them. Favour real connective tissue over obscurity.
- id = kebab-case of the common name (e.g. "jim-croce", "asap-rocky", "bts", "bad-bunny" style). No duplicates within your list.
- Output ONLY a plain text file, one line per artist: id|Name|decade|family|role
- Save to the path given in your task. Then reply with just the count.
