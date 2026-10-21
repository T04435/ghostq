import type { AskField, Crowd } from "./brief";
import type { Signal } from "./signals";
import type { SongSheet } from "./song-sheet";

/** One line of the NDJSON stream from POST /api/write. */
export type RunEvent =
  | { type: "note"; text: string }
  | { type: "step-start"; id: string; tool: string; label: string; input: unknown }
  | { type: "step-end"; id: string; ok: boolean; summary: string; signals: Signal[]; raw: unknown }
  | { type: "crowd"; artist: string; crowd: Crowd }
  /** The run stopped: Qloo has no data for these. The page asks, then sends the brief again with the answers. */
  | { type: "ask"; fields: AskField[]; artist: string; message: string }
  | { type: "writing"; signalCount: number }
  | { type: "sheet"; sheet: SongSheet }
  | { type: "error"; message: string }
  | { type: "done"; qlooCalls: number; qlooCached: number; seconds: number };

export const TOOL_LABELS: Record<string, string> = {
  find_artist: "Find the artist on Qloo",
  read_crowd: "Read the artist's crowd",
  sound_from_words: "Turn words into genres",
  sound_alikes: "Who you sound like",
  artists_in_genres: "Artists in your genres, ranked for this crowd",
  crowd_tags: "What this crowd cares about",
  local_scene: "The local scene",
  crowd_taste: "What this crowd watches and reads",
  fan_audiences: "Your fans' lifestyles",
  ready_to_write: "Pick the signals for the song",
};
