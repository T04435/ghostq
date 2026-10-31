"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SongSheet } from "@/components/song-sheet";
import { describeCrowd } from "@/lib/brief";
import { lineDiffs, type DiffWord } from "@/lib/remix";
import type { SongSheet as Sheet } from "@/lib/song-sheet";

/**
 * RemixQ (the DS's RemixCompare): a head with the count of changed lines, then the original and the remix as two
 * compact SongSheets side by side (stacked under 940 px), each with its own receipts. Changes read like tracked
 * changes: the remix's new words underlined, the original's replaced words struck, lines kept as they were dimmed.
 */
export function RemixCompare({ original, remix }: { original: Sheet; remix: Sheet }) {
  const diffs = useMemo(() => lineDiffs(original, remix), [original, remix]);
  const total = remix.sections.reduce((n, s) => n + s.lines.length, 0);
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-4" aria-label="Original and remix side by side">
      <div className="col-span-full flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-lg border bg-card px-4 py-3.5">
        <h2 className="inline-flex items-baseline gap-1.5 text-base font-semibold">
          <span className="sr-only">Original and remix: </span>
          <span className="pixel-square text-[22px]">{diffs.remix.size}</span>of<span className="pixel-square text-[22px]">{total}</span>lines changed
        </h2>
        <span className="text-[13px] text-muted-foreground">Kept: title, key, tempo, sections, hook</span>
        <span className="text-[13px] text-muted-foreground">
          <ins className="text-foreground underline decoration-2 underline-offset-[5px]">New words</ins> in the remix,{" "}
          <del>replaced words</del> in the original, lines kept as they were dimmed
        </span>
      </div>
      <Version label="ORIGINAL" sheet={original} side="original" lines={diffs.original} />
      <Version label="REMIX" sheet={remix} side="remix" lines={diffs.remix} />
    </section>
  );
}

function Version({ label, sheet, side, lines }: { label: string; sheet: Sheet; side: "original" | "remix"; lines: Map<string, DiffWord[]> }) {
  return (
    <SongSheet
      sheet={sheet}
      compact
      diff={{ side, lines }}
      caption={
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            {label} · {describeCrowd(sheet.crowd).toUpperCase()}
          </span>
          {sheet.id && (
            <Link href={`/song/${sheet.id}`} className="font-sans text-xs tracking-normal underline underline-offset-3">
              Open its page
            </Link>
          )}
        </span>
      }
    />
  );
}
