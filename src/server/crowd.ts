import "server-only";
import type { AskField, Brief, Crowd, Remix } from "@/lib/brief";
import { hotspots, topAgeBands } from "@/lib/fan-profile";
import { geohashBounds } from "@/lib/geohash";
import type { Place } from "@/lib/place";
import type { QlooEntity } from "@/lib/qloo-parse";
import { cityAt } from "@/server/geocode";
import { artistDemographics, fanHeatmap, zoomedHeatmap, type OnCall } from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";

/** An act Qloo knows by name but not in its taste graph answers 400 (probe 2c): treat it as no data. */
const noData = (e: unknown) => (e instanceof QlooError && e.status === 400 ? null : Promise.reject(e));

type TopArea = { place: Place; rank: number; of: number; /** The world cells after the chosen one, for nextAreas. */ rest: { geohash: string }[] };

/**
 * The real city where the fans' taste is strongest: the most popular of the world heatmap's top cells (~150 km; see
 * hotspots), a zoomed heatmap inside it to find the hotspots (same rule), then the first hotspot that names a city or town (a rural district only when none does). Tries
 * the second-best world cell when the first names nothing (at sea).
 */
async function topArea(artist: QlooEntity, onCall?: OnCall): Promise<TopArea | null> {
  const world = hotspots((await fanHeatmap(artist.id, onCall).catch(noData)) ?? []);
  for (const [i, cell] of world.slice(0, 2).entries()) {
    const rest = world.slice(i + 1);
    const zoomed = hotspots((await zoomedHeatmap(artist.id, cell.geohash, onCall).catch(noData)) ?? [], 10);
    const spots = zoomed.length ? zoomed.slice(0, 3).map((z) => z.geohash) : [cell.geohash];
    let fallback: Place | null = null;
    for (const spot of spots) {
      const b = geohashBounds(spot);
      const found = await cityAt((b.south + b.north) / 2, (b.west + b.east) / 2);
      if (!found) continue;
      const { settlement, ...place } = found;
      if (settlement) return { place, rank: cell.rank, of: cell.of, rest };
      fallback ??= place;
    }
    if (fallback) return { place: fallback, rank: cell.rank, of: cell.of, rest };
  }
  return null;
}

/**
 * RemixQ's quick picks: the fans' next-strongest areas after the chosen one (the next world heatmap cells, named at
 * their centre: no extra Qloo calls, a few more paced OpenStreetMap lookups, at most 5). Run after the song, so it adds no wait.
 */
export async function nextAreas(area: Pick<TopArea, "place" | "rest"> | null, max = 2): Promise<Place[]> {
  const towns: Place[] = [];
  const others: Place[] = [];
  const same = (p: Place, q: Place) => p.name === q.name && p.country === q.country;
  for (const cell of area?.rest.slice(0, 5) ?? []) {
    if (towns.length >= max) break;
    const b = geohashBounds(cell.geohash);
    const found = await cityAt((b.south + b.north) / 2, (b.west + b.east) / 2);
    if (!found) continue;
    const place: Place = { name: found.name, country: found.country, countryCode: found.countryCode, lat: found.lat, lon: found.lon };
    if (same(place, area!.place) || [...towns, ...others].some((p) => same(p, place))) continue;
    // A city or town reads better on a button than a rural district: districts only fill in when towns run out.
    (found.settlement ? towns : others).push(place);
  }
  return [...towns, ...others].slice(0, max);
}

/**
 * The crowd from Qloo: the fans' top area and up to three age bands. Where Qloo has nothing, the user's answer fills in;
 * where neither has a value, the field is returned in `missing` so the run can ask.
 */
export async function readCrowd(
  artist: QlooEntity | null,
  answers: Brief["answers"],
  onCall?: OnCall,
  remix?: Pick<Remix, "place" | "ages">,
): Promise<{ crowd: Pick<Crowd, "from" | "place" | "placeRank" | "ages">; missing: AskField[]; area: TopArea | null }> {
  // A RemixQ's picked city or ages replace Qloo's, so those Qloo calls are skipped.
  const [demo, area] = artist
    ? await Promise.all([remix?.ages ? null : artistDemographics(artist.id, onCall).catch(noData), remix?.place ? null : topArea(artist, onCall)])
    : [null, null];
  const qlooAges = topAgeBands(demo);
  const place = remix?.place ?? area?.place ?? answers?.place ?? null;
  const ages = remix?.ages ? remix.ages.map((age) => ({ age, skew: null })) : qlooAges.length ? qlooAges : (answers?.ages ?? []).map((age) => ({ age, skew: null }));
  const missing: AskField[] = [...(place ? [] : (["place"] as const)), ...(ages.length ? [] : (["ages"] as const))];
  return {
    crowd: {
      from: { place: remix?.place ? "remix" : area ? "qloo" : "you", ages: remix?.ages ? "remix" : qlooAges.length ? "qloo" : "you" },
      place,
      placeRank: !remix?.place && area ? { rank: area.rank, of: area.of } : null,
      ages,
    },
    missing,
    area: remix?.place ? null : area,
  };
}
