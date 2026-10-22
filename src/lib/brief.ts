import { z } from "zod";
import { describePlace, placeSchema, toPlace, type Home, type Language, type Place } from "./place";

export { LANGUAGES, type Home, type Language, type Place } from "./place";

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

const answersSchema = z.object({
  /** The artist's sound in the user's words, when Qloo doesn't know the artist. */
  sound: z.string().trim().min(2).max(160).optional(),
  /** A city picked from Qloo's locality search. */
  place: placeSchema.optional(),
  ages: z.array(z.enum(Object.keys(AGE_BANDS) as [AgeBand, ...AgeBand[]])).min(1).max(3).optional(),
});

/** What the user gives before a run: the artist and, optionally, what it's about. Everything else comes from Qloo. */
export const briefSchema = z.object({
  artist: z.string().trim().min(1, "Give an artist").max(80),
  /** Set when the artist was picked from Spotify search: pins the Qloo match. */
  spotifyId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
  story: z.string().trim().max(280).optional(),
  /** "Write another": songs already written for this brief (title and angle), so the next take is clearly different. */
  avoid: z.array(z.string().trim().max(400)).max(10).optional(),
  /**
   * Answers to what the run asked for when Qloo had no data (never asked up front). The run stops with an "ask" event;
   * the page sends the same brief again with these filled in, and the run carries on (Qloo calls come from cache).
   */
  answers: answersSchema.optional(),
  /**
   * CollabQ: "A feat. B". The featured artist, picked the same way, with its own answers when Qloo lacks data on it.
   * Verse 1 is A's crowd, verse 2 B's, the chorus what both crowds share.
   */
  feat: z
    .object({
      artist: z.string().trim().min(1).max(80),
      spotifyId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
      answers: answersSchema.optional(),
    })
    .optional(),
});
export type Brief = z.infer<typeof briefSchema>;
export type AskField = "sound" | "place" | "ages";

/**
 * Who the song is for, and as whom. The crowd (city, ages) sets the themes; the artist's home sets the voice and the
 * language. Null place: Qloo had no location data and nobody answered, so taste is read worldwide.
 */
export type Crowd = {
  /** Where each value came from: Qloo's data on the fans, or the user's answer when Qloo had none. */
  from: { place: "qloo" | "you"; ages: "qloo" | "you" };
  place: Place | null;
  /** The fans' top area's rank among Qloo's world heatmap cells, e.g. 3 of 3,136. */
  placeRank: { rank: number; of: number } | null;
  /** Up to three age bands the fans skew towards, strongest first; empty when Qloo has no fan data. */
  ages: { age: AgeBand; skew: number | null }[];
  /** Where the artist is from (MusicBrainz, else Qloo's country tags); null when neither knows. */
  home: Home | null;
  language: Language;
  /** The language follows the artist's home when known, else the crowd's city. */
  languageFrom: "home" | "city";
};

/** A crowd as stored. Songs saved before 22 Oct kept a city id and no home: read them into today's shape. */
export function normalizeCrowd(raw: unknown): Crowd {
  const c = (raw ?? {}) as Partial<Crowd> & { place?: unknown };
  return {
    from: c.from ?? { place: "qloo", ages: "qloo" },
    place: toPlace(c.place),
    placeRank: c.placeRank ?? null,
    ages: c.ages ?? [],
    home: c.home ?? null,
    language: c.language ?? "English",
    languageFrom: c.languageFrom ?? "city",
  };
}

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
  return `${ages} in ${c.place ? describePlace(c.place) : "worldwide"}`;
}

export function describeHome(h: Home): string {
  return describePlace(h);
}

export function describeBrief(b: Brief, crowd: Crowd): string {
  return [
    `Artist: ${b.artist}.`,
    crowd.home ? `The artist is from ${describeHome(crowd.home)}: write in their voice, with the slang, places and images of home.` : null,
    `Crowd (read from Qloo's data on the artist's fans): ${describeCrowd(crowd)}. Write about what this crowd cares about.`,
    `Language: ${crowd.language}${crowd.languageFrom === "home" ? " (the artist's own)" : ""}.`,
    b.story ? `What it's about: "${b.story}".` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
