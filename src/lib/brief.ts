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

export type Language = (typeof LANGUAGES)[number];

/** What the user gives before a run: the artist and, optionally, a story seed. Everything else comes from Qloo. */
export const briefSchema = z.object({
  artist: z.string().trim().min(1, "Give an artist").max(80),
  /** Set when the artist was picked from Spotify search: pins the Qloo match. */
  spotifyId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
  story: z.string().trim().max(280).optional(),
  /**
   * Answers to what the run asked for when Qloo had no data (never asked up front). The run stops with an "ask" event;
   * the page sends the same brief again with these filled in, and the run carries on (Qloo calls come from cache).
   */
  answers: z
    .object({
      /** The artist's sound in the user's words, when Qloo doesn't know the artist. */
      sound: z.string().trim().min(2).max(160).optional(),
      place: z.enum(Object.keys(PLACES) as [PlaceId, ...PlaceId[]]).optional(),
      ages: z.array(z.enum(Object.keys(AGE_BANDS) as [AgeBand, ...AgeBand[]])).min(1).max(3).optional(),
    })
    .optional(),
});
export type Brief = z.infer<typeof briefSchema>;
export type AskField = "sound" | "place" | "ages";

/** The crowd the run reads from Qloo's data on the artist's fans. Null place: Qloo had no location data, so taste is read worldwide. */
export type Crowd = {
  /** Where each value came from: Qloo's data on the fans, or the user's answer when Qloo had none. */
  from: { place: "qloo" | "you"; ages: "qloo" | "you" };
  place: PlaceId | null;
  /** The place's heatmap cell rank among Qloo's cells, e.g. 10 of 4,931. */
  placeRank: { rank: number; of: number } | null;
  /** Up to three age bands the fans skew towards, strongest first; empty when Qloo has no fan data. */
  ages: { age: AgeBand; skew: number | null }[];
  language: Language;
};

export const EXAMPLE_BRIEFS: { label: string; brief: Brief }[] = [
  { label: "Teenage Joans · last tram home", brief: { artist: "Teenage Joans", spotifyId: "6i78AQeGl4IGuGePiz3woE", story: "Last tram home after a share-house party" } },
  { label: "Natalia Lafourcade · rain on the metro", brief: { artist: "Natalia Lafourcade", story: "Rain on the metro, going home to my mother's" } },
];

/** "25–29" or "24 and under, 25–29 and 30–34", in Qloo's order. */
export function describeAges(ages: AgeBand[]): string {
  const labels = (Object.keys(AGE_BANDS) as AgeBand[]).filter((a) => ages.includes(a)).map((a) => AGE_BANDS[a]);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : (labels[0] ?? "");
}

export function describeCrowd(c: Crowd): string {
  const ages = c.ages.length ? describeAges(c.ages.map((a) => a.age)) : "all ages";
  const where = c.place ? `${PLACES[c.place].name}, ${PLACES[c.place].country}` : "worldwide";
  return `${ages} in ${where}`;
}

export function describeBrief(b: Brief, crowd: Crowd): string {
  return [`Artist: ${b.artist}.`, `Crowd (read from Qloo's data on the artist's fans): ${describeCrowd(crowd)}.`, `Language: ${crowd.language}.`, b.story ? `Story seed: "${b.story}".` : null]
    .filter(Boolean)
    .join(" ");
}
