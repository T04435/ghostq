import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { EXAMPLE_BRIEFS, type Brief } from "@/lib/brief";
import { LANGUAGES } from "@/lib/place";
import { remixParams } from "@/lib/remix-params";
import { pickArtist } from "@/lib/qloo-parse";
import { MODELS } from "@/server/agent/models";
import { searchArtist } from "@/server/qloo/api";
import { searchSpotifyArtists } from "@/server/spotify/client";
import { listSongs } from "@/server/store/songs";

/**
 * A Ghost suggestion: a brief to fill in on Write, or (RemixQ) a link to a song's remix with the new crowd filled in.
 * `newToQloo` names the artist Qloo has no record of, whom NotOnQ fills from open data (the chip says so).
 */
export type Example = { label: string; brief: Brief; newToQloo?: string; href?: never } | { label: string; href: string; brief?: never; newToQloo?: never };
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
  newcomers: z
    .array(
      z.object({
        artist: z.string().describe("A real artist who broke out in the last two years or is still small, exactly as named on Spotify"),
        story: z.string().describe("What the song could be about: one everyday, specific moment in 4 to 9 words"),
        label: z.string().describe("The story in 2 to 5 lowercase words, for a chip"),
      }),
    )
    .describe("6 newcomers"),
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
  newcomers: z
    .array(
      z.object({
        artist: z.string().describe("A real, currently active music artist, exactly as named on Spotify"),
        feat: z.string().describe("A real artist who broke out in the last two years or is still small, exactly as named on Spotify"),
        story: z.string().describe("What the duet could be about: one everyday, specific moment in 4 to 9 words"),
        label: z.string().describe("The story in 2 to 4 lowercase words, for a chip"),
      }),
    )
    .describe("6 duets with a newcomer"),
});

const NEWCOMERS = "Also suggest 6 newcomers: real artists who broke out in the last two years or are still small (a few thousand to tens of thousands of listeners), likely too new for big music databases.";
/** How long the pool waits on NotOnQ for one newcomer: past it, the suggestion is a normal one or none. */
const NEW_CHECK_MS = 8_000;

const POOL_MS = 10 * 60 * 1000;
const pools: Partial<Record<"solo" | "feat", { at: number; examples: Promise<Example[]> }>> = {};

const key = (name: string) => name.trim().toLowerCase();

/** The exact Spotify artist for a suggested name, or null (the form needs a Spotify pick). */
async function pin(name: string): Promise<{ name: string; id: string } | null> {
  const match = (await searchSpotifyArtists(name).catch(() => [])).find((a) => key(a.name) === key(name));
  return match ? { name: match.name, id: match.id } : null;
}

/**
 * True only when NotOnQ answers that Qloo has no record of the artist and fills them (the user, 30 Oct: one suggestion
 * new to Qloo). Qloo knowing them, no fill, an error or no answer in time all count as not new: the label is never faked.
 */
async function newToQloo(name: string, spotifyId: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => (timer = setTimeout(() => resolve(undefined), NEW_CHECK_MS)));
  const match = await Promise.race([searchArtist(name).then((all) => pickArtist(all, name, spotifyId)), timeout])
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
  return match?.notonq?.kind === "filled";
}

/**
 * Fresh "Try" examples for the Write page (the user, 26 Oct): artists the Library has no song for yet, so the examples
 * don't keep writing the same songs. The Ghost suggests 8 varied artists and moments (one model call), each is pinned
 * to its Spotify artist (an exact name match, as the form requires), and the pool is kept for 10 minutes per instance.
 */
async function generate(): Promise<Example[]> {
  const library = await listSongs().catch(() => []);
  const taken = new Set(library.flatMap((s) => [s.artist, ...(s.featuring ? [s.featuring] : [])]).map(key));
  const { output } = await generateText({
    model: MODELS.agent,
    output: Output.object({ schema: ideas }),
    maxOutputTokens: 1200,
    abortSignal: AbortSignal.timeout(30_000),
    prompt: [
      "Suggest 8 examples for a songwriting app: a real music artist and a small everyday moment the song could be about.",
      `Mix genres, countries and eras, and artists who sing in these languages: ${LANGUAGES.join(", ")}. Some well known, some cult.`,
      NEWCOMERS,
      "Don't suggest any of these artists (they already have songs):",
      [...taken].join(", ") || "(none)",
    ].join("\n"),
  });
  const picked = await Promise.all(
    output.examples
      .filter((e) => !taken.has(key(e.artist)))
      .map(async (e): Promise<Example | null> => {
        const match = (await searchSpotifyArtists(e.artist).catch(() => [])).find((a) => key(a.name) === key(e.artist));
        return match && !taken.has(key(match.name)) ? { label: `${match.name} · ${e.label}`, brief: { artist: match.name, spotifyId: match.id, story: e.story } } : null;
      }),
  );
  const fresh = await Promise.all(
    (output.newcomers ?? [])
      .filter((e) => !taken.has(key(e.artist)))
      .map(async (e): Promise<Example | null> => {
        const match = await pin(e.artist);
        if (!match || taken.has(key(match.name)) || !(await newToQloo(match.name, match.id))) return null;
        return { label: `${match.name} · ${e.label}`, brief: { artist: match.name, spotifyId: match.id, story: e.story }, newToQloo: match.name };
      }),
  );
  const examples = picked.filter((e): e is Example => e !== null);
  if (examples.length < 2) throw new Error("too few examples");
  return [...examples, ...fresh.filter((e): e is Example => e !== null)];
}

/**
 * CollabQ pairs for "Write a feat." (the user, 27 Oct): two real artists who'd make a believable duet, at least one of
 * them without a song in the Library, both pinned on Spotify.
 */
async function generatePairs(): Promise<Example[]> {
  const library = await listSongs().catch(() => []);
  const taken = new Set(library.flatMap((s) => [s.artist, ...(s.featuring ? [s.featuring] : [])]).map(key));
  const { output } = await generateText({
    model: MODELS.agent,
    output: Output.object({ schema: pairs }),
    maxOutputTokens: 1400,
    abortSignal: AbortSignal.timeout(30_000),
    prompt: [
      "Suggest 8 duets for a songwriting app: two real music artists whose crowds would meet in one song, and a small everyday moment it could be about.",
      `Mix genres, countries and eras, and artists who sing in these languages: ${LANGUAGES.join(", ")}. Pairs can cross genres or countries; some well known, some cult.`,
      `${NEWCOMERS} Pair each newcomer, as the featured artist, with an artist whose crowd would meet theirs.`,
      "At least one artist in each pair must not be one of these (they already have songs):",
      [...taken].join(", ") || "(none)",
    ].join("\n"),
  });
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
  const fresh = await Promise.all(
    (output.newcomers ?? [])
      .filter((e) => key(e.artist) !== key(e.feat) && !taken.has(key(e.feat)))
      .map(async (e): Promise<Example | null> => {
        const [a, b] = await Promise.all([pin(e.artist), pin(e.feat)]);
        if (!a || !b || a.id === b.id || !(await newToQloo(b.name, b.id))) return null;
        return { label: `${a.name} feat. ${b.name} · ${e.label}`, brief: { artist: a.name, spotifyId: a.id, story: e.story, feat: { artist: b.name, spotifyId: b.id } }, newToQloo: b.name };
      }),
  );
  const examples = picked.filter((e): e is Example => e !== null);
  if (examples.length < 2) throw new Error("too few pairs");
  return [...examples, ...fresh.filter((e): e is Example => e !== null)];
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

const shuffle = <T>(all: T[]) => [...all].sort(() => Math.random() - 0.5);

/** Three suggestions at random, one of them new to Qloo when the pool has one (the user, 30 Oct). */
export function pickSuggestions(all: Example[], n = 3): Example[] {
  const fresh = shuffle(all.filter((e) => e.newToQloo));
  const known = shuffle(all.filter((e) => !e.newToQloo));
  return shuffle([...fresh.slice(0, 1), ...known, ...fresh.slice(1)].slice(0, n));
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
  const all = await pool.examples.catch((e) => {
    console.error(`${mode} examples failed`, e instanceof Error ? e.message : e);
    return EXAMPLE_BRIEFS;
  });
  return pickSuggestions(all);
}
