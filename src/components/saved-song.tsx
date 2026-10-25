"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import Link from "next/link";
import { CrowdCard } from "@/components/crowd-card";
import { RemixCard } from "@/components/remix-card";
import { RemixCompare } from "@/components/remix-compare";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { describeCrowd, type Crowd } from "@/lib/brief";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
      {remixes.length > 0 && (
        <section className="grid gap-2" aria-label="Remixes of this song">
          <h2 className="text-lg font-semibold">Remixed for other crowds</h2>
          <ItemGroup className="gap-2">
            {remixes.map((r) => (
              <Item key={r.id} variant="outline" size="sm" asChild>
                <Link href={`/song/${r.id}`}>
                  <ItemContent>
                    <ItemTitle>{r.title}</ItemTitle>
                    <ItemDescription>For {describeCrowd(r.crowd)}</ItemDescription>
                  </ItemContent>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
      <CrowdCard artist={sheet.artist} crowd={sheet.crowd} />
      {sheet.featuring && <CrowdCard artist={sheet.featuring.artist} crowd={sheet.featuring.crowd} featured />}
      <Collapsible className="rounded-lg border p-4">
        <CollapsibleTrigger className="group/research flex w-full cursor-pointer items-center gap-2 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronRight className="size-4 transition-transform group-aria-expanded/research:rotate-90" aria-hidden />
          How GhostQ researched this song ({steps.filter((s) => s.kind === "step" && s.tool !== "craft_pass" && s.tool !== "vocal_style").length} Qloo steps)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <RunSteps items={steps} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
