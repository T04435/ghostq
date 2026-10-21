/** The lead vocal Lyria is asked for. It names a voice type; it never clones anyone. */
export const VOICES = {
  male: { label: "Male lead", prompt: "a male lead vocal" },
  female: { label: "Female lead", prompt: "a female lead vocal" },
  duet: { label: "Male and female duet", prompt: "a male and female duet" },
  instrumental: { label: "Instrumental", prompt: "no vocals: instrumental only" },
} as const;
export type Voice = keyof typeof VOICES;

/** The voice that matches the artist, and where that came from. Null voice: unknown, so the user must choose. */
export type VoiceMatch = { voice: Voice | null; source: string };

type MbArtist = { type?: string | null; gender?: string | null; name?: string };

function fromGender(gender: string | null | undefined): Voice | null {
  if (gender === "Male") return "male";
  if (gender === "Female") return "female";
  return null;
}

/**
 * MusicBrainz records gender for people, not for groups (checked 21 Oct: Tame Impala is Person/Male; Teenage Joans is
 * a Group with no gender). For a group, its current members decide: all one gender gives that voice; a mix gives a duet.
 */
export function voiceFromMusicBrainz(artist: MbArtist, members: MbArtist[] = []): VoiceMatch {
  const name = artist.name ?? "the artist";
  if (artist.type === "Person") {
    const voice = fromGender(artist.gender);
    return voice ? { voice, source: `${name}'s gender on MusicBrainz` } : { voice: null, source: `MusicBrainz has no gender for ${name}` };
  }
  const voices = members.map((m) => fromGender(m.gender));
  if (!voices.length || voices.includes(null)) return { voice: null, source: `MusicBrainz doesn't list every member of ${name} with a gender` };
  const kinds = new Set(voices);
  const voice: Voice = kinds.size === 1 ? voices[0]! : "duet";
  return { voice, source: `the members of ${name} on MusicBrainz` };
}
