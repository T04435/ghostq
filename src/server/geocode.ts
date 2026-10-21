import "server-only";
import { countryCodeFor, type Place } from "@/lib/place";

/**
 * Names the fans' top area: one reverse lookup per run on OpenStreetMap's Nominatim. Its policy (checked 22 Oct 2026,
 * https://operations.osmfoundation.org/policies/nominatim/): at most 1 request a second, an identifying User-Agent,
 * results cached, attribution shown, and the app must be able to switch it off (GEOCODER_OFF=1). Never used for search
 * or autocomplete (Qloo's locality search does that).
 */
const USER_AGENT = "GhostQ/1.0 (https://ghostq.xyz)";
const cache = new Map<string, Promise<Located | null>>();
let nextSlot = 0;

async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1100;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

type Reverse = { lat?: string; lon?: string; address?: Record<string, string> };

export type Located = Place & { /** A city, town or village; false for a district, county or region. */ settlement: boolean };

/** The city (or town, else region) at a point; null at sea, on failure, or when switched off. Cached by ~1 km cell. */
export function cityAt(lat: number, lon: number): Promise<Located | null> {
  if (process.env.GEOCODER_OFF === "1") return Promise.resolve(null);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const value = (async () => {
    try {
      await paced();
      const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lon), zoom: "10", format: "jsonv2", "accept-language": "en" })}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const r = (await res.json()) as Reverse;
      const a = r.address ?? {};
      const settlement = a.city ?? a.town ?? a.village;
      const base = settlement ?? a.municipality ?? a.county ?? a.state;
      // OSM files some city districts as cities (Auckland's "Albert-Eden", region Auckland): add the region when it
      // differs, so the place reads "Albert-Eden (Auckland)". Bogotá's region already holds its name, so it stays "Bogota".
      const region = a.state && base && !a.state.toLowerCase().includes(base.toLowerCase()) && base !== a.state ? a.state : null;
      const name = base && region && settlement ? `${base} (${region})` : base;
      if (!name || !a.country) return null;
      return {
        name,
        country: a.country,
        countryCode: a.country_code?.toUpperCase() ?? countryCodeFor(a.country),
        lat: Number(r.lat ?? lat),
        lon: Number(r.lon ?? lon),
        settlement: Boolean(settlement),
      };
    } catch {
      return null;
    }
  })();
  cache.set(key, value);
  return value;
}
