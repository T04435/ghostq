import { z } from "zod";

/** Where the crowd is. Qloo takes a WKT point plus a radius (15 km in the probes). */
export const PLACES = {
  melbourne: { name: "Melbourne", country: "Australia", lon: 144.9631, lat: -37.8136, language: "English" },
  adelaide: { name: "Adelaide", country: "Australia", lon: 138.6007, lat: -34.9285, language: "English" },
  brisbane: { name: "Brisbane", country: "Australia", lon: 153.0251, lat: -27.4698, language: "English" },
  sydney: { name: "Sydney", country: "Australia", lon: 151.2093, lat: -33.8688, language: "English" },
  austin: { name: "Austin", country: "United States", lon: -97.7431, lat: 30.2672, language: "English" },
  nashville: { name: "Nashville", country: "United States", lon: -86.7816, lat: 36.1627, language: "English" },
  "new-york": { name: "New York", country: "United States", lon: -73.9857, lat: 40.7484, language: "English" },
  "los-angeles": { name: "Los Angeles", country: "United States", lon: -118.2437, lat: 34.0522, language: "English" },
  chicago: { name: "Chicago", country: "United States", lon: -87.6298, lat: 41.8781, language: "English" },
  toronto: { name: "Toronto", country: "Canada", lon: -79.3832, lat: 43.6532, language: "English" },
  london: { name: "London", country: "United Kingdom", lon: -0.1276, lat: 51.5072, language: "English" },
  "mexico-city": { name: "Mexico City", country: "Mexico", lon: -99.1332, lat: 19.4326, language: "Spanish" },
  "sao-paulo": { name: "São Paulo", country: "Brazil", lon: -46.6333, lat: -23.5505, language: "Portuguese" },
  paris: { name: "Paris", country: "France", lon: 2.3522, lat: 48.8566, language: "French" },
  madrid: { name: "Madrid", country: "Spain", lon: -3.7038, lat: 40.4168, language: "Spanish" },
  "buenos-aires": { name: "Buenos Aires", country: "Argentina", lon: -58.3816, lat: -34.6037, language: "Spanish" },
  berlin: { name: "Berlin", country: "Germany", lon: 13.405, lat: 52.52, language: "German" },
} as const;
export type PlaceId = keyof typeof PLACES;

/** Qloo's age bands (signal.demographics.age). */
export const AGE_BANDS = {
  "24_and_younger": "24 and under",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55 and over",
} as const;
export type AgeBand = keyof typeof AGE_BANDS;

/** Qloo has no language filter (probe 10b): the writer writes in this language. */
export const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "German"] as const;

export const briefSchema = z
  .object({
    artist: z.string().trim().max(80).optional(),
    /** Set when the artist was picked from Spotify search: pins the Qloo match. */
    spotifyId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
    sound: z.string().trim().max(160).optional(),
    place: z.enum(Object.keys(PLACES) as [PlaceId, ...PlaceId[]]),
    /** One to three age bands; Qloo takes them comma-separated in one signal (checked live, 21 Oct). */
    ages: z.array(z.enum(Object.keys(AGE_BANDS) as [AgeBand, ...AgeBand[]])).min(1).max(3),
    language: z.enum(LANGUAGES),
    story: z.string().trim().max(280).optional(),
  })
  .refine((b) => Boolean(b.artist || b.sound), { message: "Give an artist or describe your sound", path: ["artist"] });
export type Brief = z.infer<typeof briefSchema>;

export const EXAMPLE_BRIEFS: { label: string; brief: Brief }[] = [
  {
    label: "Melbourne indie, 25–29",
    brief: { artist: "Teenage Joans", spotifyId: "6i78AQeGl4IGuGePiz3woE", place: "melbourne", ages: ["25_to_29"], language: "English", story: "Last tram home after a share-house party" },
  },
  {
    label: "Bedroom pop in Mexico City, Spanish",
    brief: { sound: "dreamy lo-fi bedroom pop", place: "mexico-city", ages: ["24_and_younger"], language: "Spanish" },
  },
];

/** "25–29" or "24 and under, 25–29 and 30–34", in Qloo's order. */
export function describeAges(ages: AgeBand[]): string {
  const labels = (Object.keys(AGE_BANDS) as AgeBand[]).filter((a) => ages.includes(a)).map((a) => AGE_BANDS[a]);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : (labels[0] ?? "");
}

export function describeBrief(b: Brief): string {
  const place = PLACES[b.place];
  return [
    b.artist ? `Artist: ${b.artist}.` : null,
    b.sound ? `Their sound in their words: "${b.sound}".` : null,
    `Crowd: ${describeAges(b.ages)} in ${place.name}, ${place.country}.`,
    `Language: ${b.language}.`,
    b.story ? `Story seed: "${b.story}".` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
