"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { namesForIds } from "@/lib/signal-text";
import { songArtist, type SongSheet } from "@/lib/song-sheet";
import { describeVoices, GENDERS, MAX_DIRECTION, MAX_VOICES, VOICE_NAMES, type Gender, type VocalLine } from "@/lib/voice";

/** The vocals being edited: a voice whose gender isn't known yet is null, and singing waits until every voice has one. */
export type VocalDraft = { instrumental: boolean; voices: (Gender | null)[]; genre: string; direction: string };

/** Starts from the sheet: the voices from data, the genre and vocal direction as the writer wrote them (ids as names). */
export function draftFromSheet(sheet: SongSheet): VocalDraft {
  const voices = sheet.vocals.voices;
  return {
    instrumental: false,
    voices: voices.length ? voices.slice(0, MAX_VOICES) : [null],
    genre: namesForIds(sheet.genre, sheet.signals),
    direction: namesForIds(sheet.vocalDirection, sheet.signals),
  };
}

export function lineFromDraft(draft: VocalDraft): VocalLine | null {
  if (draft.instrumental) return { kind: "instrumental", genre: draft.genre };
  const voices = draft.voices.filter((v): v is Gender => v !== null);
  return voices.length === draft.voices.length ? { kind: "vocals", voices, genre: draft.genre, direction: draft.direction } : null;
}

/**
 * What Lyria sings with: how many voices and each one's gender (from the artist's data; where it has a gap, the user
 * fills it in), and the genre and vocal direction the writer wrote from the artist's Qloo tags, which the user can
 * change before singing.
 */
export function VocalLinePicker({ sheet, draft, onChange }: { sheet: SongSheet; draft: VocalDraft; onChange: (draft: VocalDraft) => void }) {
  const line = lineFromDraft(draft);
  const start = draftFromSheet(sheet);
  const count = draft.instrumental ? "instrumental" : String(draft.voices.length);

  function setCount(value: string) {
    if (value === "instrumental") return onChange({ ...draft, instrumental: true });
    const n = Number(value);
    onChange({ ...draft, instrumental: false, voices: Array.from({ length: n }, (_, i) => draft.voices[i] ?? start.voices[i] ?? null) });
  }

  const missing = !draft.instrumental && !line;
  const changed = draft.instrumental || draft.voices.join() !== start.voices.join() || draft.genre !== start.genre || draft.direction !== start.direction;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Voices">
        <Select value={count} onValueChange={setCount}>
          <SelectTrigger size="sm" className="w-36" aria-label="How many voices">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: MAX_VOICES }, (_, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {i + 1} voice{i ? "s" : ""}
              </SelectItem>
            ))}
            <SelectItem value="instrumental">Instrumental</SelectItem>
          </SelectContent>
        </Select>
        {!draft.instrumental &&
          draft.voices.map((v, i) => (
            <Select key={i} value={v ?? undefined} onValueChange={(g) => onChange({ ...draft, voices: draft.voices.map((x, j) => (j === i ? (g as Gender) : x)) })}>
              <SelectTrigger size="sm" className="w-36" aria-label={`Voice ${VOICE_NAMES[i]}`}>
                <SelectValue placeholder={`Voice ${VOICE_NAMES[i]}: choose`} />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {draft.voices.length > 1 ? `Voice ${VOICE_NAMES[i]}: ` : ""}
                    {g === "male" ? "Male" : "Female"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        {line && <span className="text-sm font-medium">{describeVoices(line)}</span>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sing-genre">Genre</Label>
        <Input id="sing-genre" value={draft.genre} maxLength={MAX_DIRECTION} onChange={(e) => onChange({ ...draft, genre: e.target.value })} />
      </div>
      {!draft.instrumental && (
        <div className="grid gap-1.5">
          <Label htmlFor="sing-direction">Vocal direction</Label>
          <Textarea id="sing-direction" rows={2} value={draft.direction} maxLength={MAX_DIRECTION} onChange={(e) => onChange({ ...draft, direction: e.target.value })} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {missing
          ? `${sheet.vocals.source}, so choose every voice before singing.`
          : `The genre and vocal direction come from Qloo's tags for ${songArtist(sheet)}; the voices are from ${sheet.vocals.source}.${changed ? " You changed them." : ""}`}
      </p>
    </div>
  );
}
