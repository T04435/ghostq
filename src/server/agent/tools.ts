import "server-only";
import { tool } from "ai";
import { z, ZodError } from "zod";
import { describeCrowd, type Brief, type Crowd, type Place } from "@/lib/brief";
import type { SongSheet } from "@/lib/song-sheet";
import type { VocalMatch } from "@/lib/voice";
import { isMusicGenre, throughStandIns, type QlooEntity } from "@/lib/qloo-parse";
import { SignalRegistry, type Side, type Signal } from "@/lib/signals";
import * as qloo from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";

/** One artist in the run: A, or CollabQ's featured B. What was found for them on Qloo and MusicBrainz. */
export class ArtistRun {
  act: QlooEntity | null = null;
  /** The act is in Qloo's search but not in the taste graph (probe 2c). */
  actInvalid = false;
  genreTagIds: string[] = [];
  /** Read from Qloo before the agent starts (server/crowd.ts). */
  crowdInfo: Crowd | null = null;
  /** A country Qloo files among the artist's genre tags ("Cuba"): where they're from when MusicBrainz doesn't say. */
  homeFromTags: string | null = null;
  /** The voices that match the artist (MusicBrainz), read with the crowd; the writer gets them as fixed input. */
  vocals: VocalMatch | null = null;
  /** RemixQ's quick picks: the fans' next-strongest areas, named in the background (solo runs only). */
  nextAreas: Promise<Place[]> | null = null;

  constructor(
    readonly key: "A" | "B",
    readonly name: string,
    readonly spotifyId: string | undefined,
    readonly answers: Brief["answers"],
  ) {}

  get crowd(): qloo.CrowdSignal {
    return { place: this.crowdInfo?.place ?? null, ages: this.crowdInfo?.ages.map((a) => a.age) ?? [] };
  }
}

/** What the run has learned so far. Tools read and write it; the writer reads it at the end. */
export class RunState {
  readonly signals = new SignalRegistry();
  /** A, plus B for CollabQ ("A feat. B"). */
  readonly artists: ArtistRun[];
  readonly artistNames = new Set<string>();
  chosen: { signalIds: string[]; angle: string } | null = null;
  /** RemixQ: the saved song being rewritten for another crowd (read from the store, never from the client). */
  original: SongSheet | null = null;
  qlooCalls = 0;
  qlooCached = 0;

  constructor(readonly brief: Brief) {
    this.artists = [new ArtistRun("A", brief.artist, brief.spotifyId, brief.answers)];
    if (brief.feat) this.artists.push(new ArtistRun("B", brief.feat.artist, brief.feat.spotifyId, brief.feat.answers));
    for (const a of this.artists) this.artistNames.add(a.name);
  }

  get collab(): boolean {
    return this.artists.length > 1;
  }

  /** An artist by key; A when none is given (solo runs, and tools called without one). */
  artist(key?: "A" | "B"): ArtistRun {
    return this.artists.find((a) => a.key === key) ?? this.artists[0];
  }

  /** The side a signal is tagged with: only in a collab. */
  side(key?: "A" | "B"): Side | undefined {
    return this.collab ? this.artist(key).key : undefined;
  }

  // A's fields, as solo runs have always used them.
  get act() {
    return this.artists[0].act;
  }
  set act(v) {
    this.artists[0].act = v;
  }
  get actInvalid() {
    return this.artists[0].actInvalid;
  }
  set actInvalid(v) {
    this.artists[0].actInvalid = v;
  }
  get genreTagIds() {
    return this.artists[0].genreTagIds;
  }
  set genreTagIds(v) {
    this.artists[0].genreTagIds = v;
  }
  get crowdInfo() {
    return this.artists[0].crowdInfo;
  }
  set crowdInfo(v) {
    this.artists[0].crowdInfo = v;
  }
  get homeFromTags() {
    return this.artists[0].homeFromTags;
  }
  set homeFromTags(v) {
    this.artists[0].homeFromTags = v;
  }
  get vocals() {
    return this.artists[0].vocals;
  }
  set vocals(v) {
    this.artists[0].vocals = v;
  }
  get crowd(): qloo.CrowdSignal {
    return this.artists[0].crowd;
  }

  onCall = (log: { cached: boolean }) => {
    if (log.cached) this.qlooCached++;
    else this.qlooCalls++;
  };

  addArtists(list: QlooEntity[], source: string, max = 8, side?: Side): Signal[] {
    return list.slice(0, max).map((a) => {
      this.artistNames.add(a.name);
      return this.signals.add("artist", a.name, "qloo", source, a.affinity, side);
    });
  }
}

/** A tool's answer to the model: a summary, the new signals, and trimmed raw data (kept with the song, never public). */
export type ToolOutput = { ok: boolean; summary: string; signals: Signal[]; raw?: unknown };

/** A repeat label maps to the same signal: list each once. */
const names = (s: Signal[]) => [...new Map(s.map((x) => [x.id, x])).values()].map((x) => `${x.id} ${x.label}`).join(", ");

async function guard(run: () => Promise<ToolOutput>): Promise<ToolOutput> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof QlooError) return { ok: false, summary: error.message, signals: [] };
    if (error instanceof ZodError) return { ok: false, summary: "Qloo answered in a shape GhostQ didn't expect, so this step was skipped.", signals: [] };
    throw error;
  }
}

/** CollabQ: which artist's crowd a tool works on. Solo runs leave it out (A). */
const who = z.enum(["A", "B"]).optional().describe('CollabQ only: "A" (the main artist, default) or "B" (the featured artist)');

export function createTools(state: RunState) {
  const crowdName = (x = state.artist()) => (x.crowdInfo ? describeCrowd(x.crowdInfo) : "this crowd");
  const of = (x = state.artist()) => (state.collab ? ` (${x.name}'s crowd)` : "");

  return {
    sound_from_words: tool({
      description: "Map genre or mood words to Qloo music genre tags, by semantic search. Use when the artist's own genre tags are thin or missing.",
      inputSchema: z.object({ words: z.string().min(2).max(160), artist: who }),
      execute: ({ words, artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          const tags = (await qloo.genresFromWords(words, state.onCall)).slice(0, 6);
          x.genreTagIds = [...new Set([...x.genreTagIds, ...tags.map((t) => t.id)])];
          const signals = tags.map((t) => state.signals.add("genre", t.name, "qloo", `Qloo tag search: "${words}"`, t.popularity, state.side(artist)));
          return { ok: tags.length > 0, summary: tags.length ? `Genres${of(x)}: ${names(signals)}.` : "No genres matched those words.", signals, raw: tags };
        }),
    }),

    sound_alikes: tool({
      description: "Artists whose fans overlap with the found artist's fans. Style references only: the song never names or imitates them.",
      inputSchema: z.object({ artist: who }),
      execute: ({ artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          if (!x.act) return { ok: false, summary: "No artist found yet. Call find_artist first, or use artists_in_genres.", signals: [] };
          try {
            const list = await qloo.soundAlikes(x.act.id, state.onCall);
            const signals = state.addArtists(list, `Qloo insights: fans of ${x.act.name}${throughStandIns(x)}`, 8, state.side(artist));
            return { ok: true, summary: `${state.collab ? `${x.name} s` : "S"}ounds like: ${names(signals)}.`, signals, raw: list.map((a) => ({ name: a.name, affinity: a.affinity })) };
          } catch (error) {
            if (error instanceof QlooError && error.status === 400) {
              x.actInvalid = true;
              return { ok: false, summary: `Qloo knows ${x.act.name} by name but has no taste data for them yet. Use artists_in_genres with their genres instead.`, signals: [] };
            }
            throw error;
          }
        }),
    }),

    artists_in_genres: tool({
      description: "Artists in these genre tags, then re-ranked by fit with this crowd (city and age). The fallback when the act is small or unknown.",
      inputSchema: z.object({ genreTagIds: z.array(z.string()).max(5).optional().describe("urn:tag:genre:… ids; default the genres found so far"), artist: who }),
      execute: ({ genreTagIds, artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          const tags = (genreTagIds?.length ? genreTagIds : x.genreTagIds).slice(0, 5);
          if (!tags.length) return { ok: false, summary: "No genres yet. Call find_artist or sound_from_words first.", signals: [] };
          const list = await qloo.artistsByTags(tags, state.onCall);
          if (!list.length) return { ok: false, summary: "Qloo found no artists for those genres.", signals: [] };
          const ranked = await qloo.rescoreForCrowd(list.map((a) => a.id), x.crowd, state.onCall);
          const signals = state.addArtists(ranked.length ? ranked : list, `Qloo insights: genre artists ranked for ${crowdName(x)}`, 8, state.side(artist));
          return { ok: true, summary: `In these genres, best fit for this crowd${of(x)} first: ${names(signals)}.`, signals, raw: ranked.map((a) => ({ name: a.name, affinity: a.affinity })) };
        }),
    }),

    crowd_tags: tool({
      description:
        "Tags this crowd (city + age band) over-indexes on. kind 'theme' gives lyric subjects (Love, Heartbreak, Self Discovery…), the strongest lyric signal. 'style' gives moods and styles; 'genre' gives music genres. withArtist blends in the found artist's fans.",
      inputSchema: z.object({ kind: z.enum(["theme", "style", "genre"]), withArtist: z.boolean().default(false), artist: who }),
      execute: ({ kind, withArtist, artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          const act = withArtist && x.act && !x.actInvalid ? x.act : null;
          let tags = await qloo.crowdTags(kind, x.crowd, act?.id, state.onCall);
          if (kind === "genre") {
            tags = tags.filter((t) => isMusicGenre(t.id));
            x.genreTagIds = [...new Set([...x.genreTagIds, ...tags.slice(0, 3).map((t) => t.id)])];
          }
          tags = tags.slice(0, 10);
          const source = `Qloo insights: ${kind} tags for ${crowdName(x)}${act ? ` and fans of ${act.name}${throughStandIns({ act })}` : ""}`;
          const signals = tags.map((t) => state.signals.add(kind, t.name, "qloo", source, t.affinity, state.side(artist)));
          return { ok: tags.length > 0, summary: tags.length ? `${state.collab ? `${x.name}'s crowd: ` : ""}${names(signals)}.` : `No ${kind} tags came back.`, signals, raw: tags };
        }),
    }),

    local_scene: tool({
      description: "Artists in the city's scene for these genres and this age band (the two-step local-scene query), near the found artist when there is one.",
      inputSchema: z.object({ genreTagIds: z.array(z.string()).max(5).optional().describe("Music genre ids (urn:tag:genre:music:…); default the city's genres found by crowd_tags"), artist: who }),
      execute: ({ genreTagIds, artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          const tags = (genreTagIds?.length ? genreTagIds : x.genreTagIds).filter(isMusicGenre).slice(0, 5);
          if (!tags.length) return { ok: false, summary: "No music genres yet. Call crowd_tags with kind 'genre' first.", signals: [] };
          const act = x.act && !x.actInvalid ? x.act : null;
          const list = await qloo.sceneArtists(tags, x.crowd, act?.id, state.onCall);
          const signals = state.addArtists(list, `Qloo insights: local scene for ${crowdName(x)}${act ? throughStandIns({ act }) : ""}`, 8, state.side(artist));
          return { ok: list.length > 0, summary: list.length ? `Local scene${of(x)}: ${names(signals)}.` : "No local scene artists came back.", signals, raw: list.map((a) => ({ name: a.name, affinity: a.affinity })) };
        }),
    }),

    crowd_taste: tool({
      description: "Films or books this crowd loves: images, places and moods for the lyrics (never quote titles in lyrics).",
      inputSchema: z.object({ type: z.enum(["movie", "book"]), artist: who }),
      execute: ({ type, artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          const list = (await qloo.crowdTaste(type, x.crowd, state.onCall)).slice(0, 6);
          const signals = list.map((e) => state.signals.add(type, e.name, "qloo", `Qloo insights: ${type}s for ${crowdName(x)}`, e.affinity, state.side(artist)));
          return { ok: list.length > 0, summary: list.length ? `${state.collab ? `${x.name}'s crowd: ` : ""}${names(signals)}.` : `No ${type}s came back.`, signals, raw: list.map((e) => ({ name: e.name, affinity: e.affinity })) };
        }),
    }),

    fan_audiences: tool({
      description: "Lifestyle audiences the found artist's fans over-index on (hobbies, jobs): everyday detail for the lyrics.",
      inputSchema: z.object({ artist: who }),
      execute: ({ artist }) =>
        guard(async () => {
          const x = state.artist(artist);
          if (!x.act || x.actInvalid) return { ok: false, summary: "No usable artist in Qloo for this.", signals: [] };
          const list = (await qloo.fanAudiences(x.act.id, state.onCall)).slice(0, 6);
          const signals = list.map((e) => state.signals.add("audience", e.name, "qloo", `Qloo insights: audiences of ${x.act!.name}'s fans${throughStandIns(x)}`, e.affinity, state.side(artist)));
          return { ok: list.length > 0, summary: list.length ? `${state.collab ? `${x.name}'s fans: ` : ""}${names(signals)}.` : "No audiences came back.", signals, raw: list.map((e) => ({ name: e.name, affinity: e.affinity })) };
        }),
    }),

    ready_to_write: tool({
      description: "Finish research: choose the 8–20 signal ids the song should be built on (at least 3 themes when you have them) and say the song's angle in one sentence.",
      inputSchema: z.object({ signalIds: z.array(z.string()).min(3).max(24), angle: z.string().min(10).max(400) }),
      execute: async ({ signalIds, angle }): Promise<ToolOutput> => {
        const known = signalIds.filter((id) => state.signals.get(id));
        if (known.length < 3) return { ok: false, summary: `Only ${known.length} of those ids exist. Choose from the ids the tools returned.`, signals: [] };
        state.chosen = { signalIds: known, angle };
        return { ok: true, summary: `Writing from ${known.length} signals. Angle: ${angle}`, signals: known.map((id) => state.signals.get(id)!) };
      },
    }),
  };
}
