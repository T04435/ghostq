# GhostQ roadmap

Target: everything below is done by **Thu 29 Oct 2026**, the day before the Qloo Agentic Hackathon deadline (30 Oct, 23:45 ET). v1.0.0 shipped on 21 Oct.

| Day | Work |
|---|---|
| Thu 22 | Report (Library guard). Start Improve chords and lyrics. |
| Fri 23 | Improve chords and lyrics. |
| Sat 24 | CollabQ: two crowds and their overlap. |
| Sun 25 | CollabQ: duet voice, a verse per crowd, "A feat. B" in the Library. |
| Mon 26 | RemixQ. |
| Tue 27 | Brand port into the app. |
| Wed 28 | Languages pass, fix list, seed the Library with real runs. |
| Thu 29 | Feature-complete. Release candidate: full build, tests, one QA pass. |

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
