import type { Brief } from "./brief";
import type { SongSheet } from "./song-sheet";

/**
 * The last brief and song, kept on this device only. v2 since 21 Oct: the brief is the artist and story only and the
 * sheet carries the crowd; older saves don't fit and are ignored.
 */
const KEY = "ghostq:last-run:v2";

export type LastRun = { brief: Brief; sheet: SongSheet | null; at: string };

export function loadLastRun(): LastRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastRun) : null;
  } catch {
    return null;
  }
}

export function saveLastRun(run: LastRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // Storage full or blocked: the song is still on the page.
  }
}
