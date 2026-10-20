import type { Brief } from "./brief";
import type { SongSheet } from "./song-sheet";

/** The last brief and song, kept on this device only (no database in the MVP). */
const KEY = "ghostq:last-run";

export type LastRun = { brief: Brief; sheet: SongSheet | null; at: string };

export function loadLastRun(): LastRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as LastRun;
    // Briefs saved before 21 Oct had one `age`; now `ages` holds up to three.
    const old = run.brief as LastRun["brief"] & { age?: Brief["ages"][number] };
    if (!Array.isArray(old.ages)) run.brief = { ...old, ages: [old.age ?? "25_to_29"] };
    return run;
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
