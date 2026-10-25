"use client";

import { CircleAlert, Clock, Download, Info, Mic } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { VocalLinePicker, type VocalDraft } from "@/components/vocal-line-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { draftLabel } from "@/lib/draft-label";
import type { SongSheet } from "@/lib/song-sheet";

// AI Elements' Audio Player, browser-only (its media-chrome elements can't hydrate from server HTML).
const SongAudio = dynamic(() => import("@/components/song-audio"), { ssr: false, loading: () => <Skeleton className="h-11 w-full rounded-full" /> });

export type SingState = { status: "idle" | "singing" | "done" | "error"; url?: string; message?: string; retry?: boolean; budget?: boolean };

/**
 * The DS's Player (on AI Elements' Audio Player): the voices to sing with, then by state: idle (Sing it), waiting
 * (Lyria is singing), ready (the track, Sing again), failed (an Alert inside, the budget one in warning colours).
 * The draft label closes it, with the watermark tag once sung. `readOnly`: a saved song that's sung just plays.
 */
export function SongPlayer({
  sheet,
  song,
  draft,
  onDraft,
  canSing,
  readOnly,
  onSing,
}: {
  sheet: SongSheet;
  song: SingState;
  draft: VocalDraft;
  onDraft: (draft: VocalDraft) => void;
  canSing: boolean;
  readOnly: boolean;
  onSing: () => void;
}) {
  const fileName = `${sheet.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "song"}.mp3`;
  return (
    <Card id="sing" className="scroll-mt-24 gap-4 p-[18px]" role="group" aria-label="Sing the song">
      {!readOnly && song.status !== "singing" && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[15px] font-semibold">{sheet.vocals.voices.length > 1 ? "Lead voices" : "Lead voice"}</h3>
          <VocalLinePicker sheet={sheet} draft={draft} onChange={onDraft} />
        </div>
      )}

      {!readOnly && song.status === "singing" && (
        <div className="flex flex-col gap-2.5">
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-muted" aria-hidden>
            <div className="h-full w-[38%] animate-pulse rounded-[3px] bg-foreground" />
          </div>
          <span className="text-xs text-muted-foreground">A 2-minute track from Google Lyria · you can keep reading the sheet</span>
        </div>
      )}

      {song.status === "done" && song.url && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <SongAudio src={song.url} />
            </div>
            <Button variant="ghost" size="icon" asChild className="text-foreground">
              <a href={song.url} download={fileName} title="Download .mp3" aria-label="Download .mp3">
                <Download aria-hidden />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Sung and produced by Google Lyria from this sheet. AI-generated, with an inaudible SynthID watermark.</p>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size={song.status === "done" ? "sm" : "default"} variant={song.status === "done" ? "outline" : "default"} onClick={onSing} disabled={song.status === "singing" || !canSing}>
            {song.status === "singing" ? <Spinner /> : <Mic aria-hidden />}
            {song.status === "singing" ? <span className="shimmer">Singing… (can take a few minutes)</span> : song.status === "done" ? "Sing again" : "Sing it"}
          </Button>
          <span className="min-w-40 flex-1 text-xs leading-[1.45] text-muted-foreground">
            {!canSing ? "Choose every voice first." : song.status === "done" ? "Each sing costs credits." : "About a minute. A 2-minute track from Google Lyria. Each sing costs credits."}
          </span>
        </div>
      )}

      {song.status === "error" && (
        <Alert variant={song.budget ? "budget" : "destructive"}>
          {song.budget ? <Clock aria-hidden /> : <CircleAlert aria-hidden />}
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{song.message}</span>
            {song.budget && (
              <Link href="/library" className="font-medium underline">
                Listen to the songs in the Library
              </Link>
            )}
            {song.retry && (
              <Button size="xs" onClick={onSing} disabled={!canSing}>
                Try again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-2 border-t pt-3 text-xs leading-[1.45] text-muted-foreground">
        <Info className="mt-0.5 size-3 flex-none" strokeWidth={2.5} aria-hidden />
        <span className="min-w-0 flex-1">{draftLabel(sheet.artist, sheet.featuring?.artist)}</span>
        {song.status === "done" && <Badge variant="outline">WATERMARKED · LYRIA</Badge>}
      </div>
    </Card>
  );
}
