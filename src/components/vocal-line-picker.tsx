"use client";

import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { namesForIds } from "@/lib/signal-text";
import { type SongSheet } from "@/lib/song-sheet";
import { MAX_DIRECTION, MAX_VOICES, type Gender, type VocalLine } from "@/lib/voice";

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

/** Sentences of a direction that cast the voices ("Voice A takes verse 1", "both voices stack"): they change with the lead. */
const CASTING = /\b(voice [abc]|voices|both|duet|lead [ab]|leads|together|trade|takes? (the )?(verse|chorus|bridge)|call[- ]and[- ]answer|harmon\w*)\b/i;

/**
 * The vocal direction for a lead the user picked: the writer's own when the voices are the data's, else the writer's
 * delivery sentences without the old casting, plus who sings what now. So "Male lead" never keeps "Voice B takes verse 2".
 */
export function directionFor(start: VocalDraft, voices: Gender[]): string {
  if (voices.join() === start.voices.join()) return start.direction;
  const kept = start.direction
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim() && !CASTING.test(s))
    .join(" ");
  const cast =
    voices.length === 1
      ? `One ${voices[0]} lead sings every part.`
      : `${voices.length} leads (${voices.join(", ")}): voice A takes verse 1, voice B verse 2, and they sing the chorus together.`;
  return [kept, cast].filter(Boolean).join(" ");
}

/** The DS's four leads. A duet keeps the data's voices when it has two or more, else one female and one male. */
type Lead = "male" | "female" | "duet" | "instrumental";
const LEADS: { value: Lead; label: string }[] = [
  { value: "male", label: "Male lead" },
  { value: "female", label: "Female lead" },
  { value: "duet", label: "Duet" },
  { value: "instrumental", label: "Instrumental" },
];

export function leadOf(draft: VocalDraft): Lead | "" {
  if (draft.instrumental) return "instrumental";
  if (draft.voices.length > 1) return "duet";
  return draft.voices[0] ?? "";
}

/** "Female lead", "Duet", "Instrumental": the voice as the player names it. */
export function leadLabel(draft: VocalDraft, collab = false): string {
  if (collab && !draft.instrumental) return "Two leads";
  const lead = leadOf(draft);
  return LEADS.find((l) => l.value === lead)?.label ?? "Voice";
}

/**
 * The DS voice picker: "Lead voice" with where it came from, then the four leads as a pill toggle (shadcn ToggleGroup).
 * For a CollabQ song it lists who leads each part instead. The genre and vocal direction the writer wrote (from the
 * artist's Qloo tags and how they sing) fold away under it, editable before singing.
 */
export function VocalLinePicker({ sheet, draft, onChange }: { sheet: SongSheet; draft: VocalDraft; onChange: (draft: VocalDraft) => void }) {
  const start = draftFromSheet(sheet);
  const lead = leadOf(draft);
  const unknown = !draft.instrumental && draft.voices.some((v) => v === null);
  const changed = draft.instrumental || draft.voices.join() !== start.voices.join();
  const collab = Boolean(sheet.featuring) && !draft.instrumental && draft.voices.length > 1;

  function pick(value: string) {
    if (!value) return;
    const v = value as Lead;
    if (v === "instrumental") return onChange({ ...draft, instrumental: true });
    const known = start.voices.filter((g): g is Gender => g !== null);
    const voices: Gender[] = v === "duet" ? (known.length > 1 ? known : ["female", "male"]) : [v];
    onChange({ ...draft, instrumental: false, voices, direction: directionFor(start, voices) });
  }

  const heading = collab ? "Lead voices" : unknown ? "Pick a voice before singing" : "Lead voice";
  const note = collab
    ? "generic voices matched by gender, never the artists’ own"
    : unknown
      ? "We couldn’t match a voice for this artist"
      : changed
        ? "chosen by you"
        : /musicbrainz/i.test(sheet.vocals.source)
          ? "matched on MusicBrainz (Qloo has no voice data)"
          : sheet.vocals.source;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">{heading}</span>
        <span className={unknown ? "rounded-full bg-warning px-2 py-[3px] text-xs text-warning-foreground" : "text-xs text-muted-foreground"}>{note}</span>
      </div>

      {collab ? (
        <CollabLeads sheet={sheet} draft={draft} onChange={onChange} />
      ) : (
        <ToggleGroup
          type="single"
          value={lead}
          onValueChange={pick}
          aria-label="Voices"
          className="grid w-full grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1 rounded-[24px] bg-muted p-[3px]"
        >
          {LEADS.map((l) => (
            <ToggleGroupItem
              key={l.value}
              value={l.value}
              className="h-auto rounded-full border-0 py-2 text-[13px] font-semibold whitespace-nowrap text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {l.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <Collapsible>
        <CollapsibleTrigger className="group/sing inline-flex cursor-pointer items-center gap-1 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronRight className="size-3.5 transition-transform group-aria-expanded/sing:rotate-90" aria-hidden />
          Genre and vocal direction
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sing-genre">Genre</Label>
            <Input id="sing-genre" value={draft.genre} maxLength={MAX_DIRECTION} onChange={(e) => onChange({ ...draft, genre: e.target.value })} />
          </div>
          {!draft.instrumental && (
            <div className="grid gap-1.5">
              <Label htmlFor="sing-direction">Vocal direction</Label>
              <Textarea id="sing-direction" rows={3} value={draft.direction} maxLength={MAX_DIRECTION} onChange={(e) => onChange({ ...draft, direction: e.target.value })} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">Written from the artist&apos;s Qloo tags and how they sing. Change them before singing if you like.</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** CollabQ: who leads each part (verse 1 the first artist's voice, verse 2 the featured artist's, the chorus both). */
function CollabLeads({ sheet, draft, onChange }: { sheet: SongSheet; draft: VocalDraft; onChange: (draft: VocalDraft) => void }) {
  const name = (g: Gender | null) => (g === "male" ? "Male lead" : g === "female" ? "Female lead" : null);
  const set = (i: number, g: string) => g && onChange({ ...draft, voices: draft.voices.map((v, j) => (j === i ? (g as Gender) : v)) });
  const rows: { section: string; who: string; i: number | null }[] = [
    { section: "Verse 1", who: `for ${sheet.artist}’s crowd`, i: 0 },
    { section: "Verse 2", who: `for ${sheet.featuring!.artist}’s crowd`, i: draft.voices.length - 1 },
    { section: "Chorus", who: "shared", i: null },
  ];
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <div key={r.section} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t py-2 text-[13px]">
          <span className="min-w-0">
            <span className="font-semibold">{r.section}</span> <span className="text-muted-foreground">· {r.who}</span>
          </span>
          {r.i === null ? (
            <span className="rounded-full bg-muted px-2.5 py-[3px] font-semibold whitespace-nowrap">Both leads</span>
          ) : name(draft.voices[r.i]) ? (
            <span className="rounded-full bg-muted px-2.5 py-[3px] font-semibold whitespace-nowrap">{name(draft.voices[r.i])}</span>
          ) : (
            <ToggleGroup type="single" size="sm" variant="outline" aria-label={`${r.section} voice`} onValueChange={(g) => set(r.i!, g)}>
              <ToggleGroupItem value="female">Female</ToggleGroupItem>
              <ToggleGroupItem value="male">Male</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      ))}
    </div>
  );
}
