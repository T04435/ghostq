"use client";

import { useMemo, useState } from "react";
import { CrowdCard } from "@/components/crowd-card";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** A saved song: the crowd, the research that made it (replayed from the saved events), and the sheet with its audio. */
export function SavedSong({ sheet, research, audioUrl }: { sheet: SongSheet; research: RunEvent[]; audioUrl?: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const steps = useMemo(() => research.reduce<StepItem[]>((items, event, n) => applyStepEvent(items, event, n), []), [research]);
  return (
    <div className="grid gap-8">
      <SongSheetView sheet={sheet} readOnly audioUrl={audioUrl} />
      <CrowdCard artist={sheet.artist} crowd={sheet.crowd} />
      <details className="grid gap-4 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">How GhostQ researched this song ({steps.filter((s) => s.kind === "step").length} Qloo steps)</summary>
        <div className="mt-4 grid gap-4">
          <div className="flex items-center gap-2">
            <Switch id="raw" checked={showRaw} onCheckedChange={setShowRaw} />
            <Label htmlFor="raw">Show raw data</Label>
          </div>
          <RunSteps items={steps} showRaw={showRaw} />
        </div>
      </details>
    </div>
  );
}
