import "server-only";
import { generateText, Output } from "ai";
import { chordProblems } from "@/lib/chords";
import { signalLine } from "@/lib/signals";
import { sectionSchema, type SongSheet, type WrittenSong } from "@/lib/song-sheet";
import { dropUnknownIds, validateSong, type Problem } from "@/lib/validate-sheet";
import { LIMITS, MODELS } from "./models";
import { WRITER_RULES } from "./run";

type Section = WrittenSong["sections"][number];

/**
 * Rewrites one section of a saved song, keeping the rest: same signals, same key and voices, the receipt and chord
 * rules checked in code (one repair, then unknown ids dropped). `note`: what the user wants different, if anything.
 */
export async function rewriteSection(sheet: SongSheet, index: number, note: string | undefined, abortSignal?: AbortSignal): Promise<SongSheet> {
  const target = sheet.sections[index];
  const song = sheet.sections.map((s, si) => [`[${si}] ${s.name}${si === index ? "  <- REWRITE THIS ONE" : ""}`, ...s.lines.map((l) => `  ${l.text}    (${l.chords})`)].join("\n")).join("\n\n");
  const prompt = (previous?: { section: Section; problems: Problem[] }) =>
    [
      `"${sheet.title}" by GhostQ for ${sheet.artist}'s crowd, in ${sheet.language}, key ${sheet.key}, ${sheet.tempo} BPM. Rewrite ONLY section [${index}] "${target.name}": new lines with the same job in the song, the same number of lines (give or take one), chords in the key, and a melody note. Every other section stays as it is.`,
      note ? `What the songwriter wants different: "${note}". Follow it within the rules.` : "Make it clearly better: sharper images, a stronger rhyme, a better fit for the crowd's signals.",
      sheet.sections.length > 1 && /chorus/i.test(target.name) ? "It's a chorus: keep the title as its hook, on the first or last line." : "",
      "",
      "The song:",
      song,
      "",
      "Signals you may cite (each line cites 1–3):",
      ...sheet.signals.map(signalLine),
      "",
      WRITER_RULES,
      previous ? `\nYour previous draft broke these rules. Fix every one:\n${previous.problems.map((p) => `- ${p.where}: ${p.issue}`).join("\n")}\n\nPrevious draft:\n${JSON.stringify(previous.section)}` : "",
    ]
      .filter((l) => l !== "")
      .join("\n");
  const ask = async (p: string) =>
    (
      await generateText({
        model: MODELS.writer,
        output: Output.object({ schema: sectionSchema }),
        prompt: p,
        maxOutputTokens: 2000,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.writerTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output;
  const names = sheet.signals.filter((s) => s.kind === "artist").map((s) => s.label).concat(sheet.artist, sheet.featuring?.artist ?? []);
  const place = (section: Section): SongSheet => ({ ...sheet, sections: sheet.sections.map((s, si) => (si === index ? { ...section, name: target.name, voices: section.voices ?? target.voices } : s)) });
  const problemsIn = (next: SongSheet) => [...validateSong(next, sheet.signals, names), ...chordProblems(next)].filter((p) => p.where.startsWith(target.name));
  let section = await ask(prompt());
  const problems = problemsIn(place(section));
  if (problems.length) section = await ask(prompt({ section, problems }));
  const next = dropUnknownIds(place(section), sheet.signals);
  return { ...sheet, sections: next.sections, warnings: problemsIn({ ...sheet, sections: next.sections }).map((p) => `${p.where}: ${p.issue}`) };
}
