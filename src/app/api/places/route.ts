import { z } from "zod";
import { providerStatus } from "@/server/env";
import { searchLocalities } from "@/server/qloo/api";

/** GET /api/places?q=… → cities by name from Qloo's locality search, for the "which city?" question. Runs on Enter, not per keystroke. */
export async function GET(request: Request) {
  const q = z.string().trim().min(2).max(80).safeParse(new URL(request.url).searchParams.get("q"));
  if (!q.success) return Response.json({ error: "Type at least two letters of a city" }, { status: 400 });
  if (!providerStatus().qloo) return Response.json({ error: "City search isn't available right now." }, { status: 503 });
  try {
    const places = await searchLocalities(q.data);
    return Response.json(places.map((p) => ({ name: p.name, country: p.country, countryCode: p.countryCode, lat: p.lat, lon: p.lon })));
  } catch (error) {
    console.error("place search failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't reach Qloo's city search" }, { status: 502 });
  }
}
