"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { songArtist, type SongSheet } from "@/lib/song-sheet";

/** The share text for a saved song: title and credit, the crowd, the draft label, the link. */
export function shareLines(sheet: SongSheet, url: string): string[] {
  const crowds = sheet.featuring ? `both crowds: ${describeCrowd(sheet.crowd)} and ${describeCrowd(sheet.featuring.crowd)}` : `the crowd of ${sheet.artist}: ${describeCrowd(sheet.crowd)}`;
  return [`${sheet.title} · ${songArtist(sheet)}`, `Written by GhostQ for ${crowds}.`, `${draftLabel(sheet.artist, sheet.featuring?.artist)}.`, url];
}

const noSubscribe = () => () => {};

/**
 * The DS's ShareText: the lines to paste (title and credit, the crowd, the draft label, the link), their length, and
 * Copy text and link, plus Copy share link for the bare URL. `inline` shows it as a card (the side rail of a finished
 * song); otherwise a "Share text" button opens it in a shadcn Popover.
 */
export function ShareText({ sheet, path, inline = false }: { sheet: SongSheet; /** The song's own path, "/song/<id>"; the browser adds its origin. */ path: string; inline?: boolean }) {
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  // The origin is only known in the browser: the server render (and hydration) shows the path, then the full link.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const url = `${origin}${path}`;
  const lines = shareLines(sheet, url);
  const text = lines.join("\n");

  async function copy(what: "text" | "link") {
    await navigator.clipboard.writeText(what === "text" ? text : url);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">Share text</span>
        <span className="font-mono text-[10px] text-muted-foreground">{text.length} chars</span>
      </div>
      <div className="flex flex-col gap-1 rounded-[10px] bg-muted px-3.5 py-3 text-[13px] leading-[1.45]">
        {lines.map((l, i) => (
          <span key={i} className={i === 0 ? "font-semibold" : i === 2 ? "text-muted-foreground" : i === 3 ? "font-mono text-xs break-all" : undefined}>
            {l}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copy("text")}>
          {copied === "text" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied === "text" ? "Copied" : "Copy text and link"}
        </Button>
        <Button variant="outline" size="sm" aria-label="Copy share link" onClick={() => void copy("link")}>
          {copied === "link" ? <Check aria-hidden /> : <Link2 aria-hidden />}
          {copied === "link" ? "Link copied" : "Copy link"}
        </Button>
      </div>
    </>
  );

  if (inline) {
    return (
      <Card className="gap-2.5 p-3.5" role="group" aria-label="Share this song">
        {body}
      </Card>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2 aria-hidden />
          Share text
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">{body}</PopoverContent>
    </Popover>
  );
}
