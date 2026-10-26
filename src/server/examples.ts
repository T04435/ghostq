import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { EXAMPLE_BRIEFS, type Brief } from "@/lib/brief";
import { LANGUAGES } from "@/lib/place";
import { MODELS } from "@/server/agent/models";
import { searchSpotifyArtists } from "@/server/spotify/client";
import { listSongs } from "@/server/store/songs";

export type Example = { label: string; brief: Brief };

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
});

const POOL_MS = 10 * 60 * 1000;
let pool: { at: number; examples: Promise<Example[]> } | null = null;

const key = (name: string) => name.trim().toLowerCase();

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
  const examples = picked.filter((e): e is Example => e !== null);
  if (examples.length < 2) throw new Error("too few examples");
  return examples;
}

/** Two examples from the pool, at random; the fixed pair when the Ghost can't suggest any. */
export async function freshExamples(): Promise<Example[]> {
  if (!pool || Date.now() - pool.at > POOL_MS) {
    const examples = generate();
    pool = { at: Date.now(), examples };
    examples.catch(() => {
      pool = null;
    });
  }
  const all = await pool.examples.catch((e) => {
    console.error("examples failed", e instanceof Error ? e.message : e);
    return EXAMPLE_BRIEFS;
  });
  return [...all].sort(() => Math.random() - 0.5).slice(0, 2);
}
