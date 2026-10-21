import "server-only";
import { PLACES, type AgeBand, type PlaceId } from "@/lib/brief";
import { parseDemographics, parseEntities, parseHeatmap, parseSearch, parseTags, type QlooEntity } from "@/lib/qloo-parse";
import { qlooGet, type CallLog, type QlooParams } from "./client";

/** A Qloo crowd signal. No place: taste worldwide; no ages: all ages. */
export type CrowdSignal = { place: PlaceId | null; ages: AgeBand[] };
export type OnCall = (log: CallLog) => void;

const RADIUS_M = 15_000;

function crowdParams({ place, ages }: CrowdSignal): QlooParams {
  const p = place ? PLACES[place] : null;
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
