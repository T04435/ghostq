"use client";

import { Minimize, Pause, Play } from "lucide-react";
import { ReceiptChip } from "@/components/brand/receipt";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import type { Signal } from "@/lib/signals";
import type { SongSheet } from "@/lib/song-sheet";
import { clock, CountIn, gapLabel, LiveWords, SongMap } from "./live-line";
import { lineInFocus } from "./sing-along-panel";
import type { SingAlong } from "./use-sing-along";
import { SongTitle } from "@/components/song-title";

/**
 * The DS's full-screen sing-along (a phone, opened from the QPlayer): the section in lime Geist Pixel Grid, the line
 * before (muted), the line being sung large with its words lighting up, the count-in dots between lines, the line
 * after, the current line's receipts, the song map, then time · play · length and the draft label.
 */
export function FullScreenSingAlong({ open, onOpenChange, sheet, sing }: { open: boolean; onOpenChange: (open: boolean) => void; sheet: SongSheet; sing: SingAlong }) {
  const { position, timing, time } = sing;
  const text = (i: number) => {
    const at = timing.lines[i];
    return at ? sheet.sections[at.section]?.lines[at.line]?.text : undefined;
  };
  const current = position.line;
  const before = current >= 0 ? current - 1 : position.previous;
  const after = current >= 0 ? current + 1 : position.next;
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  const focus = lineInFocus(sheet, sing);
  const receipts = [...new Set(focus?.line?.signalIds ?? [])].map((id) => byId.get(id)).filter((s): s is Signal => Boolean(s));
  const credit = sheet.featuring ? `${sheet.artist} feat. ${sheet.featuring.artist}` : sheet.artist;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-[18px] border-0 bg-background px-[22px] pt-5 pb-[26px] data-[side=bottom]:h-dvh sm:gap-6 sm:px-[max(32px,calc((100vw-760px)/2))] sm:pt-8 sm:pb-8">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="icon" className="size-11 flex-none rounded-full" onClick={() => onOpenChange(false)} aria-label="Close the sing-along">
            <Minimize aria-hidden />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* Title and artist in Geist Pixel Circle, as everywhere a song is named (the user, 26 Oct). */}
            <SheetTitle className="min-w-0 font-normal">
              <SongTitle title={sheet.title} artist={credit} truncate />
            </SheetTitle>
            <SheetDescription className="truncate text-xs">{describeCrowd(sheet.crowd)}</SheetDescription>
          </div>
        </div>
        <span className="mt-2 pixel-grid text-[22px] leading-none sm:text-[32px] tracking-[.02em] text-foreground uppercase dark:text-signal">{timing.sections[position.section]?.name}</span>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-[26px]" aria-live="polite">
          {before >= 0 && text(before) && <span className="text-[17px] leading-[1.3] font-medium text-muted-foreground sm:text-2xl">{text(before)}</span>}
          {current >= 0 ? (
            <LiveWords text={text(current) ?? ""} line={timing.lines[current]} time={time} className="text-[28px] leading-[1.25] font-semibold sm:text-[44px]" />
          ) : (
            <div className="flex flex-col gap-3.5">
              <span className="text-[15px] text-muted-foreground">{gapLabel(timing, time, position.section)}</span>
              <CountIn timing={timing} time={time} />
            </div>
          )}
          {after >= 0 && text(after) && <span className="text-xl leading-[1.3] font-medium text-muted-foreground sm:text-[28px]">{text(after)}</span>}
        </div>
        <div className="flex min-h-7 flex-wrap items-center gap-1.5">
          {receipts.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <ReceiptChip signal={s} active />
              <span className="text-xs text-muted-foreground">{s.label.trim()}</span>
            </span>
          ))}
        </div>
        <SongMap timing={timing} time={time} onSeek={sing.seek} />
        <div className="flex items-center justify-between gap-3">
          <span className="w-16 pixel-square text-lg">{clock(time)}</span>
          <button
            type="button"
            onClick={sing.toggle}
            aria-label={sing.playing ? "Pause" : "Play"}
            className="inline-flex size-16 cursor-pointer sm:size-20 items-center justify-center rounded-full bg-signal text-signal-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            {sing.playing ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
          </button>
          <span className="w-16 text-right pixel-square text-lg text-muted-foreground">{clock(timing.duration)}</span>
        </div>
        <span className="text-center font-mono text-[11px] text-muted-foreground">{draftLabel(sheet.artist, sheet.featuring?.artist)} · watermarked</span>
      </SheetContent>
    </Sheet>
  );
}
