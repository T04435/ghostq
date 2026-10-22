import type { AskField, Crowd } from "./brief";
import type { Signal } from "./signals";
import type { SongSheet } from "./song-sheet";

/** One line of the NDJSON stream from POST /api/write. */
export type RunEvent =
  | { type: "note"; text: string }
  | { type: "step-start"; id: string; tool: string; label: string; input: unknown }
  /** `raw` is Qloo's response: kept in the store with the song, never sent to a browser (see publicEvent). */
  | { type: "step-end"; id: string; ok: boolean; summary: string; signals: Signal[]; raw?: unknown }
  /** `who`: CollabQ's artist A (the default) or B (the "feat." artist). */
  | { type: "crowd"; artist: string; crowd: Crowd; who?: "A" | "B" }
  /** The run stopped: Qloo has no data for these. The page asks, then sends the brief again with the answers. */
  | { type: "ask"; fields: AskField[]; artist: string; message: string; who?: "A" | "B" }
  | { type: "writing"; signalCount: number }
  | { type: "sheet"; sheet: SongSheet }
  /** `budget`: a daily budget or a rate limit was hit; the page points to the Library, whose songs always play. */
  | { type: "error"; message: string; budget?: boolean }
  | { type: "done"; qlooCalls: number; qlooCached: number; seconds: number };

/**
 * An event as a browser may see it: Qloo's raw response is dropped. Only what the page shows leaves the server:
 * summaries, signal labels and scores, entity names (Qloo's terms; their support confirmed this is fine, 22 Oct).
 */
export function publicEvent(event: RunEvent): RunEvent {
  if (event.type !== "step-end") return event;
  const rest = { ...event };
  delete rest.raw;
  return rest;
}

export const TOOL_LABELS: Record<string, string> = {
  find_artist: "Find the artist on Qloo",
  read_crowd: "Read the artist's crowd",
  compare_crowds: "What their crowds share",
  sound_from_words: "Turn words into genres",
  sound_alikes: "Who you sound like",
  artists_in_genres: "Artists in your genres, ranked for this crowd",
  crowd_tags: "What this crowd cares about",
  local_scene: "The local scene",
  crowd_taste: "What this crowd watches and reads",
  fan_audiences: "Your fans' lifestyles",
  ready_to_write: "Pick the signals for the song",
};
