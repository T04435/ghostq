import "server-only";
import { tool } from "ai";
import { z, ZodError } from "zod";
import { describeAges, PLACES, type Brief } from "@/lib/brief";
import { topAgeBands } from "@/lib/fan-profile";
import { isMusicGenre, pickArtist, type QlooEntity } from "@/lib/qloo-parse";
import { SignalRegistry, type Signal } from "@/lib/signals";
import * as qloo from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";

/** What the run has learned so far. Tools read and write it; the writer reads it at the end. */
export class RunState {
  readonly signals = new SignalRegistry();
  act: QlooEntity | null = null;
  /** The act is in Qloo's search but not in the taste graph (probe 2c). */
  actInvalid = false;
  genreTagIds: string[] = [];
  readonly artistNames = new Set<string>();
  chosen: { signalIds: string[]; angle: string } | null = null;
  qlooCalls = 0;
  qlooCached = 0;

  constructor(readonly brief: Brief) {
    if (brief.artist) this.artistNames.add(brief.artist);
  }

  get crowd(): qloo.Crowd {
    return { place: this.brief.place, ages: this.brief.ages };
  }

  onCall = (log: { cached: boolean }) => {
    if (log.cached) this.qlooCached++;
    else this.qlooCalls++;
  };

  addArtists(list: QlooEntity[], source: string, max = 8): Signal[] {
    return list.slice(0, max).map((a) => {
      this.artistNames.add(a.name);
      return this.signals.add("artist", a.name, source, a.affinity);
    });
  }
}

/** A tool's answer to the model: a summary, the new signals, and trimmed raw data for the page's raw switch. */
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

export function createTools(state: RunState) {
  const crowdName = () => `${describeAges(state.brief.ages)} in ${PLACES[state.brief.place].name}`;

  return {
    find_artist: tool({
      description: "Search Qloo for the artist in the brief. Returns the best match and its genre tags. Call this first when the brief names an artist.",
      inputSchema: z.object({ name: z.string().min(1).max(80) }),
      execute: ({ name }) =>
        guard(async () => {
          const results = await qloo.searchArtist(name, state.onCall);
          // The Spotify pick from the brief pins the match when Qloo links that Spotify id.
          const match = pickArtist(results, name, state.brief.spotifyId);
          const exact = match && (match.spotifyIds.includes(state.brief.spotifyId ?? "") || match.name.toLowerCase() === name.trim().toLowerCase());
          if (!match) return { ok: false, summary: `Qloo has no artist called ${name}. Use sound_from_words with the brief's sound, or with genres you'd expect.`, signals: [] };
          state.act = match;
          state.artistNames.add(match.name);
          const genres = match.tags.filter((t) => t.type.startsWith("urn:tag:genre")).slice(0, 6);
          state.genreTagIds = genres.map((g) => g.id);
          const signals = genres.map((g) => state.signals.add("genre", g.name, `Qloo search: ${match.name}'s tags`, null));
          const note = exact ? "" : ` (closest match to "${name}"; check it's the right act)`;
          return { ok: true, summary: `Found ${match.name}${note}. Genres: ${names(signals) || "none listed"}.`, signals, raw: { name: match.name, popularity: match.popularity, tags: match.tags } };
        }),
    }),

    sound_from_words: tool({
      description: "Map the artist's own words for their sound (or genres you infer) to Qloo music genre tags, by semantic search. Use when the brief has no artist, or Qloo doesn't know the artist.",
      inputSchema: z.object({ words: z.string().min(2).max(160) }),
      execute: ({ words }) =>
        guard(async () => {
          const tags = (await qloo.genresFromWords(words, state.onCall)).slice(0, 6);
          state.genreTagIds = [...new Set([...state.genreTagIds, ...tags.map((t) => t.id)])];
          const signals = tags.map((t) => state.signals.add("genre", t.name, `Qloo tag search: "${words}"`, t.popularity));
          return { ok: tags.length > 0, summary: tags.length ? `Genres: ${names(signals)}.` : "No genres matched those words.", signals, raw: tags };
        }),
    }),

    sound_alikes: tool({
      description: "Artists whose fans overlap with the found artist's fans. Style references only: the song never names or imitates them.",
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          if (!state.act) return { ok: false, summary: "No artist found yet. Call find_artist first, or use artists_in_genres.", signals: [] };
          try {
            const list = await qloo.soundAlikes(state.act.id, state.onCall);
            const signals = state.addArtists(list, `Qloo insights: fans of ${state.act.name}`);
            return { ok: true, summary: `Sounds like: ${names(signals)}.`, signals, raw: list.map((a) => ({ name: a.name, affinity: a.affinity })) };
          } catch (error) {
            if (error instanceof QlooError && error.status === 400) {
              state.actInvalid = true;
              return { ok: false, summary: `Qloo knows ${state.act.name} by name but has no taste data for them yet. Use artists_in_genres with their genres instead.`, signals: [] };
            }
            throw error;
          }
        }),
    }),

    artists_in_genres: tool({
      description: "Artists in these genre tags, then re-ranked by fit with this crowd (city and age). The fallback when the act is small or unknown.",
      inputSchema: z.object({ genreTagIds: z.array(z.string()).max(5).optional().describe("urn:tag:genre:… ids; default the genres found so far") }),
      execute: ({ genreTagIds }) =>
        guard(async () => {
          const tags = (genreTagIds?.length ? genreTagIds : state.genreTagIds).slice(0, 5);
          if (!tags.length) return { ok: false, summary: "No genres yet. Call find_artist or sound_from_words first.", signals: [] };
          const list = await qloo.artistsByTags(tags, state.onCall);
          if (!list.length) return { ok: false, summary: "Qloo found no artists for those genres.", signals: [] };
          const ranked = await qloo.rescoreForCrowd(list.map((a) => a.id), state.crowd, state.onCall);
          const signals = state.addArtists(ranked.length ? ranked : list, `Qloo insights: genre artists ranked for ${crowdName()}`);
          return { ok: true, summary: `In these genres, best fit for this crowd first: ${names(signals)}.`, signals, raw: ranked.map((a) => ({ name: a.name, affinity: a.affinity })) };
        }),
    }),

    fan_profile: tool({
      description: "Age and gender skew of the found artist's fans. Often empty for small acts.",
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          if (!state.act || state.actInvalid) return { ok: false, summary: "No usable artist in Qloo, so no fan profile. The brief's age band stands in.", signals: [] };
          const demo = await qloo.artistDemographics(state.act.id, state.onCall);
          if (!demo) return { ok: false, summary: `Qloo has no fan profile for ${state.act.name} yet. The brief's age band stands in.`, signals: [] };
          const source = `Qloo demographics: ${state.act.name}`;
          const gender = Object.entries(demo.gender).sort((a, b) => b[1] - a[1])[0];
          const signals = [
            ...topAgeBands(demo).map((band) => state.signals.add("crowd", `Fans skew ${describeAges([band.age])}`, source, band.skew)),
            ...(gender && gender[1] > 0 ? [state.signals.add("crowd", `Fans skew ${gender[0]}`, source, gender[1])] : []),
          ];
          return { ok: true, summary: `Fans: ${names(signals)}.`, signals, raw: demo };
        }),
    }),

    crowd_tags: tool({
      description:
        "Tags this crowd (city + age band) over-indexes on. kind 'theme' gives lyric subjects (Love, Heartbreak, Self Discovery…), the strongest lyric signal. 'style' gives moods and styles; 'genre' gives music genres. withArtist blends in the found artist's fans.",
      inputSchema: z.object({ kind: z.enum(["theme", "style", "genre"]), withArtist: z.boolean().default(false) }),
      execute: ({ kind, withArtist }) =>
        guard(async () => {
          const act = withArtist && state.act && !state.actInvalid ? state.act : null;
          let tags = await qloo.crowdTags(kind, state.crowd, act?.id, state.onCall);
          if (kind === "genre") {
            tags = tags.filter((t) => isMusicGenre(t.id));
            state.genreTagIds = [...new Set([...state.genreTagIds, ...tags.slice(0, 3).map((t) => t.id)])];
          }
          tags = tags.slice(0, 10);
          const source = `Qloo insights: ${kind} tags for ${crowdName()}${act ? ` and fans of ${act.name}` : ""}`;
          const signals = tags.map((t) => state.signals.add(kind, t.name, source, t.affinity));
          return { ok: tags.length > 0, summary: tags.length ? `${names(signals)}.` : `No ${kind} tags came back.`, signals, raw: tags };
        }),
    }),

    local_scene: tool({
      description: "Artists in the city's scene for these genres and this age band (the two-step local-scene query), near the found artist when there is one.",
      inputSchema: z.object({ genreTagIds: z.array(z.string()).max(5).optional().describe("Music genre ids (urn:tag:genre:music:…); default the city's genres found by crowd_tags") }),
      execute: ({ genreTagIds }) =>
        guard(async () => {
          const tags = (genreTagIds?.length ? genreTagIds : state.genreTagIds).filter(isMusicGenre).slice(0, 5);
          if (!tags.length) return { ok: false, summary: "No music genres yet. Call crowd_tags with kind 'genre' first.", signals: [] };
          const act = state.act && !state.actInvalid ? state.act : null;
          const list = await qloo.sceneArtists(tags, state.crowd, act?.id, state.onCall);
          const signals = state.addArtists(list, `Qloo insights: local scene for ${crowdName()}`);
          return { ok: list.length > 0, summary: list.length ? `Local scene: ${names(signals)}.` : "No local scene artists came back.", signals, raw: list.map((a) => ({ name: a.name, affinity: a.affinity })) };
        }),
    }),

    crowd_taste: tool({
      description: "Films or books this crowd loves: images, places and moods for the lyrics (never quote titles in lyrics).",
      inputSchema: z.object({ type: z.enum(["movie", "book"]) }),
      execute: ({ type }) =>
        guard(async () => {
          const list = (await qloo.crowdTaste(type, state.crowd, state.onCall)).slice(0, 6);
          const signals = list.map((e) => state.signals.add(type, e.name, `Qloo insights: ${type}s for ${crowdName()}`, e.affinity));
          return { ok: list.length > 0, summary: list.length ? `${names(signals)}.` : `No ${type}s came back.`, signals, raw: list.map((e) => ({ name: e.name, affinity: e.affinity })) };
        }),
    }),

    fan_audiences: tool({
      description: "Lifestyle audiences the found artist's fans over-index on (hobbies, jobs): everyday detail for the lyrics.",
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          if (!state.act || state.actInvalid) return { ok: false, summary: "No usable artist in Qloo for this.", signals: [] };
          const list = (await qloo.fanAudiences(state.act.id, state.onCall)).slice(0, 6);
          const signals = list.map((e) => state.signals.add("audience", e.name, `Qloo insights: audiences of ${state.act!.name}'s fans`, e.affinity));
          return { ok: list.length > 0, summary: list.length ? `${names(signals)}.` : "No audiences came back.", signals, raw: list.map((e) => ({ name: e.name, affinity: e.affinity })) };
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
