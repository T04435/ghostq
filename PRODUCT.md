# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Hackathon judges (Qloo Agentic Hackathon 2026)** evaluating the live app at ghostq.xyz: they open it cold, write or play a song in a few minutes, and check that the agent really uses Qloo.
- **Music fans and songwriters** who name an artist they love and want an original draft written for that artist's crowd, then sing it, share it, remix it.

## Product Purpose

GhostQ is an AI ghostwriter that knows your next crowd. Name an artist (optionally a "feat." artist and a story seed); the agent, the Ghost, reads the artist's crowd from Qloo (where their fans are strongest, which ages, what they love), then writes an original song sheet for that crowd: chords, melody notes, lyrics, a production brief, and a receipt on every line. Google Lyria sings it. Success: a visitor gets a song that clearly comes from real taste data, and can see exactly which signal shaped each line.

## Positioning

Receipts on every line. Every lyric line cites the Qloo taste signals behind it, so the song is traceable to the crowd it was written for. Songs are original drafts, labelled AI-generated and not affiliated with the artist, and never imitate the artist's voice.

## Operating Context

- Write: artist picked from Spotify search (required), optional feat. artist (CollabQ) and story seed; the run streams its steps live and asks inline when data is missing (city, ages, language, which artist on Qloo).
- The song page: sheet with receipts, sing with Lyria (about a minute, costs credits), sing-along that follows the recording, share, remix for another crowd (RemixQ).
- Library: every song, public, no login; this browser's songs marked as yours.
- QPlayer: one player across the site.

## Capabilities and Constraints

- Qloo is the first source for every data point; MusicBrainz, Spotify, Wikipedia and OpenStreetMap only fill gaps and are credited when used.
- Languages: English, Spanish, Portuguese, French, German, Japanese, Korean, Hindi.
- Paid calls (Lyria about US$0.08 a song, Whisper about US$0.012, AI Gateway) sit behind per-device and daily limits and BotID.
- No accounts or login; a device cookie only counts limits and marks your songs.
- Lime is reserved for Qloo's signal (and the brand's play controls); it never marks non-Qloo data.

## Brand Commitments

- Name GhostQ; the agent is "the Ghost". No "powered by Claude" or Anthropic naming in the product.
- The required draft label on every song: "GhostQ draft for <artist>, AI-generated, not affiliated with <artist>".
- The brand system lives in the Claude Design project "GhostQ Design System" (graphite and lime, Hanken Grotesk, Red Hat Mono, Geist Pixel, the 3×3 crowd-grid mark); the app ports it 1:1.

## Evidence on Hand

- The live app and its public Library of real runs (ghostq.xyz/library).
- Release notes and Devpost updates under the sibling media/ folder; feature videos 01–05.
- No testimonials, users counts or press: never invent them.

## Product Principles

1. Show the data: every claim on screen traces to a signal, a source, or a step.
2. Ask, don't guess: when data is missing the run pauses and asks.
3. Original, labelled, respectful: drafts for a crowd, never an imitation of an artist.
4. Judge-proof in minutes: the main path works cold, without login, on a phone.
