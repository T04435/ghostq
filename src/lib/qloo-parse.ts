import { z } from "zod";

/** Response shapes seen in the day-1 probes (research/qloo-probes.md). Unknown fields are ignored. */

// Some tags come back without a name (live, 21 Oct): parse them as optional and drop them.
const tagRef = z.object({ id: z.string().optional(), tag_id: z.string().optional(), name: z.string().optional(), type: z.string().optional() });

/** Spotify id: under properties.external on /search, top-level external on insights. Its shape varies (an object, a list, other fields), so it's read leniently. */
const external = z.object({ spotify: z.unknown(), musicbrainz: z.unknown(), wikidata: z.unknown() }).partial();

function idsOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((x) => (x && typeof x === "object" && "id" in x && typeof x.id === "string" ? [x.id] : []));
}

const entity = z.object({
  entity_id: z.string(),
  properties: z.object({ external: external.optional(), short_description: z.string().nullable().optional() }).partial().optional(),
  external: external.optional(),
  name: z.string(),
  popularity: z.number().optional(),
  tags: z.array(tagRef).optional().default([]),
  query: z.object({ affinity: z.number().optional() }).partial().optional(),
});

export type QlooEntity = {
  id: string;
  name: string;
  popularity: number | null;
  affinity: number | null;
  tags: { id: string; name: string; type: string }[];
  spotifyIds: string[];
  /** MusicBrainz artist id, for the voice match (server/musicbrainz.ts). */
  musicbrainzId: string | null;
  /** Qloo's one-line description ("Lorde is a New Zealand singer-songwriter…"): where the artist is from, for now. */
  description?: string | null;
  /** Wikidata id (Q…): the artist's Wikipedia article, for how they sing (server/vocal-style.ts). */
  wikidataId?: string | null;
};

function toEntity(e: z.infer<typeof entity>): QlooEntity {
  return {
    id: e.entity_id,
    name: e.name,
    popularity: e.popularity ?? null,
    affinity: e.query?.affinity ?? null,
    spotifyIds: [...idsOf(e.properties?.external?.spotify), ...idsOf(e.external?.spotify)],
    musicbrainzId: [...idsOf(e.properties?.external?.musicbrainz), ...idsOf(e.external?.musicbrainz)][0] ?? null,
    description: e.properties?.short_description ?? null,
    // Qloo writes it in lower case ("q13476175"); Wikidata's ids are "Q…".
    wikidataId: [...idsOf(e.properties?.external?.wikidata), ...idsOf(e.external?.wikidata)][0]?.toUpperCase() ?? null,
    tags: e.tags.flatMap((t) => (t.name && (t.id ?? t.tag_id) ? [{ id: (t.id ?? t.tag_id)!, name: t.name, type: t.type ?? "" }] : [])),
  };
}

/** A name for comparing: lower case, no accents or punctuation, no leading "the". */
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

/**
 * The search result for this artist: the one Qloo links to the Spotify pick, else one whose name matches (exactly, or
 * one name containing the other, 5+ letters). Never just the top result: a made-up "Zorvex Halloway Ensemble" got
 * "Disco Ensemble" that way (22 Oct). No match means Qloo doesn't know the artist, and the run asks.
 */
export function pickArtist(results: QlooEntity[], name: string, spotifyId?: string): QlooEntity | undefined {
  const byId = spotifyId ? results.find((r) => r.spotifyIds.includes(spotifyId)) : undefined;
  if (byId) return byId;
  const want = nameKey(name);
  const exact = results.find((r) => nameKey(r.name) === want);
  if (exact) return exact;
  // With a Spotify pick, only that id or the exact name counts: "Yomil" once matched the duo "Yomil y El Dany" (25 Oct).
  if (spotifyId) return undefined;
  return results.find((r) => {
    const got = nameKey(r.name);
    const [short, long] = got.length < want.length ? [got, want] : [want, got];
    return short.length >= 5 && ` ${long} `.includes(` ${short} `);
  });
}

/** GET /search */

export function parseSearch(json: unknown): QlooEntity[] {
  const parsed = z.object({ results: z.array(entity).default([]) }).parse(json);
  return parsed.results.map(toEntity);
}

/** GET /v2/insights with an entity filter.type */
export function parseEntities(json: unknown): QlooEntity[] {
  const parsed = z.object({ results: z.object({ entities: z.array(entity).default([]) }) }).parse(json);
  return parsed.results.entities.map(toEntity);
}

export type QlooTag = { id: string; name: string; affinity: number | null; popularity: number | null };

/** GET /v2/insights?filter.type=urn:tag and GET /v2/tags (semantic search) */
export function parseTags(json: unknown): QlooTag[] {
  const parsed = z
    .object({
      results: z.object({
        tags: z
          .array(
            z.object({
              id: z.string().optional(),
              tag_id: z.string().optional(),
              name: z.string(),
              popularity: z.number().optional(),
              query: z.object({ affinity: z.number().optional() }).partial().optional(),
            }),
          )
          .default([]),
      }),
    })
    .parse(json);
  return parsed.results.tags
    .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name, affinity: t.query?.affinity ?? null, popularity: t.popularity ?? null }))
    .filter((t) => t.id);
}

/** A compared tag: its kind (theme, style, genre…), and how strongly both crowds share it, or one crowd's count. */
export type ComparedTag = { id: string; name: string; kind: "theme" | "style" | "genre" | "other"; score: number | null };
export type Comparison = { shared: ComparedTag[]; onlyA: ComparedTag[]; onlyB: ComparedTag[] };

const comparedTag = z.object({
  tag_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string(),
  subtype: z.string().optional(),
  query: z.object({ score: z.number().optional(), count: z.union([z.string(), z.number()]).optional() }).partial().optional(),
});

function tagKind(subtype = ""): ComparedTag["kind"] {
  if (subtype.startsWith("urn:tag:theme")) return "theme";
  if (subtype.startsWith("urn:tag:style")) return "style";
  if (subtype.startsWith("urn:tag:genre")) return "genre";
  return "other";
}

/**
 * GET /v2/analysis/compare with one artist a side, filter.type=urn:tag (probed 23 Oct, Lorde vs Troye Sivan: 200,
 * 48 KB). `tags` is what both crowds share, each with a similarity score; `a` and `b` are what only one side has,
 * each with a count (a string).
 */
export function parseCompare(json: unknown): Comparison {
  const list = z.array(comparedTag).default([]);
  const parsed = z.object({ results: z.object({ tags: list, a: list, b: list }) }).parse(json);
  const map = (t: z.infer<typeof comparedTag>, score: "score" | "count"): ComparedTag => ({
    id: t.tag_id ?? t.id ?? "",
    name: t.name.trim(),
    kind: tagKind(t.subtype),
    score: score === "score" ? (t.query?.score ?? null) : t.query?.count !== undefined ? Number(t.query.count) : null,
  });
  return {
    shared: parsed.results.tags.map((t) => map(t, "score")).filter((t) => t.id),
    onlyA: parsed.results.a.map((t) => map(t, "count")).filter((t) => t.id),
    onlyB: parsed.results.b.map((t) => map(t, "count")).filter((t) => t.id),
  };
}

export type Demographics = { age: Record<string, number>; gender: Record<string, number> };

/** GET /v2/insights?filter.type=urn:demographics. Small acts come back empty (probe 3b). */
export function parseDemographics(json: unknown): Demographics | null {
  const parsed = z
    .object({
      results: z.object({
        demographics: z
          .array(z.object({ query: z.object({ age: z.record(z.string(), z.number()).optional(), gender: z.record(z.string(), z.number()).optional() }) }))
          .default([]),
      }),
    })
    .parse(json);
  const first = parsed.results.demographics[0];
  if (!first?.query.age && !first?.query.gender) return null;
  return { age: first.query.age ?? {}, gender: first.query.gender ?? {} };
}

/** Genre tags for a city carry noise such as "Drag Race" (probe 4d): keep music genres only. */
export function isMusicGenre(tagId: string): boolean {
  return tagId.startsWith("urn:tag:genre:music:");
}

/** GET /v2/insights?filter.type=urn:heatmap: geohash cells with affinity (probe 21 Oct). */
export function parseHeatmap(json: unknown): { geohash: string; affinity: number; popularity: number }[] {
  const parsed = z
    .object({
      results: z.object({
        heatmap: z
          .array(z.object({ location: z.object({ geohash: z.string() }), query: z.object({ affinity: z.number(), popularity: z.number().optional() }) }))
          .default([]),
      }),
    })
    .parse(json);
  return parsed.results.heatmap.map((c) => ({ geohash: c.location.geohash, affinity: c.query.affinity, popularity: c.query.popularity ?? 0 }));
}
