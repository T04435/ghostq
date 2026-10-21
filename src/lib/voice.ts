import { z } from "zod";

/**
 * The vocals Lyria is asked for: how many voices, each one's gender, and whether they rap or sing. It names voice
 * types; it never clones anyone. Two voices trading verses works on Lyria 3.5 (probe of 22 Oct: two male rappers on a
 * Los Aldeanos sheet came back as two distinct voices).
 */
export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const DELIVERIES = { sung: "Sung", rap: "Rap", both: "Rap and sung" } as const;
export type Delivery = keyof typeof DELIVERIES;

export const MAX_VOICES = 3;

export const vocalLineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("instrumental") }),
  z.object({
    kind: z.literal("vocals"),
    voices: z.array(z.enum(GENDERS)).min(1).max(MAX_VOICES),
    delivery: z.enum(Object.keys(DELIVERIES) as [Delivery, ...Delivery[]]),
  }),
]);
export type VocalLine = z.infer<typeof vocalLineSchema>;

/**
 * The vocals that match the artist, and where each part came from. A null gender, or no voices at all, is unknown: the
 * user fills it in before singing (no default).
 */
export type VocalMatch = {
  voices: (Gender | null)[];
  source: string;
  delivery: Delivery;
  deliverySource: string;
};

export const VOICE_NAMES = ["A", "B", "C"] as const;

const COUNT = ["", "One", "Two", "Three"];
const NOUN: Record<Delivery, [string, string]> = { sung: ["singer", "singers"], rap: ["rapper", "rappers"], both: ["vocalist who raps and sings", "vocalists who rap and sing"] };

/** "Two male rappers, trading verses"; "Three singers (two female, one male), trading verses"; "Instrumental, no vocals". */
export function describeVocalLine(line: VocalLine): string {
  if (line.kind === "instrumental") return "Instrumental, no vocals";
  const n = line.voices.length;
  if (n === 1) return `One ${line.voices[0]} ${NOUN[line.delivery][0]}`;
  const noun = NOUN[line.delivery][1];
  const genders = GENDERS.map((g) => [g, line.voices.filter((v) => v === g).length] as const).filter(([, c]) => c > 0);
  if (genders.length === 1) return `${COUNT[n]} ${genders[0][0]} ${noun}, trading verses`;
  const mix = genders.map(([g, c]) => `${COUNT[c].toLowerCase()} ${g}`).join(", ");
  return `${COUNT[n]} ${noun} (${mix}), trading verses`;
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
export function voicesFromMusicBrainz(artist: MbArtist, members: MbArtist[] = [], leads = false, total = members.length): Pick<VocalMatch, "voices" | "source"> {
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

const RAP = /\b(hip[\s-]*hop|rap|trap|grime|drill)\b/i;
const SUNG = /\b(r&b|rnb|soul|reggaeton|pop|singer[\s-]*songwriter|rock|punk|indie|folk|country|ballad|bolero|salsa|jazz|blues|gospel)\b/i;

/** Rap or sung, from the artist's Qloo genre and style tags. A tag that names rap counts as rap only ("Pop Rap"). */
export function deliveryFromTags(tags: string[], artist: string): Pick<VocalMatch, "delivery" | "deliverySource"> {
  const rap = tags.filter((t) => RAP.test(t));
  const sung = tags.filter((t) => !RAP.test(t) && SUNG.test(t));
  const list = (names: string[]) => [...new Set(names)].slice(0, 3).join(", ");
  if (rap.length && sung.length) return { delivery: "both", deliverySource: `Qloo's tags for ${artist}: ${list(rap)} and ${list(sung)}` };
  if (rap.length) return { delivery: "rap", deliverySource: `Qloo's tags for ${artist}: ${list(rap)}` };
  if (sung.length) return { delivery: "sung", deliverySource: `Qloo's tags for ${artist}: ${list(sung)}` };
  return { delivery: "sung", deliverySource: tags.length ? `Qloo's tags for ${artist} (no rap)` : `Qloo has no genres for ${artist}` };
}

// ---- Songs saved before 22 Oct ------------------------------------------------------------------------------------

const LEGACY: Record<string, Gender[]> = { male: ["male"], female: ["female"], duet: ["male", "female"] };

/**
 * A sheet's vocals as stored. Before 22 Oct a sheet kept one lead voice ({voice: "male" | "female" | "duet" | null}) and
 * no rap or sung: that is read from the sheet's own genre and style receipts (the artist's Qloo tags).
 */
export function normalizeVocals(raw: unknown, sheet?: { artist?: string; signals?: { kind: string; label: string }[] }): VocalMatch {
  const v = (raw ?? {}) as Partial<VocalMatch> & { voice?: string | null };
  if (Array.isArray(v.voices) && v.delivery) return v as VocalMatch;
  const tags = (sheet?.signals ?? []).filter((s) => s.kind === "genre" || s.kind === "style").map((s) => s.label);
  return { voices: (v.voice && LEGACY[v.voice]) || [], source: v.source ?? "unknown", ...deliveryFromTags(tags, sheet?.artist ?? "the artist") };
}

/** The vocals a saved song was sung with: JSON, or one of the old voice names. */
export function toVocalLine(raw: string | null): VocalLine | null {
  if (!raw) return null;
  if (raw === "instrumental") return { kind: "instrumental" };
  if (LEGACY[raw]) return { kind: "vocals", voices: LEGACY[raw], delivery: "sung" };
  try {
    const parsed = vocalLineSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
