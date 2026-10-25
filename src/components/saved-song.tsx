"use client";

import { useMemo } from "react";
import { CrowdCard } from "@/components/crowd-card";
import { RemixCard } from "@/components/remix-card";
import { RemixCompare } from "@/components/remix-compare";
import { RemixList } from "@/components/remix-links";
import { SectionCollapsible } from "@/components/section-collapsible";
import type { Crowd } from "@/lib/brief";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** A saved song: the crowd, the research that made it (replayed from the saved events), and the sheet with its audio. */
export function SavedSong({
  sheet,
  original,
  remixes = [],
  research,
  audioUrl,
}: {
  sheet: SongSheet;
  /** RemixQ: the song this one remixes, shown side by side. */
  original?: SongSheet;
  /** RemixQ: the songs that remix this one. */
  remixes?: { id: string; title: string; crowd: Crowd }[];
  research: RunEvent[];
  audioUrl?: string;
}) {
  const steps = useMemo(() => research.reduce<StepItem[]>((items, event, n) => applyStepEvent(items, event, n), []), [research]);
  return (
    <div className="grid gap-8">
      {original && <RemixCompare original={original} remix={sheet} />}
      {/* A song nobody has sung yet can be sung from its page (Lyria, with the usual limits); a sung one just plays. */}
      <SongSheetView sheet={sheet} readOnly={Boolean(audioUrl)} audioUrl={audioUrl} />
      <RemixCard sheet={sheet} />
      {remixes.length > 0 && <RemixList remixes={remixes} />}
      <CrowdCard artist={sheet.artist} crowd={sheet.crowd} />
      {sheet.featuring && <CrowdCard artist={sheet.featuring.artist} crowd={sheet.featuring.crowd} featured />}
      <SectionCollapsible
        title="How GhostQ researched this song"
        meta={`${steps.filter((s) => s.kind === "step" && s.tool !== "craft_pass" && s.tool !== "vocal_style").length} Qloo steps`}
      >
        <div className="pt-2">
          <RunSteps items={steps} />
        </div>
      </SectionCollapsible>
    </div>
  );
}
