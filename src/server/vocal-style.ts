import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { MODELS } from "@/server/agent/models";

/**
 * How the artist sings, from their Wikipedia article: found by Qloo's own Wikidata id (never by name), the sentences
 * about their voice are condensed into a few words of technique (register, timbre, delivery) that never name or compare
 * to anyone. Wikipedia is CC BY-SA, so the receipt links the article. English first, then the artist's own language.
 * Wikimedia's API policy: an identifying User-Agent, modest use; results are cached per instance.
 */
const USER_AGENT = "GhostQ/1.0 (https://ghostq.xyz)";
const WIKI: Record<string, string> = { English: "en", Spanish: "es", Portuguese: "pt", French: "fr", German: "de", Japanese: "ja", Korean: "ko", Hindi: "hi" };

/** Words that mark a sentence about singing, in the languages GhostQ writes in. */
const VOICE =
  /\b(voice|vocals?|vocalist|sings?|sang|singing|rap(?:s|ped|ping|per)?|flow|delivery|timbre|contralto|soprano|mezzo|alto|baritone|tenor|bass-baritone|falsetto|register|croon\w*|whisper\w*|breathy|raspy|husky|belt\w*|melisma\w*|spoken|voz|canta\w*|rapea\w*|cantante|voix|chante\w*|Stimme|singt|Gesang)\b|声|歌声|ボーカル|목소리|보컬|음색|आवाज़|गायन/iu;

export type VocalStyle = { delivery: string; url: string };

const cache = new Map<string, Promise<VocalStyle | null>>();

async function get(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikimedia returned ${res.status}`);
  return res.json();
}

/** The sentences of an article that talk about singing, up to ~1,800 characters. */
async function voiceSentences(wiki: string, title: string): Promise<string> {
  const q = new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", titles: title, redirects: "1", format: "json" });
  const data = (await get(`https://${wiki}.wikipedia.org/w/api.php?${q}`)) as { query?: { pages?: Record<string, { extract?: string }> } };
  const text = Object.values(data.query?.pages ?? {})[0]?.extract ?? "";
  const sentences = text.split(/(?<=[.!?。])\s+/).filter((s) => VOICE.test(s));
  let out = "";
  for (const s of sentences) {
    if (out.length + s.length > 1800) break;
    out += `${s} `;
  }
  return out.trim();
}

const summary = z.object({
  delivery: z
    .string()
    .nullable()
    .describe("How this musician sings or raps, in at most 25 plain words of technique: register, timbre, delivery, phrasing, production on the voice. Null when the text doesn't say."),
});

async function read(wikidataId: string, language: string): Promise<VocalStyle | null> {
  const wikis = [...new Set(["en", WIKI[language] ?? "en"])];
  const q = new URLSearchParams({ action: "wbgetentities", ids: wikidataId, props: "sitelinks", sitefilter: wikis.map((w) => `${w}wiki`).join("|"), format: "json" });
  const entity = ((await get(`https://www.wikidata.org/w/api.php?${q}`)) as { entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> }).entities?.[wikidataId];
  for (const wiki of wikis) {
    const title = entity?.sitelinks?.[`${wiki}wiki`]?.title;
    if (!title) continue;
    const sentences = await voiceSentences(wiki, title);
    if (!sentences) continue;
    const { output } = await generateText({
      model: MODELS.agent,
      output: Output.object({ schema: summary }),
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(30_000),
      prompt: `Sentences from a Wikipedia article about a musician:\n\n${sentences}\n\nDescribe how this musician sings or raps, in English, in at most 25 words: register and range, timbre, delivery (sung, rapped, spoken), phrasing, and how the voice is produced or layered. Use technique words only. Never name the musician or any person, band, song or album, and never compare them to anyone ("like", "in the style of"). Ignore sentences about vocal coaches, awards or albums with "Vocal" in the name. If the sentences say nothing about how they sing, return null.`,
    });
    const delivery = output.delivery?.trim();
    if (delivery) return { delivery, url: `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` };
  }
  return null;
}

/** The artist's vocal style, or null when Qloo has no Wikidata id, Wikipedia says nothing, or anything fails. */
export function vocalStyle(wikidataId: string | null | undefined, language: string): Promise<VocalStyle | null> {
  if (!wikidataId || !/^Q\d+$/.test(wikidataId) || process.env.WIKIPEDIA_OFF === "1") return Promise.resolve(null);
  const key = `${wikidataId}:${language}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const value = read(wikidataId, language).catch((e) => {
    console.error("vocal style failed", e instanceof Error ? e.message : e);
    return null;
  });
  cache.set(key, value);
  return value;
}
