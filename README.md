# GhostQ

An AI ghostwriter that knows your next crowd. Give it your sound (an artist, or your own words), a city, an age band and a language. An agent reads that crowd's taste through [Qloo](https://www.qloo.com/) and writes an original song sheet: lyrics, chords, structure, melody notes and a production brief, with a receipt on every line showing the Qloo signal behind it.

Built for the Qloo Agentic Hackathon 2026. Status: **beta** (v0.1.0-beta.1). It writes the song sheet and can have it sung and produced by Google Lyria.

## Run it locally

Requirements: Node 22+, pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # then add your keys
pnpm dev                      # http://localhost:3300
```

Keys:
- `QLOO_API_KEY`: a Qloo API key.
- `AI_GATEWAY_API_KEY`: a Vercel AI Gateway key (or `vercel link` + `vercel env pull` for an OIDC token).
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`: a Spotify app (client credentials) for the artist search.
- `GEMINI_API_KEY`: a Gemini API key on a paid tier, for singing with Lyria 3.5 (about US$0.08 a song). Optional: without it the app still writes song sheets.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## How it works

1. **Sound:** Qloo search finds the artist and its genres. If Qloo doesn't know the act, its own words go through Qloo's semantic tag search.
2. **Crowd:** the city and age band are Qloo signals. Theme tags (Love, Heartbreak, Self Discovery…) are the lyric subjects. Style tags and the local scene shape the music.
3. **Imagery:** the films and books the crowd loves, and the fans' lifestyles.
4. **Agent:** Claude (through the AI SDK's `ToolLoopAgent`) chooses each Qloo call from what it found so far, then picks the signals for the song.
0. **Artist:** pressing Enter searches Spotify; the pick pins the Qloo match by Spotify id. The crowd (city from Qloo's world heatmap, up to three fan age bands, language from the city) is read from Qloo, and can be changed.
5. **Writer:** the song is generated against a schema. Code checks every line cites a real signal and no real artist is named, with one repair pass.

6. **Singing (optional):** the sheet's key, tempo, feel, production brief and tagged lyrics go to Google Lyria 3.5, which returns a produced, sung MP3 with a SynthID watermark. Real artist names are stripped from the prompt.

Qloo has no language filter, so the song's language comes from the brief.

## Licence

MIT
