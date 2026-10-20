import { z } from "zod";
import type { FanProfile } from "@/lib/fan-profile";
import { bestPlace, topAgeBands } from "@/lib/fan-profile";
import { pickArtist } from "@/lib/qloo-parse";
import { artistDemographics, fanHeatmap, searchArtist } from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";
import { providerStatus } from "@/server/env";

/** GET /api/artist?name=… → the artist Qloo matched, its fans' age band and strongest listed city. Same calls as the run's first steps, so the run hits the cache. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = z.string().trim().min(1).max(80).safeParse(params.get("name"));
  const spotifyId = z.string().regex(/^[A-Za-z0-9]{22}$/).safeParse(params.get("spotifyId")).data;
  if (!name.success) return Response.json({ error: "Give an artist name" }, { status: 400 });
  if (!providerStatus().qloo) return Response.json({ error: "QLOO_API_KEY missing in .env.local" }, { status: 503 });
  try {
    const results = await searchArtist(name.data);
    const match = pickArtist(results, name.data, spotifyId);
    if (!match) return Response.json(null);
    // An act Qloo knows by name but not in its taste graph answers 400 here (probe 2c): treat it as no fan data.
    const noData = (e: unknown) => (e instanceof QlooError && e.status === 400 ? null : Promise.reject(e));
    const [demo, cells] = await Promise.all([artistDemographics(match.id).catch(noData), fanHeatmap(match.id).catch(noData)]);
    const city = bestPlace(cells ?? []);
    const profile: FanProfile = {
      artist: match.name,
      ages: topAgeBands(demo),
      place: city?.place ?? null,
      placeAffinity: city?.affinity ?? null,
      placeRank: city ? { rank: city.rank, of: city.of } : null,
    };
    return Response.json(profile);
  } catch (error) {
    console.error("artist lookup failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't reach Qloo" }, { status: 502 });
  }
}
