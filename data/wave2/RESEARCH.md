# Sound Lineage, wave 2: research brief

You are filling in artist data for a music-discovery app that maps who influenced whom.
- The full list of every artist in the app (old and new) is /home/claude/music/data/wave2/all.txt (id|Name|decade|family|role).
  Use ONLY ids from that file in any link.
- Your batch file (given in your task) lists the artists you must write up.

## How to work (important)
Work in small batches of 5 artists. For each batch, write a short Python script that loads your output file if it exists,
appends the 5 new objects, and saves it. Keep all text neutral and strictly about the music: sound, records, collaborators,
stated influences. Never quote lyrics, and don't describe violence, drugs, sexual content, crimes or deaths beyond a plain date.

## One object per artist
{
 "id": "<exact id from your batch>",
 "years": "1971–1983" or "2016–present",
 "origin": "City, State" for the US (e.g. "Memphis, Tennessee"), "City, Country" elsewhere (e.g. "Lagos, Nigeria"). Use the city where they formed or came up. Use the real city name, not a neighborhood, unless the neighborhood is the point (e.g. "Bronx, New York").
 "genres": ["2-4 specific style tags"],
 "summary": "1-2 plain sentences: who they are and why they matter.",
 "know": ["3 short true facts in your own words"],
 "born": "MM-DD" for solo people, else null,
 "keyAlbums": [["Title", 1977]] up to 4 (for producers: landmark records they produced, with the artist, e.g. ["Nevermind (Nirvana)", 1991]),
 "songs": ["3-5 essential songs"],
 "influencedBy": [{"id": "<id from all.txt>", "why": "one specific sentence in your own words", "s": 3}],
 "influenced":   [{"id": "<id from all.txt>", "why": "one specific sentence", "s": 3}],
 "cousins": [{"id": "<id from all.txt, DIFFERENT family>", "why": "same role or feel in another genre"}]
}

## Link rules
- influencedBy: direct, documented influences on this artist. 3-10 each. s=3 the artist said so / mentor / bandmate / producer relationship;
  s=2 widely documented by historians; s=1 clear stylistic lineage. Leave out anything you are unsure of.
- influenced: artists this one directly shaped, ESPECIALLY artists already in the old part of the list (the first 432 lines) and,
  for producers and session players, the artists whose records they made ("Produced Nevermind and shaped its sound."). 0-12 each.
- cousins: 2-3 from other families that a fan would enjoy for the same reason.
- An influence can't come from someone who broke through more than one decade later.
- Plain English, no em dashes, no hype.

## Finish
Validate: the file parses as a JSON array, every artist in your batch is present once, every id used exists in all.txt.
Fix problems, then reply with: artists written, total influencedBy, total influenced.
