import { AGE_BANDS, type AgeBand } from "./brief";
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

export type HeatCell = { geohash: string; affinity: number; popularity?: number };

/**
 * Where to look for the fans' city: the most popular of the top areas by affinity. Qloo's #1 affinity cells can be
 * noise with almost no activity (Lorde's #1 had popularity 0, Los Aldeanos' was over the Pacific at 0.25; 22 Oct), while
 * the most popular of the top 30 were Bogotá and the Hamilton area, NZ. Keeps each cell's affinity rank.
 */
export function hotspots<T extends HeatCell>(cells: T[], pool = 30): (T & { rank: number; of: number })[] {
  return rankCells(cells)
    .slice(0, pool)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

/** Heatmap cells strongest first, each with its rank (1 = the fans' strongest area) and the total. */
export function rankCells<T extends HeatCell>(cells: T[]): (T & { rank: number; of: number })[] {
  return [...cells].sort((a, b) => b.affinity - a.affinity).map((c, i) => ({ ...c, rank: i + 1, of: cells.length }));
}
