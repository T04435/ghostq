"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeCrowd } from "@/lib/brief";
import { changedLines } from "@/lib/remix";
import type { SongSheet } from "@/lib/song-sheet";

/**
 * RemixQ: the original and the remix side by side (stacked on a phone), each with its own receipts. Lines the remix
 * changed for the new crowd are marked.
 */
export function RemixCompare({ original, remix }: { original: SongSheet; remix: SongSheet }) {
  const changed = useMemo(() => changedLines(original, remix), [original, remix]);
  const total = remix.sections.reduce((n, s) => n + s.lines.length, 0);
  return (
    <section className="grid gap-3" aria-label="Original and remix side by side">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">Original and remix</h2>
        <p className="text-sm text-muted-foreground">
          {changed.size} of {total} lines changed for the new crowd (marked).
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Version label="Original" sheet={original} />
        <Version label="Remix" sheet={remix} changed={changed} />
      </div>
    </section>
  );
}

function Version({ label, sheet, changed }: { label: string; sheet: SongSheet; changed?: Set<string> }) {
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  const cited = [...new Set(sheet.sections.flatMap((s) => s.lines.flatMap((l) => l.signalIds)))].map((id) => byId.get(id)).filter((s) => s !== undefined);
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant={changed ? "default" : "secondary"}>{label}</Badge>
          {sheet.id && (
            <Link href={`/song/${sheet.id}`} className="text-xs text-muted-foreground underline">
              Open its page
            </Link>
          )}
        </div>
        <CardTitle>{sheet.title}</CardTitle>
        <CardDescription>For {describeCrowd(sheet.crowd)}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {sheet.sections.map((section, s) => (
          <div key={`${section.name}-${s}`} className="grid gap-1">
            <h3 className="text-sm font-semibold">{section.name}</h3>
            {section.lines.map((line, l) => {
              const isChanged = changed?.has(`${s}:${l}`);
              return (
                <p key={l} className={`flex flex-wrap items-baseline gap-x-2 rounded px-2 py-0.5 text-sm ${isChanged ? "border-l-2 border-primary bg-accent" : ""}`}>
                  <span>{line.text}</span>
                  {isChanged && <span className="sr-only">(changed)</span>}
                  <span className="flex flex-wrap gap-1">
                    {[...new Set(line.signalIds)].map((id) => (
                      <Tooltip key={id}>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="font-mono" tabIndex={0}>
                            {id}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{byId.get(id)?.label ?? "Unknown signal"}</TooltipContent>
                      </Tooltip>
                    ))}
                  </span>
                </p>
              );
            })}
          </div>
        ))}
        <Collapsible>
          <CollapsibleTrigger className="group/receipts flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronRight className="size-4 transition-transform group-aria-expanded/receipts:rotate-90" aria-hidden />
            Receipts ({cited.length} Qloo signals)
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 grid gap-1 text-sm">
              {cited.map((x) => (
                <li key={x.id} className="flex flex-wrap gap-x-2">
                  <span className="font-mono font-medium">{x.id}</span>
                  <strong>{x.label}</strong>
                  <span className="text-muted-foreground">{x.source}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
