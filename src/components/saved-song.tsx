"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { CrowdCard } from "@/components/crowd-card";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** A saved song: the crowd, the research that made it (replayed from the saved events), and the sheet with its audio. */
export function SavedSong({ sheet, research, audioUrl }: { sheet: SongSheet; research: RunEvent[]; audioUrl?: string }) {
  const steps = useMemo(() => research.reduce<StepItem[]>((items, event, n) => applyStepEvent(items, event, n), []), [research]);
  return (
    <div className="grid gap-8">
      <SongSheetView sheet={sheet} readOnly audioUrl={audioUrl} />
      <CrowdCard artist={sheet.artist} crowd={sheet.crowd} />
      <Collapsible className="rounded-lg border p-4">
        <CollapsibleTrigger className="group/research flex w-full cursor-pointer items-center gap-2 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronRight className="size-4 transition-transform group-aria-expanded/research:rotate-90" aria-hidden />
          How GhostQ researched this song ({steps.filter((s) => s.kind === "step").length} Qloo steps)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <RunSteps items={steps} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
