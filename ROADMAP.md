# GhostQ roadmap

Target: everything below is done by **Thu 29 Oct 2026**, the day before the Qloo Agentic Hackathon deadline (30 Oct, 23:45 ET). v1.0.0 shipped on 21 Oct.

| Day | Work |
|---|---|
| Thu 22 | Rate limits and spend caps. Report (Library guard). |
| Fri 23 | Improve chords and lyrics. |
| Sat 24 | CollabQ: two crowds and their overlap. |
| Sun 25 | CollabQ: duet voice, a verse per crowd, "A feat. B" in the Library. |
| Mon 26 | RemixQ. |
| Tue 27 | Brand port into the app. |
| Wed 28 | Languages pass, fix list, seed the Library with real runs. |
| Thu 29 | Feature-complete. Release candidate: full build, tests, one QA pass. |

## Fixes

Reported on the live site (v1.0.0). Each fix keeps the "artist + story only" input and the agent asking when data is missing.

### F1. Cities from an API, not a hard-coded list (done 22 Oct)

- Built: the fans' top area is the most popular of Qloo's top 30 heatmap cells, zoomed in and named by OpenStreetMap (Nominatim, one lookup per run, cached, credited, switch `GEOCODER_OFF=1`); the city question searches Qloo's localities. With it: the artist's home (MusicBrainz, else Qloo's country tags) sets the voice and language, and the artist's own Qloo themes, styles and influences are voice signals. An artist search no longer falls back to an unrelated top result.

<details><summary>Original note</summary>


- Today: `PLACES` in `src/lib/brief.ts` holds 17 cities. The fans' strongest area from Qloo's heatmap is matched only against those 17, and the "pick the city" question offers only those 17.
- Fix: name the fans' strongest area from the heatmap cell itself (look up the city at that cell's centre), and make the city question a search box backed by an API, so any city can be picked. Each city carries its coordinates for Qloo's location signal and its language.
- Options to check before building: Qloo's own locality search (it has locality entities), or a geocoding API. Prefer Qloo where it can do it.
- Done when: an artist whose fans cluster outside the 17 cities gets that real city, and the question finds any city by name.

</details>

### F2. Artist not in Qloo: read their songs from Spotify

- Today: when Qloo doesn't know the artist, the run asks the user to describe the sound in words.
- Fix: first look the artist up on Spotify (the brief already carries their Spotify id when picked from search) and read their songs: albums and tracks, titles and release years. Turn that into the artist's sound (genres, era, mood) and use it as the run's genre signals; ask the user only if Spotify has nothing either.
- To check before building: Spotify removed some endpoints for newer apps (top tracks, popularity, related artists, audio features, per the 20 Oct research); album and track lists are expected to remain. GhostQ uses Busk Map's Spotify app.
- Receipts for these lines say "Spotify: the artist's catalogue", not Qloo.
- Done when: an artist on Spotify but not in Qloo gets a run without the sound question, with the source shown.

## 1. Rate limits and spend caps (first: blocks going live)

- Per-visitor limits on `/api/write`, `/api/sing` and `/api/spotify`, with a plain message when one is hit and when to try again.
- A daily cap on singing (Lyria, US$0.08 a song) and on fresh runs (Qloo's 10,000 calls a month are shared with Busk Map).
- Vercel BotID on the write and sing routes.
- Counters in Neon, so they hold across serverless instances.
- Done when: going past each limit shows the message, the caps stop new paid calls, and normal use is unaffected.

## CollabQ: Artist A feat. Artist B

- Pick two artists. GhostQ reads both crowds from Qloo (city, ages, language) and writes one song for where they meet: verse 1 from A's crowd, verse 2 from B's, the chorus on what both share.
- Qloo: two crowd reads plus `/v2/analysis/compare` with one artist on each side. Probed 21 Oct: 14 KB in 1 s (comparing 10 artists a side returned 1.24 MB). The shared part was styles (Engaging, Energetic, Dynamic) rather than themes, so the chorus builds on shared styles plus the closest themes.
- Where Qloo has no data for either artist, the run asks, as a normal run does.
- Voice defaults from both artists: two male artists give a male lead; a male and a female artist give a duet.
- Receipts say which crowd each line came from.
- Done when: "A feat. B" runs end to end, shows both crowds and what they share, sings with the matched voices, and appears in the Library as "A feat. B".

## RemixQ: the same song for another crowd

- On a finished song: rewrite it for another city or age. The brief stays artist-only; the new crowd is chosen after Qloo has shown the artist's own.
- The two versions sit side by side, each with its own receipts. Both are saved and linked.
- Done when: a remix runs from a song page, keeps the structure and hook, changes the lines the new crowd's data calls for, and shows both versions with their receipts.

## Report: the Library guard

- A "Report this song" link on every song page. Three reports hide a song from the Library until it's reviewed; its own link keeps working.
- A script to hide and unhide songs by id.
- A check on story seeds before a run (abusive or targeted content is refused).
- Done when: report, auto-hide and the hide script work against the deployed store (Neon).

## Improve chords and lyrics

- Chords, checked in code: every chord belongs to the key or is a common borrowed chord; a repeated section repeats its progression; transpose and capo; ChordPro export.
- Lyrics, a craft pass shown as a step: matching syllable counts between verses, a clear rhyme scheme, the hook on the strongest beat, no filler. Only the lines that fail are rewritten.
- Rewrite one section, keeping the rest. Edit a line and see whether its receipts still hold.
- Done when: the chord check passes on every new song, the craft pass runs and is visible, and one section can be rewritten on its own.

## Brand

- Port the finished GhostQ brand into the app 1:1 from its design-system source: tokens first, then each component, then each screen (Write, the live run and its questions, the song sheet, the song page, Library, How it works).
- Check AA contrast and keyboard use at 390, 768 and 1440 px.
- Done when: every screen uses the brand's tokens and components, with no plain shadcn left.

## After the deadline

- The artist's own voice, with recorded consent (Kits.ai voice conversion; its API key is a beta request).
- Lyric video.
