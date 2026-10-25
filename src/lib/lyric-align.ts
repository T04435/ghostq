// No runtime imports: scripts/time-songs.ts runs this file directly in Node.

/** A transcription segment (Whisper through AI Gateway): what was heard and when. */
export type HeardSegment = { text: string; start: number; end: number };

/** When each sheet line is sung, in sheet order (sections flattened); null where the line wasn't heard. */
export type SungTiming = { duration: number; lines: ({ start: number; end: number } | null)[]; source: "whisper" };

const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

function close(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Sung words come back clipped ("goin'" for "going") or misheard by a letter or two ("harbor", "Takafuna").
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  let diff = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff++;
  return diff <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 4));
}

/**
 * Matches what Whisper heard to the sheet's lines: both become word lists, aligned in order (Needleman–Wunsch, so a
 * skipped, repeated or misheard word costs a gap, not the rest of the song). Each heard word gets a time spread over
 * its segment by letters; a line runs from its first matched word to its last. Lines with too few matched words
 * (under a quarter) count as not heard. Junk segments ("Thanks for watching!") match nothing and drop out.
 */
export function alignLyrics(lines: string[], heard: HeardSegment[], duration: number): SungTiming {
  const sheet: { w: string; line: number }[] = [];
  lines.forEach((text, line) => text.split(/\s+/).map(norm).filter(Boolean).forEach((w) => sheet.push({ w, line })));
  const said: { w: string; start: number; end: number; seg: number; line?: number }[] = [];
  for (const [segIndex, seg] of heard.entries()) {
    const words = seg.text.split(/\s+/).map(norm).filter(Boolean);
    const letters = words.reduce((n, w) => n + w.length, 0) || 1;
    let at = seg.start;
    for (const w of words) {
      const span = ((seg.end - seg.start) * w.length) / letters;
      said.push({ w, start: at, end: at + span, seg: segIndex });
      at += span;
    }
  }

  const n = sheet.length;
  const m = said.length;
  const GAP = -1;
  const score = new Float64Array((n + 1) * (m + 1));
  const from = new Uint8Array((n + 1) * (m + 1)); // 1 diagonal, 2 up (skip sheet word), 3 left (skip heard word)
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) {
    score[at(i, 0)] = i * GAP;
    from[at(i, 0)] = 2;
  }
  for (let j = 1; j <= m; j++) {
    score[at(0, j)] = j * GAP;
    from[at(0, j)] = 3;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[at(i - 1, j - 1)] + (close(sheet[i - 1].w, said[j - 1].w) ? 2 : -1);
      const up = score[at(i - 1, j)] + GAP;
      const left = score[at(i, j - 1)] + GAP;
      const best = Math.max(diag, up, left);
      score[at(i, j)] = best;
      from[at(i, j)] = best === diag ? 1 : best === up ? 2 : 3;
    }
  }

  const hits: { line: number; start: number; end: number; j: number }[] = [];
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const step = from[at(i, j)];
    if (step === 1) {
      if (close(sheet[i - 1].w, said[j - 1].w)) {
        hits.push({ line: sheet[i - 1].line, start: said[j - 1].start, end: said[j - 1].end, j: j - 1 });
        said[j - 1].line = sheet[i - 1].line;
      }
      i--;
      j--;
    } else if (step === 2) i--;
    else j--;
  }

  const words = lines.map((text) => text.split(/\s+/).filter(Boolean).length);
  const out: SungTiming["lines"] = lines.map((_, line) => {
    const own = hits.filter((h) => h.line === line);
    if (own.length < Math.max(1, words[line] / 4)) return null;
    // A misheard opening ("Prout to court" for "Pōhutukawa") still belongs to the line: unmatched words just before its
    // first match, in the same segment, move its start back.
    let j = Math.min(...own.map((h) => h.j));
    while (j > 0 && said[j - 1].line === undefined && said[j - 1].seg === said[j].seg) j--;
    return { start: said[j].start, end: Math.max(...own.map((h) => h.end)) };
  });
  // Whisper's segments can swallow an instrumental stretch (the first often starts at 0:00 over the intro): a line far
  // longer than the typical line starts where its singing would, counted back from its end.
  const spans = out.filter((t): t is { start: number; end: number } => Boolean(t)).map((t) => t.end - t.start).sort((a, b) => a - b);
  const typical = spans[Math.floor(spans.length / 2)] ?? 0;
  if (typical) out.forEach((t) => t && t.end - t.start > typical * 1.6 && (t.start = t.end - typical * 1.2));
  // Lines must run forward: a stray early or late match never lets a line start before the previous one.
  let last = 0;
  out.forEach((t, i) => {
    if (!t) return;
    if (t.start < last) out[i] = null;
    else last = t.end;
  });
  return { duration, lines: out, source: "whisper" };
}
