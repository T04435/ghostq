"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { songArtist, type SongSheet } from "@/lib/song-sheet";

/** The share text for a saved song: title and credit, the crowd, the draft label, the link. */
export function shareLines(sheet: SongSheet, url: string): string[] {
  const crowds = sheet.featuring ? `both crowds: ${describeCrowd(sheet.crowd)} and ${describeCrowd(sheet.featuring.crowd)}` : `the crowd of ${sheet.artist}: ${describeCrowd(sheet.crowd)}`;
  return [`${sheet.title} · ${songArtist(sheet)}`, `Written by GhostQ for ${crowds}.`, `${draftLabel(sheet.artist, sheet.featuring?.artist)}.`, url];
}

/** The DS's ShareText on shadcn Popover + Button: the lines to paste, their length, and Copy text and link. */
export function ShareText({ sheet, url }: { sheet: SongSheet; url: string }) {
  const [copied, setCopied] = useState(false);
  const lines = shareLines(sheet, url);
  const text = lines.join("\n");
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2 aria-hidden />
          Share text
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">Share text</span>
          <span className="font-mono text-[10px] text-muted-foreground">{text.length} chars</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg bg-muted px-3.5 py-3 text-[13px] leading-[1.45]">
          {lines.map((l, i) => (
            <span key={i} className={i === 0 ? "font-semibold" : i === 2 ? "text-muted-foreground" : i === 3 ? "font-mono text-xs break-all" : undefined}>
              {l}
            </span>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="self-start" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy text and link"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
