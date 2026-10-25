"use client";

import type { SungTiming } from "@/lib/lyric-align";
import { ChevronLeft, PenLine } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AgentStatusLine } from "@/components/brand/agent-status-line";
import { CrowdCard, sharedOf } from "@/components/crowd-card";
import { RemixCard } from "@/components/remix-card";
import { RemixList, RemixOfLink } from "@/components/remix-links";
import { SongBrief } from "@/components/song-sheet";
import { SectionCollapsible } from "@/components/section-collapsible";
import { Button } from "@/components/ui/button";
import { describeCrowd, type Crowd } from "@/lib/brief";
import { applyStepEvent, RunSteps, stepCount, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/**
 * A saved song's page, as the DS lays it out: the sheet with its side rail (the player, ONE crowd card, the remix
 * links, the remix form, Write your own), then the research that made it (replayed from the saved events) as a grid
 * of steps in a collapsible.
 */
export function SavedSong({
  sheet,
  original,
  remixes = [],
  research,
  audioUrl,
  timing,
  link,
}: {
  sheet: SongSheet;
  /** RemixQ: the song this one remixes, linked from the rail. */
  original?: SongSheet;
  /** RemixQ: the songs that remix this one. */
  remixes?: { id: string; title: string; crowd: Crowd }[];
  research: RunEvent[];
  audioUrl?: string;
  /** When each line is sung in that audio (Whisper), for the sing-along. */
  timing?: SungTiming | null;
  /** The page's address as shown at the top ("ghostq.app/song/…"). */
  link: string;
}) {
  const steps = useMemo(() => research.reduce<StepItem[]>((items, event, n) => applyStepEvent(items, event, n), []), [research]);
  const qlooCalls = steps.filter((s) => s.kind === "step" && !["craft_pass", "vocal_style", "ready_to_write"].includes(s.tool)).length;
  const compare = steps.flatMap((x) => (x.kind === "step" && x.tool === "compare_crowds" ? x.signals : []));
  const feat = sheet.featuring;
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-(--page-x) pt-7 pb-18">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="xs" asChild className="-ml-1">
          <Link href="/library">
            <ChevronLeft aria-hidden />
            Library
          </Link>
        </Button>
        <span className="font-mono text-[11px] break-all text-muted-foreground">{link} · shared link, no login</span>
      </div>
      {/* A song nobody has sung yet can be sung from its page (Lyria, with the usual limits); a sung one just plays. */}
      <SongSheetView
        sheet={sheet}
        readOnly={Boolean(audioUrl)}
        audioUrl={audioUrl}
        timing={timing}
        asideFirst
        share="popover"
        brief="aside"
        aside={
          <>
            <CrowdCard artist={sheet.artist} crowd={sheet.crowd} partner={feat} shared={feat && compare.length ? sharedOf(sheet.crowd, feat.crowd, compare) : undefined} />
            <SongBrief sheet={sheet} />
            {sheet.remixOf && <RemixOfLink of={{ id: sheet.remixOf.id, title: sheet.remixOf.title, crowdText: describeCrowd((original ?? sheet.remixOf).crowd) }} />}
            {!sheet.remixOf && !feat && <RemixList remixes={remixes} />}
            <RemixCard sheet={sheet} />
            <Button variant="secondary" asChild className="w-full">
              <Link href="/write">
                <PenLine aria-hidden />
                Write your own
              </Link>
            </Button>
          </>
        }
      />
      <section className="flex flex-col gap-3 border-t pt-6">
        <SectionCollapsible title="How GhostQ researched this song" meta={`${stepCount(steps)} steps · ${qlooCalls} Qloo calls`} bare>
          <div className="flex flex-col gap-3 pt-3">
            <AgentStatusLine status={{ state: "replayed" }} />
            <RunSteps items={steps} grid />
          </div>
        </SectionCollapsible>
      </section>
    </div>
  );
}
