"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DELIVERIES, describeVocalLine, GENDERS, MAX_VOICES, VOICE_NAMES, type Delivery, type Gender, type VocalLine, type VocalMatch } from "@/lib/voice";

/** The vocals being edited: a voice whose gender isn't known yet is null, and singing waits until every voice has one. */
export type VocalDraft = { instrumental: boolean; voices: (Gender | null)[]; delivery: Delivery };

export function draftFromMatch(match: VocalMatch): VocalDraft {
  return { instrumental: false, voices: match.voices.length ? match.voices.slice(0, MAX_VOICES) : [null], delivery: match.delivery };
}

export function lineFromDraft(draft: VocalDraft): VocalLine | null {
  if (draft.instrumental) return { kind: "instrumental" };
  const voices = draft.voices.filter((v): v is Gender => v !== null);
  return voices.length === draft.voices.length ? { kind: "vocals", voices, delivery: draft.delivery } : null;
}

const same = (a: VocalDraft, b: VocalDraft) => a.instrumental === b.instrumental && a.delivery === b.delivery && a.voices.join() === b.voices.join();

/**
 * The vocals Lyria sings with, as one editable line: how many voices, each one's gender, and rap or sung. It starts
 * from the artist's data (MusicBrainz for the voices, Qloo's tags for rap or sung); where that data has a gap, the
 * user fills it in.
 */
export function VocalLinePicker({ match, draft, onChange }: { match: VocalMatch; draft: VocalDraft; onChange: (draft: VocalDraft) => void }) {
  const line = lineFromDraft(draft);
  const matched = draftFromMatch(match);
  const count = draft.instrumental ? "instrumental" : String(draft.voices.length);

  function setCount(value: string) {
    if (value === "instrumental") return onChange({ ...draft, instrumental: true });
    const n = Number(value);
    const voices = Array.from({ length: n }, (_, i) => draft.voices[i] ?? matched.voices[i] ?? null);
    onChange({ ...draft, instrumental: false, voices });
  }

  function setGender(i: number, gender: Gender) {
    onChange({ ...draft, voices: draft.voices.map((v, j) => (j === i ? gender : v)) });
  }

  const gaps = !draft.instrumental && !line;
  const note = same(draft, matched)
    ? gaps
      ? `${match.source}, so choose the missing voice${draft.voices.filter((v) => !v).length > 1 ? "s" : ""} before singing.`
      : `Matched to the artist: voices from ${match.source}; ${DELIVERIES[match.delivery].toLowerCase()} from ${match.deliverySource}.`
    : gaps
      ? "Choose every voice before singing."
      : `You changed the vocals. The artist's data: voices from ${match.source}; ${DELIVERIES[match.delivery].toLowerCase()} from ${match.deliverySource}.`;

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vocals">
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
            <Select key={i} value={v ?? undefined} onValueChange={(g) => setGender(i, g as Gender)}>
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
        {!draft.instrumental && (
          <Select value={draft.delivery} onValueChange={(d) => onChange({ ...draft, delivery: d as Delivery })}>
            <SelectTrigger size="sm" className="w-36" aria-label="Rap or sung">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DELIVERIES) as Delivery[]).map((d) => (
                <SelectItem key={d} value={d}>
                  {DELIVERIES[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {line && <p className="text-sm font-medium">{describeVocalLine(line)}</p>}
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
