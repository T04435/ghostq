import { AGE_BANDS, PLACES, type AgeBand, type PlaceId } from "./brief";
import { geohash } from "./geohash";
import type { Demographics } from "./qloo-parse";

/** A band counts as the fans' when Qloo's skew for it is at least this (signed fraction; Tame Impala's top three were 0.27, 0.21, 0.17). */
export const AGE_SKEW_THRESHOLD = 0.1;

/** Up to three age bands the fans skew towards, strongest first, each over the threshold. Empty when Qloo has no fan data (small acts, probe 3b). */
export function topAgeBands(demo: Demographics | null): { age: AgeBand; skew: number }[] {
  if (!demo) return [];
  return Object.entries(demo.age)
    .filter(([band, skew]) => band in AGE_BANDS && skew >= AGE_SKEW_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([band, skew]) => ({ age: band as AgeBand, skew: Math.round(skew * 100) / 100 }));
}

export type HeatCell = { geohash: string; affinity: number };

/**
 * The listed city whose heatmap cell the artist's fans favour most. A world-wide
 * heatmap comes back as geohash cells (precision 3, about 150 km in the 21 Oct probe),
 * so each city is matched to the cell it falls in. Null when none of the cities has a cell.
 */
export function bestPlace(cells: HeatCell[]): { place: PlaceId; affinity: number; rank: number; of: number } | null {
  if (!cells.length) return null;
  const byHash = new Map(cells.map((c) => [c.geohash, c.affinity]));
  const precision = cells[0].geohash.length;
  const sorted = cells.map((c) => c.affinity).sort((a, b) => b - a);
  let best: { place: PlaceId; affinity: number } | null = null;
  for (const [id, p] of Object.entries(PLACES) as [PlaceId, (typeof PLACES)[PlaceId]][]) {
    const affinity = byHash.get(geohash(p.lat, p.lon, precision));
    if (affinity !== undefined && (!best || affinity > best.affinity)) best = { place: id, affinity };
  }
  return best && { ...best, affinity: Math.round(best.affinity * 100) / 100, rank: sorted.indexOf(best.affinity) + 1, of: cells.length };
}
