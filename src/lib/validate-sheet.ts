import type { Signal } from "./signals";
import type { WrittenSong } from "./song-sheet";

export type Problem = { where: string; issue: string };

function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
}

/**
 * The receipt rules, checked in code (the model can't be trusted to keep them):
 * - every line cites at least one signal, and every cited id exists;
 * - no real artist name appears in a lyric (GhostQ never imitates or name-drops);
 * - no film or book title from the signals appears in a lyric (they set the mood only; added 21 Oct after a bridge
 *   retold Little Women).
 * `artistNames` holds the user's artist and every artist Qloo returned.
 */
export function validateSong(song: WrittenSong, signals: Signal[], artistNames: string[]): Problem[] {
  const ids = new Set(signals.map((s) => s.id));
  // Short names ("RVG", "Pond") are ordinary words too often to block on.
  const names = [...new Set(artistNames.map((n) => n.trim()).filter((n) => n.length >= 5))];
  // Titles of one short word ("Up", "It") are ordinary words too often to block on.
  const titles = signals.filter((s) => (s.kind === "movie" || s.kind === "book") && (s.label.includes(" ") || s.label.length >= 6)).map((s) => s.label.replace(/[:(].*$/, "").trim());
  const problems: Problem[] = [];
  song.sections.forEach((section, si) => {
    section.lines.forEach((line, li) => {
      const where = `${section.name || `Section ${si + 1}`}, line ${li + 1}`;
      if (line.signalIds.length === 0) problems.push({ where, issue: "cites no signal" });
      const unknown = line.signalIds.filter((id) => !ids.has(id));
      if (unknown.length) problems.push({ where, issue: `cites unknown signal ${unknown.join(", ")}` });
      const text = words(line.text);
      for (const name of names) {
        if (text.includes(words(name))) problems.push({ where, issue: `names a real artist (${name})` });
      }
      for (const title of titles) {
        if (text.includes(words(title))) problems.push({ where, issue: `names a film or book (${title}); use its mood, not its title` });
      }
    });
  });
  return problems;
}

/** Last resort after the repair pass: drop unknown ids so the receipts shown are all real. */
export function dropUnknownIds(song: WrittenSong, signals: Signal[]): WrittenSong {
  const ids = new Set(signals.map((s) => s.id));
  return {
    ...song,
    sections: song.sections.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, signalIds: l.signalIds.filter((id) => ids.has(id)) })) })),
  };
}
