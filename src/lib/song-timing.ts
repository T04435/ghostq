import type { SongSheet } from "./song-sheet";

/** The length GhostQ asks Lyria for ("an original 2-minute song"). */
export const PLANNED_SECONDS = 120;

export type TimedSection = { name: string; short: string; start: number; end: number; lyric: boolean };
export type TimedLine = { section: number; line: number; start: number; end: number };
export type SongTiming = { duration: number; sections: TimedSection[]; lines: TimedLine[] };

const INSTRUMENTAL = /^(intro|outro|instrumental|interlude|solo|break)\b/i;

/** "Verse 1" → "V1", "Pre-Chorus" → "Pre", "Chorus" → "Ch": the song map's labels. */
export function shortName(name: string): string {
  const n = name.trim();
  const num = n.match(/\d+/)?.[0] ?? "";
  if (/^pre/i.test(n)) return "Pre";
  if (/^(verse|verso|couplet|strophe|vers)/i.test(n)) return `V${num}`;
  if (/(chorus|estribillo|coro|refr|hook|ritornello)/i.test(n)) return `Ch${num}`;
  if (/^(bridge|puente|ponte|pont|br[uü]cke)/i.test(n)) return "Br";
  if (/^intro/i.test(n)) return "In";
  if (/^outro/i.test(n)) return "Out";
  return n.slice(0, 4);
}

/**
 * The song's timeline, planned from the sheet alone: two bars of 4/4 a line at the sheet's tempo, a two-bar intro and
 * outro, and a one-bar breath after each section, scaled to `duration`. The same plan goes to Lyria as timestamps
 * (sing-prompt) and drives the sing-along, scaled to the real track's length, so the sheet follows the audio without
 * a transcription. Lyria doesn't return timings (its text is the lyrics with empty "[:]" stamps, probed 22 Oct).
 */
export function planTiming(sheet: Pick<SongSheet, "tempo" | "sections">, duration = PLANNED_SECONDS): SongTiming {
  const bar = 240 / Math.max(50, sheet.tempo || 90);
  type Block = { name: string; bars: number; lyric: boolean; lines: number };
  const blocks: Block[] = [{ name: "Intro", bars: 2, lyric: false, lines: 0 }];
  sheet.sections.forEach((s, i) => {
    const lyric = s.lines.length > 0 && !INSTRUMENTAL.test(s.name);
    blocks.push({ name: s.name, bars: lyric ? s.lines.length * 2 : 4, lyric, lines: s.lines.length });
    if (i < sheet.sections.length - 1) blocks[blocks.length - 1].bars += 1;
  });
  blocks.push({ name: "Outro", bars: 2, lyric: false, lines: 0 });
  const scale = duration / blocks.reduce((n, b) => n + b.bars * bar, 0);

  const sections: TimedSection[] = [];
  const lines: TimedLine[] = [];
  let t = 0;
  let sheetIndex = -1;
  for (const b of blocks) {
    const isSheet = b !== blocks[0] && b !== blocks[blocks.length - 1];
    if (isSheet) sheetIndex++;
    const length = b.bars * bar * scale;
    sections.push({ name: b.name, short: shortName(b.name), start: t, end: t + length, lyric: b.lyric });
    if (isSheet && b.lyric) {
      const per = 2 * bar * scale;
      for (let l = 0; l < b.lines; l++) lines.push({ section: sheetIndex, line: l, start: t + l * per, end: t + (l + 1) * per });
    }
    t += length;
  }
  return { duration, sections, lines };
}

/** The plan stretched to the real track (Lyria lands near, not on, two minutes). */
export function fitTiming(plan: SongTiming, duration: number): SongTiming {
  if (!duration || Math.abs(duration - plan.duration) < 0.01) return plan;
  const k = duration / plan.duration;
  return {
    duration,
    sections: plan.sections.map((s) => ({ ...s, start: s.start * k, end: s.end * k })),
    lines: plan.lines.map((l) => ({ ...l, start: l.start * k, end: l.end * k })),
  };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The plan as Lyria's documented timestamp lines ("[0:00 - 0:08] Intro"), one per section. */
export function timingForPrompt(plan: SongTiming): string {
  return plan.sections.map((s) => `[${clock(s.start)} - ${clock(s.end)}] ${s.name}`).join("\n");
}

/** Rough syllables in a word (vowel groups), so long words hold longer than short ones. At least one. */
function weight(word: string): number {
  return Math.max(1, word.toLowerCase().match(/[aeiouyáéíóúàèìòùâêîôûäëïöüãõœæ]+/g)?.length ?? 1);
}

/**
 * Where the voice is inside a line at time `t`: the index of the word being sung (-1 before it starts, the word count
 * once it's done). Words share 90% of the line, weighted by syllables; the last 10% is the breath.
 */
export function wordAt(text: string, line: TimedLine, t: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (t < line.start) return -1;
  const total = words.reduce((n, w) => n + weight(w), 0);
  const span = (line.end - line.start) * 0.9;
  let at = line.start;
  for (let i = 0; i < words.length; i++) {
    at += (weight(words[i]) / total) * span;
    if (t < at) return i;
  }
  return words.length;
}

/** Where the song is at `t`: the section, the line being sung (or -1 between lines) and the next one. */
export function positionAt(timing: SongTiming, t: number): { section: number; line: number; next: number; previous: number } {
  const section = Math.max(0, timing.sections.findIndex((s) => t >= s.start && t < s.end));
  const line = timing.lines.findIndex((l) => t >= l.start && t < l.end);
  const next = timing.lines.findIndex((l) => l.start > t);
  let previous = -1;
  timing.lines.forEach((l, i) => {
    if (l.end <= t) previous = i;
  });
  return { section: t >= timing.duration ? timing.sections.length - 1 : section, line, next, previous };
}
