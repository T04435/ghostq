import type { Signal } from "./signals";
import type { SongSheet } from "./song-sheet";

/** One line of the NDJSON stream from POST /api/write. */
export type RunEvent =
  | { type: "note"; text: string }
  | { type: "step-start"; id: string; tool: string; label: string; input: unknown }
  | { type: "step-end"; id: string; ok: boolean; summary: string; signals: Signal[]; raw: unknown }
  | { type: "writing"; signalCount: number }
  | { type: "sheet"; sheet: SongSheet }
  | { type: "error"; message: string }
  | { type: "done"; qlooCalls: number; qlooCached: number; seconds: number };

export const TOOL_LABELS: Record<string, string> = {
  find_artist: "Find the artist on Qloo",
  sound_from_words: "Turn your words into genres",
  sound_alikes: "Who you sound like",
  artists_in_genres: "Artists in your genres, ranked for this crowd",
  fan_profile: "Who your fans are",
  crowd_tags: "What this crowd cares about",
  local_scene: "The local scene",
  crowd_taste: "What this crowd watches and reads",
  fan_audiences: "Your fans' lifestyles",
  ready_to_write: "Pick the signals for the song",
};
