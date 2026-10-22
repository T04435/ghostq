import type { SongSheet } from "./song-sheet";

const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * RemixQ: which of the remix's lines differ from the original, by position (the writer keeps the sections and their
 * line counts). A section the original doesn't have counts as changed throughout. Keys are "section:line".
 */
export function changedLines(original: Pick<SongSheet, "sections">, remix: Pick<SongSheet, "sections">): Set<string> {
  const changed = new Set<string>();
  remix.sections.forEach((section, s) => {
    const before = original.sections.find((o) => norm(o.name) === norm(section.name)) ?? original.sections[s];
    section.lines.forEach((line, l) => {
      if (!before || norm(before.lines[l]?.text ?? "") !== norm(line.text)) changed.add(`${s}:${l}`);
    });
  });
  return changed;
}
