"use client";

import { cn } from "cn";
import type { SongTiming, TimedLine } from "@/lib/song-timing";
import { wordAt } from "@/lib/song-timing";

/**
 * A line as it's sung (the DS's sing-along words): the words already sung and the one being sung on lime, the rest
 * plain. `sung` marks the whole line (a finished line, or line mode).
 */
export function LiveWords({ text, line, time, className }: { text: string; line?: TimedLine; time: number; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const at = line ? wordAt(text, line, time) : -1;
  return (
    <span className={cn("flex flex-wrap gap-x-[.28em] gap-y-1", className)}>
      {words.map((w, i) => (
        <span
          key={i}
          aria-current={i === at ? "true" : undefined}
          className={cn("rounded-[4px] transition-[background-color,color,box-shadow] duration-100", i <= at && "bg-signal text-signal-foreground shadow-[0_0_0_3px_var(--signal)]")}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

/** The chords over a line with the one being played on lime (the chords split evenly across the line's words). */
export function LiveChords({ chords, text, line, time, className }: { chords: string; text: string; line?: TimedLine; time: number; className?: string }) {
  const tokens = chords.split(/(\s+)/);
  const names = tokens.filter((t) => t.trim());
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const at = line ? wordAt(text, line, time) : -1;
  const current = at < 0 || at >= words ? -1 : Math.min(names.length - 1, Math.floor((at / words) * names.length));
  let n = -1;
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {tokens.map((t, i) => {
        if (!t.trim()) return t;
        n++;
        return (
          <span key={i} className={cn("-mx-[3px] rounded-[4px] px-[3px] transition-colors duration-100", n === current && "bg-signal text-signal-foreground")}>
            {t}
          </span>
        );
      })}
    </span>
  );
}

/** Three dots that count in the next line in its last three seconds, drawn like the mark. */
export function CountIn({ timing, time, size = 14 }: { timing: SongTiming; time: number; size?: number }) {
  const next = timing.lines.find((l) => l.start > time);
  const left = next ? next.start - time : 99;
  const filled = left <= 3 ? Math.min(3, 3 - Math.floor(left)) : 0;
  return (
    <span className="flex" style={{ gap: size * 0.7 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("rounded-full transition-colors duration-200", i < filled ? "bg-signal" : "bg-muted")} style={{ width: size, height: size }} />
      ))}
    </span>
  );
}

/** What the gap between lines says: the instrumental part and when the next line comes, or just breathe. */
export function gapLabel(timing: SongTiming, time: number, section: number): string {
  const next = timing.lines.find((l) => l.start > time);
  if (!next) return "End of song";
  const name = timing.sections[section]?.name ?? "";
  return /^(intro|outro|instrumental|interlude|solo|break)/i.test(name) ? `${name} · next line in ${Math.ceil(next.start - time)} s` : "Breathe";
}

/** The song map: one segment per section, as long as the section, filled as it plays; tap one to jump to it. */
export function SongMap({ timing, time, onSeek, className }: { timing: SongTiming; time: number; onSeek: (t: number) => void; className?: string }) {
  const now = Math.max(0, timing.sections.findIndex((s) => time >= s.start && time < s.end));
  return (
    <div className={cn("flex gap-[3px]", className)} role="group" aria-label="Song map">
      {timing.sections.map((s, i) => {
        const pct = i < now ? 100 : i > now ? 0 : ((time - s.start) / (s.end - s.start)) * 100;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSeek(s.start)}
            aria-label={`Jump to ${s.name}`}
            className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
            style={{ flex: s.end - s.start }}
          >
            <span className="relative block h-1.5 overflow-hidden rounded-[3px] bg-muted">
              <span className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${pct}%` }} />
            </span>
            <span className={cn("truncate font-mono text-[10px] text-foreground", i === now && "font-semibold")}>{s.short}</span>
          </button>
        );
      })}
    </div>
  );
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
