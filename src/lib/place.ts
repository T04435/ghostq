import { z } from "zod";

/**
 * A real place, from an API (Qloo's locality search, or the fans' top area named by reverse geocoding).
 * Replaces the hard-coded 17-city list (roadmap fix F1).
 */
export const placeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  country: z.string().trim().max(120),
  /** ISO 3166-1 alpha-2, when known. */
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Place = z.infer<typeof placeSchema>;

/** Where the artist is from: their voice. A city when MusicBrainz knows it, else the country. */
export type Home = { name: string; country: string; countryCode: string | null; source: "musicbrainz" | "qloo" };

export const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "German"] as const;
export type Language = (typeof LANGUAGES)[number];

const BY_CODE: Record<string, Language> = { en: "English", es: "Spanish", pt: "Portuguese", fr: "French", de: "German" };

/** The main language of a country (Unicode CLDR likely-subtags, built into Intl); English when it's not one GhostQ writes in. */
export function languageFor(countryCode: string | null | undefined): Language {
  if (!countryCode) return "English";
  try {
    return BY_CODE[new Intl.Locale(`und-${countryCode}`).maximize().language] ?? "English";
  } catch {
    return "English";
  }
}

let regionNames: Map<string, string> | null = null;

/** English country name → ISO code, from Intl's region names (no hand-made list). */
export function countryCodeFor(name: string): string | null {
  if (!regionNames) {
    regionNames = new Map();
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const label = dn.of(code);
        if (label && label !== code && label !== "Unknown Region") regionNames.set(label.toLowerCase(), code);
      }
    }
    // Names that sources spell differently from Intl.
    for (const [alias, code] of [["united states of america", "US"], ["usa", "US"], ["uk", "GB"], ["england", "GB"], ["russia", "RU"], ["south korea", "KR"]] as const) regionNames.set(alias, code);
  }
  return regionNames.get(name.trim().toLowerCase()) ?? null;
}

export function describePlace(p: { name: string; country: string }): string {
  return !p.country || p.name === p.country ? p.name : `${p.name}, ${p.country}`;
}

/** The 17 cities v1 used, kept only to read songs saved before 22 Oct (their crowd stored a city id). */
const LEGACY: Record<string, Place> = {
  melbourne: { name: "Melbourne", country: "Australia", countryCode: "AU", lat: -37.8136, lon: 144.9631 },
  adelaide: { name: "Adelaide", country: "Australia", countryCode: "AU", lat: -34.9285, lon: 138.6007 },
  brisbane: { name: "Brisbane", country: "Australia", countryCode: "AU", lat: -27.4698, lon: 153.0251 },
  sydney: { name: "Sydney", country: "Australia", countryCode: "AU", lat: -33.8688, lon: 151.2093 },
  austin: { name: "Austin", country: "United States", countryCode: "US", lat: 30.2672, lon: -97.7431 },
  nashville: { name: "Nashville", country: "United States", countryCode: "US", lat: 36.1627, lon: -86.7816 },
  "new-york": { name: "New York", country: "United States", countryCode: "US", lat: 40.7484, lon: -73.9857 },
  "los-angeles": { name: "Los Angeles", country: "United States", countryCode: "US", lat: 34.0522, lon: -118.2437 },
  chicago: { name: "Chicago", country: "United States", countryCode: "US", lat: 41.8781, lon: -87.6298 },
  toronto: { name: "Toronto", country: "Canada", countryCode: "CA", lat: 43.6532, lon: -79.3832 },
  london: { name: "London", country: "United Kingdom", countryCode: "GB", lat: 51.5072, lon: -0.1276 },
  "mexico-city": { name: "Mexico City", country: "Mexico", countryCode: "MX", lat: 19.4326, lon: -99.1332 },
  "sao-paulo": { name: "São Paulo", country: "Brazil", countryCode: "BR", lat: -23.5505, lon: -46.6333 },
  paris: { name: "Paris", country: "France", countryCode: "FR", lat: 48.8566, lon: 2.3522 },
  madrid: { name: "Madrid", country: "Spain", countryCode: "ES", lat: 40.4168, lon: -3.7038 },
  "buenos-aires": { name: "Buenos Aires", country: "Argentina", countryCode: "AR", lat: -34.6037, lon: -58.3816 },
  berlin: { name: "Berlin", country: "Germany", countryCode: "DE", lat: 52.52, lon: 13.405 },
};

/** A place as stored: a Place, or a pre-22-Oct city id. */
export function toPlace(value: unknown): Place | null {
  if (typeof value === "string") return LEGACY[value] ?? null;
  const parsed = placeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
