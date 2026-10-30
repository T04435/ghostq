import { z } from "zod";

/** Response shapes seen in the day-1 probes (research/qloo-probes.md). Unknown fields are ignored. */

// Some tags come back without a name (live, 21 Oct): parse them as optional and drop them.
const tagRef = z.object({ id: z.string().optional(), tag_id: z.string().optional(), name: z.string().optional(), type: z.string().optional() });

/** Spotify id: under properties.external on /search, top-level external on insights. Its shape varies (an object, a list, other fields), so it's read leniently. */
const external = z.object({ spotify: z.unknown(), musicbrainz: z.unknown(), wikidata: z.unknown(), "notonq:musicbrainz": z.unknown(), "notonq:wikidata": z.unknown() }).partial();

function idsOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((x) => (x && typeof x === "object" && "id" in x && typeof x.id === "string" ? [x.id] : []));
}

/** Where the artist is from: on artists NotOnQ filled, and (v0.6.0 on) on thin Qloo records that don't say. */
const notonqHome = z.object({ name: z.string(), country: z.string().optional(), country_code: z.string().optional() });
/** The languages of a thin Qloo record's releases, most used first (NotOnQ v0.6.0 on). */
const notonqLanguages = z.array(z.object({ code: z.string().optional(), name: z.string(), releases: z.number().optional() }));
/** The similar artists Qloo knows that answer for an artist NotOnQ filled, in order (NotOnQ v0.4.3 on). */
const notonqStandIns = z.array(z.object({ entity_id: z.string().optional(), name: z.string() }));

const entity = z.object({
  entity_id: z.string(),
  properties: z
    .object({
      external: external.optional(),
      short_description: z.string().nullable().optional(),
      "notonq:home": notonqHome.optional(),
      "notonq:standIns": notonqStandIns.optional(),
      "notonq:languages": notonqLanguages.optional(),
    })
    .partial()
    .optional(),
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
  /** `notonq`: a genre NotOnQ added from open data because Qloo's record has none. */
  tags: { id: string; name: string; type: string; notonq?: true }[];
  spotifyIds: string[];
  /** MusicBrainz artist id, for the voice match (server/musicbrainz.ts). */
  musicbrainzId: string | null;
  /** Qloo's one-line description ("Lorde is a New Zealand singer-songwriter…"): where the artist is from, for now. */
  description?: string | null;
  /** Wikidata id (Q…): the artist's Wikipedia article, for how they sing (server/vocal-style.ts). */
  wikidataId?: string | null;
  /**
   * Set when the record came from NotOnQ (GhostQ's Qloo data goes through it): "filled" for an artist Qloo has no
   * record of, built from open data; "picked" or "matched" for Qloo's own record that NotOnQ chose for this request;
   * "candidate" for a possible match NotOnQ offers when it can't tell which artist it is (filled only once chosen, by
   * its id on /entities).
   */
  notonq?: { kind: NotOnQKind; standIns: string[]; home: { name: string; country: string | null; countryCode: string | null } | null } | null;
  /**
   * What NotOnQ filled in on a thin Qloo record (no MusicBrainz id, Wikidata id or genre tag; v0.6.0 on): where the
   * artist is from, the languages of their releases (most used first), and which ids are NotOnQ's. Null when none.
   */
  gaps?: { home: { name: string; country: string | null; countryCode: string | null } | null; languages: string[]; musicbrainzId: boolean; wikidataId: boolean } | null;
};

/** How a taste answer about an artist NotOnQ filled was made: Qloo, through the similar artists Qloo knows. */
export const throughStandIns = (x: { act?: Pick<QlooEntity, "notonq"> | null }) =>
  x.act?.notonq?.kind === "filled" ? ` (through similar artists Qloo knows${x.act.notonq.standIns.length ? `: ${x.act.notonq.standIns.join(", ")}` : ""}; via NotOnQ)` : "";

/**
 * What NotOnQ did with a record, from its structured answer only (the user, 31 Oct: never from the description text):
 * its block keyed by the record's id in the response's `notonq` object, `{ kind: "filled" | "candidate" | "picked" |
 * "matched" | "gaps", proxy: { stand_ins } }`. "gaps": Qloo's own record, with fields NotOnQ added (notonq:-prefixed). "unknown": NotOnQ answered (`served_by` isn't "qloo") but keyed no record, as
 * an older NotOnQ did, so nothing says which result is Qloo's: its signals are "other", never Qloo's by guess.
 */
export type NotOnQKind = "filled" | "picked" | "matched" | "candidate" | "gaps" | "unknown";
const KINDS = new Set(["filled", "picked", "matched", "candidate", "gaps"]);
type Top = Record<string, unknown> | undefined;
type Block = { kind?: string; proxy?: { stand_ins?: { name?: string }[] } };

const blockOf = (top: Top, id: string): Block | undefined => {
  const b = top?.[id];
  return b && typeof b === "object" && KINDS.has((b as Block).kind ?? "") ? (b as Block) : undefined;
};
const keysAny = (top: Top) => Object.keys(top ?? {}).some((k) => blockOf(top, k));
/** NotOnQ answered this request itself (fully or in part), as opposed to passing Qloo's answer through. */
const notonqAnswered = (top: Top) => typeof top?.served_by === "string" && top.served_by !== "qloo";

export function notonqOf(top: Top, id: string, home?: z.infer<typeof notonqHome>, listed?: z.infer<typeof notonqStandIns>): QlooEntity["notonq"] {
  const block = blockOf(top, id);
  const kind: NotOnQKind | null = block ? (block.kind as NotOnQKind) : notonqAnswered(top) && !keysAny(top) ? "unknown" : null;
  if (!kind) return null;
  const names = listed?.length ? listed.map((x) => x.name) : (block?.proxy?.stand_ins ?? []).map((x) => x.name ?? "");
  return { kind, standIns: names.map((n) => n.trim()).filter(Boolean), home: home ? { name: home.name, country: home.country ?? null, countryCode: home.country_code ?? null } : null };
}

/** NotOnQ marks a genre it added as "notonq:urn:tag:genre:…": the Qloo tag id is the rest. */
const NOTONQ_TAG = "notonq:";

function toEntity(e: z.infer<typeof entity>, top?: Top): QlooEntity {
  const ext = { ...e.external, ...e.properties?.external };
  const musicbrainz = [...idsOf(e.properties?.external?.musicbrainz), ...idsOf(e.external?.musicbrainz)][0];
  const wikidata = [...idsOf(e.properties?.external?.wikidata), ...idsOf(e.external?.wikidata)][0];
  // Qloo's own ids first; NotOnQ's only where Qloo has none.
  const mbGap = musicbrainz ? undefined : idsOf(ext["notonq:musicbrainz"])[0];
  const wdGap = wikidata ? undefined : idsOf(ext["notonq:wikidata"])[0];
  const notonq = notonqOf(top, e.entity_id, e.properties?.["notonq:home"], e.properties?.["notonq:standIns"]);
  const home = notonq?.kind === "filled" ? undefined : e.properties?.["notonq:home"];
  const languages = (e.properties?.["notonq:languages"] ?? []).map((l) => l.name.trim()).filter(Boolean);
  return {
    id: e.entity_id,
    name: e.name,
    popularity: e.popularity ?? null,
    affinity: e.query?.affinity ?? null,
    spotifyIds: [...idsOf(e.properties?.external?.spotify), ...idsOf(e.external?.spotify)],
    musicbrainzId: musicbrainz ?? mbGap ?? null,
    description: e.properties?.short_description ?? null,
    // Qloo writes it in lower case ("q13476175"); Wikidata's ids are "Q…".
    wikidataId: (wikidata ?? wdGap)?.toUpperCase() ?? null,
    notonq,
    gaps:
      home || languages.length || mbGap || wdGap
        ? { home: home ? { name: home.name, country: home.country ?? null, countryCode: home.country_code ?? null } : null, languages, musicbrainzId: Boolean(mbGap), wikidataId: Boolean(wdGap) }
        : null,
    tags: e.tags.flatMap((t) => {
      const raw = t.id ?? t.tag_id;
      if (!t.name || !raw) return [];
      const added = raw.startsWith(NOTONQ_TAG);
      const id = added ? raw.slice(NOTONQ_TAG.length) : raw;
      // NotOnQ's genres may come without a type: the id says it.
      const type = t.type ?? (added && id.startsWith("urn:tag:genre") ? "urn:tag:genre:music" : "");
      return [{ id, name: t.name, type, ...(added ? { notonq: true as const } : {}) }];
    }),
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
export function pickArtist(all: QlooEntity[], name: string, spotifyId?: string): QlooEntity | undefined {
  // NotOnQ's candidates are for the user to choose from, never picked here.
  const results = all.filter((r) => r.notonq?.kind !== "candidate");
  const byId = spotifyId ? results.find((r) => r.spotifyIds.includes(spotifyId)) : undefined;
  if (byId) return byId;
  // Named exactly as asked, punctuation included, before a match that ignores it: NotOnQ lists its fill of "ANORAK!"
  // after Qloo's "Anorak", another band (29 Oct).
  const literal = (n: string) => n.normalize("NFC").trim().toLowerCase();
  const asked = results.find((r) => literal(r.name) === literal(name));
  if (asked) return asked;
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
  const parsed = z.object({ results: z.array(entity).default([]), notonq: topSchema }).parse(json);
  return parsed.results.map((e) => toEntity(e, parsed.notonq));
}

/** GET /v2/insights with an entity filter.type */
/** The response's `notonq` object, when NotOnQ answered (GhostQ reads Qloo through it). */
const topSchema = z.record(z.string(), z.unknown()).optional();

export function parseEntities(json: unknown): QlooEntity[] {
  const parsed = z.object({ results: z.object({ entities: z.array(entity).default([]) }), notonq: topSchema }).parse(json);
  return parsed.results.entities.map((e) => toEntity(e, parsed.notonq));
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

export type Demographics = {
  age: Record<string, number>;
  gender: Record<string, number>;
  /** NotOnQ answered with the audience of these music genres (its similar artists' genres), not the artist's own. */
  genres?: string[];
};

/** GET /v2/insights?filter.type=urn:demographics. Small acts come back empty (probe 3b). */
export function parseDemographics(json: unknown): Demographics | null {
  const parsed = z
    .object({
      results: z.object({
        demographics: z
          .array(
            z.object({
              query: z.object({ age: z.record(z.string(), z.number()).optional(), gender: z.record(z.string(), z.number()).optional() }),
              "notonq:basis": z.object({ genres: z.array(z.string()).optional() }).partial().optional(),
            }),
          )
          .default([]),
      }),
    })
    .parse(json);
  const first = parsed.results.demographics[0];
  if (!first?.query.age && !first?.query.gender) return null;
  const genres = first["notonq:basis"]?.genres?.map((g) => g.split(":").pop()!).filter(Boolean);
  return { age: first.query.age ?? {}, gender: first.query.gender ?? {}, ...(genres?.length ? { genres } : {}) };
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
