import "server-only";
import { PLACES, type AskField, type Brief, type Crowd } from "@/lib/brief";
import { bestPlace, topAgeBands } from "@/lib/fan-profile";
import type { QlooEntity } from "@/lib/qloo-parse";
import { artistDemographics, fanHeatmap, type OnCall } from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";

/** An act Qloo knows by name but not in its taste graph answers 400 (probe 2c): treat it as no data. */
const noData = (e: unknown) => (e instanceof QlooError && e.status === 400 ? null : Promise.reject(e));

/**
 * The artist's crowd, from Qloo: the listed city where the fans' taste is strongest (world heatmap), up to three age bands
 * they skew towards (demographics), and the city's language. Two calls in parallel. Where Qloo has nothing, the user's
 * answer fills in; where neither has a value, the field is returned in `missing` so the run can ask.
 */
export async function readCrowd(artist: QlooEntity | null, answers: Brief["answers"], onCall?: OnCall): Promise<{ crowd: Crowd; missing: AskField[] }> {
  const [demo, cells] = artist ? await Promise.all([artistDemographics(artist.id, onCall).catch(noData), fanHeatmap(artist.id, onCall).catch(noData)]) : [null, null];
  const city = bestPlace(cells ?? []);
  const qlooAges = topAgeBands(demo);
  const place = city?.place ?? answers?.place ?? null;
  const ages = qlooAges.length ? qlooAges : (answers?.ages ?? []).map((age) => ({ age, skew: null }));
  const missing: AskField[] = [...(place ? [] : (["place"] as const)), ...(ages.length ? [] : (["ages"] as const))];
  return {
    crowd: {
      from: { place: city ? "qloo" : "you", ages: qlooAges.length ? "qloo" : "you" },
      place,
      placeRank: city ? { rank: city.rank, of: city.of } : null,
      ages,
      language: place ? PLACES[place].language : "English",
    },
    missing,
  };
}
