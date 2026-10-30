import type { Crowd } from "./brief";
import type { RunEvent } from "./run-events";
import type { Origin, Signal } from "./signals";
import type { SongSheet } from "./song-sheet";

/**
 * Sets `origin` on a saved song's signals that have none (songs written before 31 Oct), from structured data saved with
 * the song only, never from a signal's source text (the user, 31 Oct):
 * - the research step that found the signal (its tool id): Qloo's tools are Qloo's; Wikipedia's voice is other;
 * - the artist step's saved tags (raw): a tag NotOnQ added carries `notonq: true`; a record NotOnQ filled shows in the
 *   saved crowd as its similar artists (`standIns`), so its own tags are NotOnQ's;
 * - the crowd step: the home by `crowd.home.source`, the city and ages by `crowd.from` (Qloo's also when read through
 *   similar artists Qloo knows), anything the user answered is other;
 * - a song saved before GhostQ read Qloo through NotOnQ (v1.14.0) has only Qloo's data, so with no saved tags its artist
 *   step is Qloo's.
 * Nothing else is guessed: a signal with no structured basis stays "other", and the result says how many.
 */
export const NOTONQ_SINCE = "2026-10-30T11:08:00Z"; // v1.14.0, the first release that read Qloo through NotOnQ

/** Qloo's own tools (each call is a Qloo API call); the Ghost's craft pass and Wikipedia's voice are not. */
const QLOO_TOOLS = new Set(["compare_crowds", "sound_from_words", "sound_alikes", "artists_in_genres", "crowd_tags", "local_scene", "crowd_taste", "fan_audiences", "ready_to_write"]);

type Saved = { createdAt: string; sheet: SongSheet; research: RunEvent[] };
export type BackfillResult = { sheet: SongSheet; set: Record<Origin, number>; unknown: string[] };

type Tag = { name: string; notonq?: true };
const savedTags = (raw: unknown): Tag[] | "words" | null => {
  if (Array.isArray(raw)) return "words"; // the user's words through Qloo's tag search
  if (raw && typeof raw === "object" && Array.isArray((raw as { tags?: unknown }).tags)) return (raw as { tags: Tag[] }).tags;
  return null;
};

export function backfillOrigins(song: Saved): BackfillResult {
  const tools = new Map<string, string>();
  const crowds = new Map<"A" | "B", Crowd>();
  const found = new Map<string, Origin>();
  for (const e of song.research) {
    if (e.type === "step-start") tools.set(e.id, e.tool);
    if (e.type === "crowd") crowds.set(e.who ?? "A", e.crowd);
  }
  const beforeNotOnQ = song.createdAt < NOTONQ_SINCE;

  for (const e of song.research) {
    if (e.type !== "step-end" || !e.signals?.length) continue;
    const tool = tools.get(e.id);
    const crowd = crowds.get(e.id.endsWith("-B") ? "B" : "A") ?? (e.id.endsWith("-B") ? undefined : song.sheet.crowd);
    const set = (s: Signal, o: Origin) => {
      if (!found.has(s.id)) found.set(s.id, o);
    };

    if (tool === "find_artist") {
      const tags = savedTags(e.raw);
      const filled = Array.isArray(crowd?.standIns);
      for (const s of e.signals) {
        if (tags === "words") set(s, "qloo");
        else if (filled) set(s, "notonq");
        else if (tags) {
          const tag = tags.find((t) => t.name === s.label);
          if (tag) set(s, tag.notonq ? "notonq" : "qloo");
        } else if (beforeNotOnQ) set(s, "qloo");
      }
    } else if (tool === "read_crowd" && crowd) {
      // The crowd step's signals are, in order: the home, the city (when there is one), then the ages.
      let placeTaken = !crowd.place;
      for (const s of e.signals) {
        if (s.kind === "home") {
          const src = crowd.home?.source;
          if (src) set(s, src === "qloo" || src === "qloo+musicbrainz" ? "qloo" : src === "notonq" ? "notonq" : "other");
        } else if (s.kind === "crowd" && !placeTaken) {
          placeTaken = true;
          set(s, crowd.from.place === "qloo" ? "qloo" : "other");
        } else if (s.kind === "crowd") set(s, crowd.from.ages === "qloo" ? "qloo" : "other");
      }
    } else if (tool === "vocal_style" || tool === "craft_pass") {
      for (const s of e.signals) set(s, "other");
    } else if (tool && QLOO_TOOLS.has(tool)) {
      for (const s of e.signals) set(s, "qloo");
    }
  }

  const count: Record<Origin, number> = { qloo: 0, notonq: 0, other: 0 };
  const unknown: string[] = [];
  const signals = song.sheet.signals.map((s) => {
    if (s.origin) return s;
    const origin = found.get(s.id);
    if (!origin) unknown.push(s.id);
    const o = origin ?? "other";
    count[o]++;
    return { ...s, origin: o };
  });
  return { sheet: { ...song.sheet, signals }, set: count, unknown };
}
