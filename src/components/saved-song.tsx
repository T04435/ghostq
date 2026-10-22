"use client";

import { useMemo } from "react";
import { CrowdCard } from "@/components/crowd-card";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** A saved song: the crowd, the research that made it (replayed from the saved events), and the sheet with its audio. */
export function SavedSong({ sheet, research, audioUrl }: { sheet: SongSheet; research: RunEvent[]; audioUrl?: string }) {
  const steps = useMemo(() => research.reduce<StepItem[]>((items, event, n) => applyStepEvent(items, event, n), []), [research]);
  return (
    <div className="grid gap-8">
      <SongSheetView sheet={sheet} readOnly audioUrl={audioUrl} />
      <CrowdCard artist={sheet.artist} crowd={sheet.crowd} />
      <details className="grid gap-4 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">How GhostQ researched this song ({steps.filter((s) => s.kind === "step").length} Qloo steps)</summary>
        <div className="mt-4">
          <RunSteps items={steps} />
        </div>
      </details>
    </div>
  );
}
