import { z } from "zod";

/**
 * The vocals Lyria is asked for: how many voices and each one's gender (from data, never the model), plus the genre
 * and the vocal direction the writer wrote from the artist's Qloo tags (editable before singing). It names voice
 * types; it never clones anyone. Two voices trading verses works on Lyria 3.5 (probe of 22 Oct: two male rappers on a
 * Los Aldeanos sheet came back as two distinct voices).
 */
export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const MAX_VOICES = 3;
/** Long enough for a sentence or two; Lyria takes the whole prompt as free text. */
export const MAX_DIRECTION = 400;

export const vocalLineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("instrumental"), genre: z.string().trim().max(MAX_DIRECTION).default("") }),
  z.object({
    kind: z.literal("vocals"),
    voices: z.array(z.enum(GENDERS)).min(1).max(MAX_VOICES),
    genre: z.string().trim().max(MAX_DIRECTION).default(""),
    direction: z.string().trim().max(MAX_DIRECTION).default(""),
  }),
]);
export type VocalLine = z.infer<typeof vocalLineSchema>;

/**
 * The voices that match the artist, and where they came from. A null gender, or no voices at all, is unknown: the
 * user fills it in before singing (no default).
 */
export type VocalMatch = { voices: (Gender | null)[]; source: string };

export const VOICE_NAMES = ["A", "B", "C"] as const;

const COUNT = ["", "One", "Two", "Three"];

/** "One female voice"; "Two voices: female and male"; "Instrumental, no vocals". */
export function describeVoices(line: VocalLine): string {
  if (line.kind === "instrumental") return "Instrumental, no vocals";
  if (line.voices.length === 1) return `One ${line.voices[0]} voice`;
  return `${COUNT[line.voices.length]} voices: ${line.voices.slice(0, -1).join(", ")} and ${line.voices.at(-1)}`;
}

// ---- From the artist's data ---------------------------------------------------------------------------------------

type MbArtist = { type?: string | null; gender?: string | null; name?: string };

function fromGender(gender: string | null | undefined): Gender | null {
  if (gender === "Male") return "male";
  if (gender === "Female") return "female";
  return null;
}

/**
 * The voices, from MusicBrainz. A person is one voice with their gender. A group's voices are its current members
 * marked "lead vocals" (Arctic Monkeys: Alex Turner), or every current member when none is marked (rap duos like Los
 * Aldeanos or Calle 13 have no roles listed), at most three. MusicBrainz records gender for people, not groups.
 */
export function voicesFromMusicBrainz(artist: MbArtist, members: MbArtist[] = [], leads = false, total = members.length): VocalMatch {
  const name = artist.name ?? "the artist";
  if (artist.type === "Person") {
    const gender = fromGender(artist.gender);
    return { voices: [gender], source: gender ? `${name}'s gender on MusicBrainz` : `MusicBrainz has no gender for ${name}` };
  }
  if (!members.length) return { voices: [], source: `MusicBrainz lists no current members of ${name}` };
  const voices = members.slice(0, MAX_VOICES).map((m) => fromGender(m.gender));
  const who = leads ? `the lead vocalist${members.length > 1 ? "s" : ""} of ${name}` : `the current members of ${name} (none is marked as lead vocals)`;
  const more = total > MAX_VOICES ? `; the first ${MAX_VOICES} of ${total}` : "";
  const missing = voices.includes(null) ? "; MusicBrainz has no gender for some of them" : "";
  return { voices, source: `${who} on MusicBrainz${more}${missing}` };
}

// ---- Songs written before the writer gave a genre and a vocal direction (23 Oct) ---------------------------------

const RAP = /\b(hip[\s-]*hop|rap|trap|grime|drill)\b/i;

/**
 * For older songs only: a vocal direction from the old rap-or-sung setting, else from the sheet's own genre and style
 * receipts (the artist's Qloo tags). New songs get theirs from the writer.
 */
export function legacyDirection(delivery: string | undefined, tags: string[]): string {
  const d = delivery ?? (tags.some((t) => RAP.test(t)) ? "rap" : "sung");
  return d === "rap" ? "Rapped" : d === "both" ? "Rapped verses and a sung chorus" : "Sung";
}

const LEGACY: Record<string, Gender[]> = { male: ["male"], female: ["female"], duet: ["male", "female"] };

/** A sheet's voices as stored: today's {voices, source}, or before 22 Oct one lead voice ({voice: "male" | …}). */
export function normalizeVocals(raw: unknown): VocalMatch & { delivery?: string } {
  const v = (raw ?? {}) as Partial<VocalMatch> & { voice?: string | null; delivery?: string };
  if (Array.isArray(v.voices)) return { voices: v.voices, source: v.source ?? "unknown", delivery: v.delivery };
  return { voices: (v.voice && LEGACY[v.voice]) || [], source: v.source ?? "unknown" };
}

/** The vocals a saved song was sung with: today's JSON, the 22 Oct JSON (with rap or sung), or an old voice name. */
export function toVocalLine(raw: string | null): VocalLine | null {
  if (!raw) return null;
  if (raw === "instrumental") return { kind: "instrumental", genre: "" };
  if (LEGACY[raw]) return { kind: "vocals", voices: LEGACY[raw], genre: "", direction: "Sung" };
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    if (json.kind === "vocals" && typeof json.delivery === "string" && json.direction === undefined) json.direction = legacyDirection(json.delivery, []);
    const parsed = vocalLineSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
