import "server-only";
import type { AgeBand } from "@/lib/brief";
import { geohashPolygon } from "@/lib/geohash";
import { countryCodeFor, type Place } from "@/lib/place";
import { parseCompare, parseDemographics, parseEntities, parseHeatmap, parseSearch, parseTags, type QlooEntity } from "@/lib/qloo-parse";
import { qlooGet, type CallLog, type QlooParams } from "./client";

/** A Qloo crowd signal. No place: taste worldwide; no ages: all ages. */
export type CrowdSignal = { place: Place | null; ages: AgeBand[] };
export type OnCall = (log: CallLog) => void;

const RADIUS_M = 15_000;

function crowdParams({ place, ages }: CrowdSignal): QlooParams {
  const p = place;
  return {
    "signal.location": p ? `POINT(${p.lon} ${p.lat})` : undefined,
    "signal.location.radius": p ? RADIUS_M : undefined,
    "signal.demographics.age": ages.length ? ages.join(",") : undefined,
  };
}

export async function searchArtist(name: string, onCall?: OnCall): Promise<QlooEntity[]> {
  return parseSearch(await qlooGet("/search", { query: name, types: "urn:entity:artist", take: 5 }, onCall));
}

/** "My sound is…" words to music genre tags. Plain search needs the whole phrase to match, so semantic search (probe 5b). */
export async function genresFromWords(words: string, onCall?: OnCall) {
  return parseTags(
    await qlooGet("/v2/tags", { "filter.query": words, "filter.tag.types": "urn:tag:genre:music", "feature.semantic_search": true, take: 8 }, onCall),
  );
}

/** Artists like this one. Some entities found by search are invalid as signals (probe 2c): that's a 400. */
export async function soundAlikes(entityId: string, onCall?: OnCall) {
  return parseEntities(await qlooGet("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": entityId, take: 10 }, onCall));
}

/** Artists by genre tags, no location: location swamps tags (probe 5d), so rescore by crowd after. */
export async function artistsByTags(tagIds: string[], onCall?: OnCall) {
  return parseEntities(await qlooGet("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.tags": tagIds.join(","), take: 10 }, onCall));
}

export async function artistDemographics(entityId: string, onCall?: OnCall) {
  return parseDemographics(await qlooGet("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": entityId }, onCall));
}

/** Tags this crowd over-indexes on: theme (lyric subjects), style, or music genre. Optional act signal blends the act's fans in. */
export async function crowdTags(kind: "theme" | "style" | "genre", crowd: CrowdSignal, actEntityId: string | undefined, onCall?: OnCall) {
  const type = { theme: "urn:tag:theme:qloo", style: "urn:tag:style:qloo", genre: "urn:tag:genre:music" }[kind];
  return parseTags(
    await qlooGet(
      "/v2/insights",
      { "filter.type": "urn:tag", "filter.tag.types": type, ...crowdParams(crowd), "signal.interests.entities": actEntityId, take: 15 },
      onCall,
    ),
  );
}

/** Step 2 of the local-scene query: artists in these genres, for this crowd, optionally near the act (probes 4e, 4f). */
export async function sceneArtists(genreTagIds: string[], crowd: CrowdSignal, actEntityId: string | undefined, onCall?: OnCall) {
  return parseEntities(
    await qlooGet(
      "/v2/insights",
      { "filter.type": "urn:entity:artist", "filter.tags": genreTagIds.join(","), ...crowdParams(crowd), "signal.interests.entities": actEntityId, take: 10 },
      onCall,
    ),
  );
}

/** Films and books this crowd loves, for lyric imagery (probes 6a, 6b). */
export async function crowdTaste(type: "movie" | "book", crowd: CrowdSignal, onCall?: OnCall) {
  return parseEntities(await qlooGet("/v2/insights", { "filter.type": `urn:entity:${type}`, ...crowdParams(crowd), take: 10 }, onCall));
}

/** Lifestyle audiences of the act's fans (probe 7a). */
export async function fanAudiences(entityId: string, onCall?: OnCall) {
  return parseEntities(await qlooGet("/v2/insights", { "filter.type": "urn:audience", "signal.interests.entities": entityId, take: 8 }, onCall));
}

/** Re-order a shortlist by fit with this crowd (probe 9). */
export async function rescoreForCrowd(entityIds: string[], crowd: CrowdSignal, onCall?: OnCall) {
  return parseEntities(
    await qlooGet("/v2/insights", { "filter.type": "urn:entity:artist", "filter.results.entities": entityIds.join(","), ...crowdParams(crowd), take: entityIds.length }, onCall),
  );
}

/**
 * Where in the world the artist's fans' taste is strongest. Grouping by locality returned 167 MB (every
 * boundary polygon); the default geohash cells over the whole world are about 170 KB in 8–9 s.
 */
export async function fanHeatmap(entityId: string, onCall?: OnCall) {
  return parseHeatmap(
    await qlooGet(
      "/v2/insights",
      { "filter.type": "urn:heatmap", "signal.interests.entities": entityId, "filter.location": "POLYGON((-179 -60, 179 -60, 179 75, -179 75, -179 -60))" },
      onCall,
    ),
  );
}

/** The fans' heatmap inside one world cell (about 150 km square): small cells (precision ~6) that find the hotspot. 270 KB, ~3.5 s (22 Oct). */
export async function zoomedHeatmap(entityId: string, worldCell: string, onCall?: OnCall) {
  return parseHeatmap(
    await qlooGet("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": entityId, "filter.location": geohashPolygon(worldCell) }, onCall),
  );
}

/** Cities by name, from Qloo's locality search (43 KB, under 2 s for "Havana", 22 Oct). Biggest first. */
export async function searchLocalities(query: string, onCall?: OnCall): Promise<(Place & { population: number | null })[]> {
  const json = (await qlooGet("/search", { query, types: "urn:entity:locality", take: 8 }, onCall)) as {
    results?: { name?: string; disambiguation?: string; location?: { lat?: number; lon?: number }; properties?: { population?: number } }[];
  };
  return (json.results ?? [])
    .filter((r) => r.name && typeof r.location?.lat === "number" && typeof r.location?.lon === "number")
    .map((r) => {
      const country = (r.disambiguation ?? "").split(",").at(-1)?.trim() ?? "";
      return { name: r.name!, country, countryCode: countryCodeFor(country), lat: r.location!.lat!, lon: r.location!.lon!, population: r.properties?.population ?? null };
    })
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
}

/** CollabQ: what two artists' crowds share, and what only one has. One artist a side keeps it small (14–48 KB). */
export async function compareArtists(aEntityId: string, bEntityId: string, onCall?: OnCall) {
  return parseCompare(
    await qlooGet("/v2/analysis/compare", { "a.signal.interests.entities": aEntityId, "b.signal.interests.entities": bEntityId, "filter.type": "urn:tag" }, onCall),
  );
}
