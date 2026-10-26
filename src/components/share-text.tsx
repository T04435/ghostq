"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { SITE_URL } from "@/lib/site";
import { songArtist, type SongSheet } from "@/lib/song-sheet";

/** The share text for a saved song: title and credit, the crowd, the draft label, the link. */
export function shareLines(sheet: SongSheet, url: string): string[] {
  const crowds = sheet.featuring ? `both crowds: ${describeCrowd(sheet.crowd)} and ${describeCrowd(sheet.featuring.crowd)}` : `the crowd of ${sheet.artist}: ${describeCrowd(sheet.crowd)}`;
  return [`${sheet.title} · ${songArtist(sheet)}`, `Written by GhostQ for ${crowds}.`, `${draftLabel(sheet.artist, sheet.featuring?.artist)}.`, url];
}


/**
 * F4: ONE Share control for a song. The browser's own share sheet where there is one (a phone), else the link is copied
 * with "Link copied" feedback. The link is always the production one (ghostq.xyz), so it previews the song anywhere.
 */
export function ShareButton({ sheet, path, size = "sm", variant = "secondary", className }: { sheet: SongSheet; path: string; size?: "sm" | "xs"; variant?: "secondary" | "outline" | "ghost"; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${path}`;
  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${sheet.title} · ${songArtist(sheet)}`, text: shareLines(sheet, url).slice(0, 3).join("\n"), url });
        return;
      } catch (e) {
        // Cancelling the sheet is the user's choice; any other refusal falls back to copying the link.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button variant={variant} size={size} onClick={() => void share()} className={cn(className)} aria-live="polite">
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}

/**
 * The DS's ShareText: the lines to paste (title and credit, the crowd, the draft label, the link), their length, and
 * Copy text and link, plus Share (the share sheet, or the link copied). `inline` shows it as a card (the side rail of a
 * finished song); otherwise a "Share text" button opens it in a shadcn Popover. The link is the production one.
 */
export function ShareText({ sheet, path, inline = false }: { sheet: SongSheet; /** The song's own path, "/song/<id>". */ path: string; inline?: boolean }) {
  const [copied, setCopied] = useState<"text" | null>(null);
  const url = `${SITE_URL}${path}`;
  const lines = shareLines(sheet, url);
  const text = lines.join("\n");

  async function copy(what: "text") {
    await navigator.clipboard.writeText(text);
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
        <ShareButton sheet={sheet} path={path} variant="outline" />
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
