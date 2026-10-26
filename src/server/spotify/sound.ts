import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { MODELS } from "@/server/agent/models";
import type { Catalogue } from "./client";

const sound = z.object({
  sound: z
    .string()
    .nullable()
    .describe('The artist\'s genres in a few plain words, as the titles show them (e.g. "Cuban reggaeton, afro house, urban pop"). Null when the titles give no clear sign.'),
});

/**
 * F2: an artist Qloo doesn't know, described from their Spotify catalogue (release and track titles, years). The model
 * names the genres the titles point to (remix tags like "Afro House Version", genre words, language) and says null
 * rather than guess, so the run can still ask for the sound.
 */
export async function soundFromCatalogue(artist: string, catalogue: Catalogue): Promise<string | null> {
  if (!catalogue.releases.length && !catalogue.tracks.length) return null;
  const { output } = await generateText({
    model: MODELS.agent,
    output: Output.object({ schema: sound }),
    maxOutputTokens: 300,
    abortSignal: AbortSignal.timeout(30_000),
    prompt: [
      `The music artist "${artist}" on Spotify. Their latest releases and track titles are below. Name their genres only as far as these titles show them; give null if they don't.`,
      "",
      "Releases:",
      ...catalogue.releases.map((r) => `- ${r.name} (${r.type}, ${r.year})`),
      "",
      "Tracks:",
      ...catalogue.tracks.map((t) => `- ${t}`),
    ].join("\n"),
  });
  return output.sound?.trim() || null;
}
