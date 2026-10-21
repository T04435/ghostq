import { normalizeCrowd, type Brief } from "./brief";
import type { SongSheet } from "./song-sheet";
import { normalizeVocals } from "./voice";

/**
 * The last brief and song, kept on this device only. v2 since 21 Oct: the brief is the artist and story only and the
 * sheet carries the crowd; older saves don't fit and are ignored. A v2 sheet from before 22 Oct is read into today's
 * shape (a city id on the crowd, one lead voice instead of vocals).
 */
const KEY = "ghostq:last-run:v2";

export type LastRun = { brief: Brief; sheet: SongSheet | null; at: string };

export function loadLastRun(): LastRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as LastRun;
    if (!run.sheet) return run;
    const { voice, ...sheet } = run.sheet as SongSheet & { voice?: unknown };
    return { ...run, sheet: { ...sheet, crowd: normalizeCrowd(sheet.crowd), vocals: normalizeVocals(sheet.vocals ?? voice) } };
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
