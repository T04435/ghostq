"use client";

import { ReceiptChip } from "@/components/brand/receipt";
import { Card } from "@/components/ui/card";
import type { Signal } from "@/lib/signals";
import type { SongSheet } from "@/lib/song-sheet";
import { clock, SongMap } from "./live-line";
import type { SingAlong } from "./use-sing-along";

/** The line the rail explains: the one being sung, else the next, else the last. */
export function lineInFocus(sheet: Pick<SongSheet, "sections">, sing: SingAlong) {
  const { line, next, previous } = sing.position;
  const i = line >= 0 ? line : next >= 0 ? next : previous;
  const at = sing.timing.lines[i];
  if (!at) return null;
  const heading = line >= 0 ? "THIS LINE COMES FROM" : next >= 0 ? "NEXT LINE COMES FROM" : "LAST LINE CAME FROM";
  return { heading, index: i, line: sheet.sections[at.section]?.lines[at.line] };
}

/**
 * The DS's sing-along rail (Song sheet, following along): the section being sung in Geist Pixel Grid with the time, the
 * song map to jump by section, then the line in focus with the receipts behind it. The song plays from the player card
 * above it.
 */
export function SingAlongPanel({ sheet, sing }: { sheet: SongSheet; sing: SingAlong }) {
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  const focus = lineInFocus(sheet, sing);
  const receipts = [...new Set(focus?.line?.signalIds ?? [])].map((id) => byId.get(id)).filter((s): s is Signal => Boolean(s));
  return (
    <div className="flex flex-col gap-3.5">
      <Card className="gap-[18px] p-5" aria-label="Sing along">
        <div className="flex items-baseline justify-between gap-3">
          <span className="pixel-grid text-[28px] leading-none tracking-[.02em] uppercase">{sing.timing.sections[sing.position.section]?.name}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="pixel-square text-[22px]">{clock(sing.time)}</span>
            <span className="pixel-square text-sm text-muted-foreground">{clock(sing.timing.duration)}</span>
          </span>
        </div>
        <SongMap timing={sing.timing} time={sing.time} onSeek={sing.seek} />
        <span className="text-xs leading-[1.45] text-muted-foreground">
          {sing.heard ? "Tap a line or a section to jump. Timed from the recording." : "Tap a line or a section to jump. Timed from the sheet until the recording is timed, so it can drift."}
        </span>
      </Card>
      {focus?.line && (
        <Card className="gap-3.5 p-5" aria-live="polite">
          <span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground">{focus.heading}</span>
          <span className="text-[17px] leading-[1.35] font-medium text-pretty">{focus.line.text}</span>
          <div className="flex flex-col gap-2.5">
            {receipts.map((s) => (
              <div key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <ReceiptChip signal={s} active />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{s.label.trim()}</span>
                  <span className="text-xs text-muted-foreground">{s.source}</span>
                </span>
                <span className="pixel-circle text-base">{s.value ?? ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
