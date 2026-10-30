import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { EXAMPLE_BRIEFS, type Brief } from "@/lib/brief";
import { LANGUAGES } from "@/lib/place";
import { remixParams } from "@/lib/remix-params";
import { MODELS } from "@/server/agent/models";
import { searchSpotifyArtists } from "@/server/spotify/client";
import { listSongs } from "@/server/store/songs";

/**
 * A Ghost suggestion: a brief to fill in on Write, or (RemixQ) a link to a song's remix with the new crowd filled in.
 * `fresh` names an artist with a release in the last two weeks (ListenBrainz): Qloo may not know them yet (the chip says so).
 */
export type Example = { label: string; brief: Brief; fresh?: string; href?: never } | { label: string; href: string; brief?: never; fresh?: never };
/** Write's suggestion modes: a solo song, a CollabQ pair (the Landing's Write a feat.) or a RemixQ (Pick a song to remix). */
export type ExampleMode = "solo" | "feat" | "remix";

const ideas = z.object({
  examples: z
    .array(
      z.object({
        artist: z.string().describe("A real, currently active music artist, exactly as named on Spotify"),
        story: z.string().describe("What the song could be about: one everyday, specific moment in 4 to 9 words"),
        label: z.string().describe("The story in 2 to 5 lowercase words, for a chip"),
      }),
    )
    .describe("8 examples"),
  moments: z
    .array(
      z.object({
        story: z.string().describe("What a song could be about: one everyday, specific moment in 4 to 9 words"),
        label: z.string().describe("The story in 2 to 5 lowercase words, for a chip"),
      }),
    )
    .describe("3 more moments, for artists the app picks"),
});

const pairs = z.object({
  examples: z
    .array(
      z.object({
        artist: z.string().describe("A real, currently active music artist, exactly as named on Spotify"),
        feat: z.string().describe("A second real artist for a duet with the first, exactly as named on Spotify"),
        story: z.string().describe("What the duet could be about: one everyday, specific moment in 4 to 9 words"),
        label: z.string().describe("The story in 2 to 4 lowercase words, for a chip"),
      }),
    )
    .describe("8 examples"),
  moments: z
    .array(
      z.object({
        story: z.string().describe("What a song could be about: one everyday, specific moment in 4 to 9 words"),
        label: z.string().describe("The story in 2 to 5 lowercase words, for a chip"),
      }),
    )
    .describe("3 more moments, for artists the app picks"),
});

/** Artists with a release in the last two weeks: MusicBrainz-linked, so NotOnQ can fill them when Qloo can't. */
const FRESH_URL = "https://api.listenbrainz.org/1/explore/fresh-releases/?days=14&past=true&future=false";
const FRESH_MS = 60 * 60 * 1000;
const freshReleases = z.object({ payload: z.object({ releases: z.array(z.object({ artist_credit_name: z.string(), artist_mbids: z.array(z.string()).nullish() })) }) });
type Moment = { story: string; label: string };
type Pool = { examples: Example[]; moments: Moment[] };

const POOL_MS = 10 * 60 * 1000;
const pools: Partial<Record<"solo" | "feat", { at: number; examples: Promise<Pool> }>> = {};
let fresh: { at: number; artists: { name: string; id: string }[] | null } | undefined;

const key = (name: string) => name.trim().toLowerCase();
const shuffle = <T>(all: T[]) => [...all].sort(() => Math.random() - 0.5);

/** The exact Spotify artist for a suggested name, or null (the form needs a Spotify pick). */
async function pin(name: string): Promise<{ name: string; id: string } | null> {
  const match = (await searchSpotifyArtists(name).catch(() => [])).find((a) => key(a.name) === key(name));
  return match ? { name: match.name, id: match.id } : null;
}

/** The model's ideas, or why there are none: "length" means it ran out of room before the JSON closed (30 Oct). */
function parsed<T>(result: { finishReason: string; usage: { outputTokens?: number }; output: T }): T {
  if (result.finishReason !== "stop") throw new Error(`the Ghost stopped early (${result.finishReason}, ${result.usage.outputTokens ?? "?"} tokens)`);
  return result.output;
}

/**
 * Newcomers for the suggestions (the user, 30 Oct): solo artists with a release in the last two weeks on ListenBrainz,
 * pinned on Spotify. Never checked through NotOnQ here, so a Write is NotOnQ's first look at them. Kept for an hour
 * and fetched in the background: the page never waits for it.
 */
async function freshArtists(): Promise<{ name: string; id: string }[]> {
  const library = await listSongs().catch(() => []);
  const taken = new Set(library.flatMap((s) => [s.artist, ...(s.featuring ? [s.featuring] : [])]).map(key));
  const body = freshReleases.parse(await (await fetch(FRESH_URL, { signal: AbortSignal.timeout(10_000) })).json());
  const names = [...new Set(body.payload.releases.filter((r) => r.artist_mbids?.length === 1).map((r) => r.artist_credit_name))].filter((n) => !taken.has(key(n)));
  const pinned = await Promise.all(shuffle(names).slice(0, 12).map(pin));
  return pinned.filter((a): a is { name: string; id: string } => a !== null);
}

/** The newcomers fetched so far; starts (or refreshes) the fetch without waiting for it. */
function readyFresh(): { name: string; id: string }[] {
  if (!fresh || Date.now() - fresh.at > FRESH_MS) {
    const entry: { at: number; artists: { name: string; id: string }[] | null } = { at: Date.now(), artists: fresh?.artists ?? null };
    fresh = entry;
    freshArtists()
      .then((artists) => (entry.artists = artists))
      .catch((e) => console.error("fresh releases failed", e instanceof Error ? e.message : e));
  }
  return fresh.artists ?? [];
}

/**
 * Fresh "Try" examples for the Write page (the user, 26 Oct): artists the Library has no song for yet, so the examples
 * don't keep writing the same songs. The Ghost suggests 8 varied artists and moments (one model call), each is pinned
 * to its Spotify artist (an exact name match, as the form requires), and the pool is kept for 10 minutes per instance.
 */
async function generate(): Promise<Pool> {
  const library = await listSongs().catch(() => []);
  const taken = new Set(library.flatMap((s) => [s.artist, ...(s.featuring ? [s.featuring] : [])]).map(key));
  const result = await generateText({
    model: MODELS.agent,
    output: Output.object({ schema: ideas }),
    maxOutputTokens: 2000,
    abortSignal: AbortSignal.timeout(30_000),
    prompt: [
      "Suggest 8 examples for a songwriting app: a real music artist and a small everyday moment the song could be about.",
      `Mix genres, countries and eras, and artists who sing in these languages: ${LANGUAGES.join(", ")}. Some well known, some cult.`,
      "Then 3 more moments on their own, for artists the app picks.",
      "Don't suggest any of these artists (they already have songs):",
      [...taken].join(", ") || "(none)",
    ].join("\n"),
  });
  const output = parsed(result);
  const picked = await Promise.all(
    output.examples
      .filter((e) => !taken.has(key(e.artist)))
      .map(async (e): Promise<Example | null> => {
        const match = (await searchSpotifyArtists(e.artist).catch(() => [])).find((a) => key(a.name) === key(e.artist));
        return match && !taken.has(key(match.name)) ? { label: `${match.name} · ${e.label}`, brief: { artist: match.name, spotifyId: match.id, story: e.story } } : null;
      }),
  );
  const examples = picked.filter((e): e is Example => e !== null);
  if (examples.length < 2) throw new Error("too few examples");
  return { examples, moments: output.moments ?? [] };
}

/**
 * CollabQ pairs for "Write a feat." (the user, 27 Oct): two real artists who'd make a believable duet, at least one of
 * them without a song in the Library, both pinned on Spotify.
 */
async function generatePairs(): Promise<Pool> {
  const library = await listSongs().catch(() => []);
  const taken = new Set(library.flatMap((s) => [s.artist, ...(s.featuring ? [s.featuring] : [])]).map(key));
  const result = await generateText({
    model: MODELS.agent,
    output: Output.object({ schema: pairs }),
    maxOutputTokens: 2400,
    abortSignal: AbortSignal.timeout(30_000),
    prompt: [
      "Suggest 8 duets for a songwriting app: two real music artists whose crowds would meet in one song, and a small everyday moment it could be about.",
      `Mix genres, countries and eras, and artists who sing in these languages: ${LANGUAGES.join(", ")}. Pairs can cross genres or countries; some well known, some cult.`,
      "Then 3 more moments on their own, for duets the app picks.",
      "At least one artist in each pair must not be one of these (they already have songs):",
      [...taken].join(", ") || "(none)",
    ].join("\n"),
  });
  const output = parsed(result);
  const picked = await Promise.all(
    output.examples
      .filter((e) => key(e.artist) !== key(e.feat) && !(taken.has(key(e.artist)) && taken.has(key(e.feat))))
      .map(async (e): Promise<Example | null> => {
        const [a, b] = await Promise.all([pin(e.artist), pin(e.feat)]);
        return a && b && a.id !== b.id
          ? { label: `${a.name} feat. ${b.name} · ${e.label}`, brief: { artist: a.name, spotifyId: a.id, story: e.story, feat: { artist: b.name, spotifyId: b.id } } }
          : null;
      }),
  );
  const examples = picked.filter((e): e is Example => e !== null);
  if (examples.length < 2) throw new Error("too few pairs");
  return { examples, moments: output.moments ?? [] };
}

/**
 * RemixQ suggestions for "Pick a song to remix" (the user, 27 Oct), no model call: Songbook songs (solo originals) for
 * one of their artist's next-strongest fan areas on Qloo, which the song doesn't have a remix for yet. Each links to the
 * song's remix page with that city filled in; the run waits for Remix.
 */
async function remixIdeas(): Promise<Example[]> {
  const library = await listSongs().catch(() => []);
  const done = new Set(library.filter((s) => s.remixOf).map((s) => `${key(s.remixOf!)}|${key(s.crowd.place?.name ?? "")}`));
  const ideas = library.flatMap((s) => {
    if (s.featuring || s.remixOf) return [];
    const areas = (s.crowd.otherAreas ?? []).filter((p) => key(p.name) !== key(s.crowd.place?.name ?? "") && !done.has(`${key(s.title)}|${key(p.name)}`));
    const area = areas[Math.floor(Math.random() * areas.length)];
    return area ? [{ label: `${s.title} for ${area.name}`, href: `/remix/${s.id}?${remixParams({ place: area })}&prefill=1` }] : [];
  });
  return ideas;
}

/** Three suggestions at random, one of them a fresh release when the pool has one (the user, 30 Oct). */
export function pickSuggestions(all: Example[], n = 3): Example[] {
  const latest = shuffle(all.filter((e) => e.fresh));
  const known = shuffle(all.filter((e) => !e.fresh));
  return shuffle([...latest.slice(0, 1), ...known, ...latest.slice(1)].slice(0, n));
}

/** A fresh release as a suggestion: on its own (solo), or featured with one of the Ghost's artists (feat.). */
function freshExample(mode: "solo" | "feat", pool: Pool): Example | null {
  const artist = shuffle(readyFresh())[0];
  const moment = shuffle(pool.moments)[0];
  if (!artist || !moment) return null;
  if (mode === "solo") return { label: `${artist.name} · ${moment.label}`, brief: { artist: artist.name, spotifyId: artist.id, story: moment.story }, fresh: artist.name };
  const lead = shuffle(pool.examples.filter((e) => e.brief && key(e.brief.artist) !== key(artist.name)))[0]?.brief;
  if (!lead?.spotifyId) return null;
  return { label: `${lead.artist} feat. ${artist.name} · ${moment.label}`, brief: { artist: lead.artist, spotifyId: lead.spotifyId, story: moment.story, feat: { artist: artist.name, spotifyId: artist.id } }, fresh: artist.name };
}

/** Three suggestions for the mode; for solo and feat the fixed solo ones when the Ghost can't suggest any. */
export async function freshExamples(mode: ExampleMode = "solo"): Promise<Example[]> {
  if (mode === "remix") return pickSuggestions(await remixIdeas());
  const current = pools[mode];
  const pool = current && Date.now() - current.at <= POOL_MS ? current : { at: Date.now(), examples: mode === "feat" ? generatePairs() : generate() };
  if (pool !== current) {
    pools[mode] = pool;
    pool.examples.catch(() => {
      if (pools[mode] === pool) delete pools[mode];
    });
  }
  readyFresh();
  const ideas = await pool.examples.catch((e): Pool => {
    console.error(`${mode} examples failed`, e instanceof Error ? e.message : e);
    return { examples: EXAMPLE_BRIEFS, moments: EXAMPLE_BRIEFS.map((x) => ({ story: x.brief.story ?? "", label: x.label.split(" · ")[1] ?? "" })) };
  });
  const latest = freshExample(mode, ideas);
  return pickSuggestions(latest ? [...ideas.examples, latest] : ideas.examples);
}
