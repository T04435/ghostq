"use client";

import { CircleAlert, Clock, Info, MicAudioLines } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { audioSrc } from "@/components/qplayer/player-context";
import { leadLabel, VocalLinePicker, type VocalDraft } from "@/components/vocal-line-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { draftLabel } from "@/lib/draft-label";
import type { SongSheet } from "@/lib/song-sheet";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { AGENT_NAME_START } from "@/lib/agent-persona";

// AI Elements' Audio Player, browser-only (its media-chrome elements can't hydrate from server HTML).
const SongAudio = dynamic(() => import("@/components/song-audio"), { ssr: false, loading: () => <Skeleton className="h-11 w-full rounded-full" /> });

export type SingState = { status: "idle" | "singing" | "done" | "error"; url?: string; message?: string; retry?: boolean; budget?: boolean };

/**
 * The DS's Player, 1:1: the lead voice (idle and ready), then by state: idle (Sing it and its note), waiting (Lyria is
 * singing, about 50 s), ready (play, progress, times, download, then Sing again), failed (a soft destructive box, or the
 * warning one when the budget is spent). The draft label closes it, with the watermark tag once sung. `readOnly`: a
 * saved song that's sung just plays.
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
  const collab = Boolean(sheet.featuring);
  const voice = leadLabel(draft, collab);
  const ready = song.status === "done" && song.url;
  const showVoice = !readOnly && song.status !== "singing" && !(song.status === "error" && song.budget);

  return (
    <Card id="sing" className="scroll-mt-24 gap-4 p-[18px]" role="group" aria-label="Sing the song">
      {showVoice && <VocalLinePicker sheet={sheet} draft={draft} onChange={onDraft} />}

      {!readOnly && (song.status === "idle" || (song.status === "error" && !song.budget && !song.retry)) && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onSing} disabled={!canSing} className="h-11 gap-2 rounded-full px-5 text-[15px] font-semibold">
            <MicAudioLines aria-hidden />
            Sing it
          </Button>
          <span className="min-w-40 flex-1 text-xs leading-[1.45] text-muted-foreground">
            {canSing ? "About a minute. A track of about 3 minutes from Google Lyria. Each sing costs credits." : "Choose a lead voice first."}
          </span>
        </div>
      )}

      {song.status === "error" && !song.budget && !song.retry && (
        <p className="text-xs text-destructive" role="alert">
          {song.message}
        </p>
      )}

      {song.status === "singing" && (
        <div className="flex flex-col gap-2.5" role="status">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <GhostMark size={GHOST_SIZES.status} state="working" decorative />
            {AGENT_NAME_START} is singing it with Google Lyria · about 50 seconds
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-[3px] bg-muted" aria-hidden>
            <div className="absolute inset-y-0 left-0 w-[38%] animate-pulse rounded-[3px] bg-signal" />
          </div>
          <span className="text-xs text-muted-foreground">{voice} · about 3 minutes · you can keep reading the sheet</span>
        </div>
      )}

      {ready && (
        <div className="flex flex-col gap-3">
          <SongAudio
            src={song.url!}
            voice={voice.toUpperCase()}
            fileName={fileName}
            // The QPlayer carries a saved song across pages by its address (a fresh sing plays from a blob URL that dies with the page).
            song={sheet.id ? { id: sheet.id, title: sheet.title, artist: sheet.artist, featuring: sheet.featuring?.artist, src: song.url!.startsWith("blob:") ? audioSrc(sheet.id) : song.url! } : undefined}
          />
          {!readOnly && (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Button variant="outline" size="sm" className="h-[30px] rounded-full px-3 text-xs font-semibold" onClick={onSing} disabled={!canSing}>
                  Sing again
                </Button>
                each sing costs credits
              </span>
            </div>
          )}
        </div>
      )}

      {song.status === "error" && (song.budget || song.retry) && (
        <div className={`flex flex-col gap-2.5 rounded-[10px] px-3.5 py-3 ${song.budget ? "bg-warning text-warning-foreground" : "bg-destructive-soft text-foreground"}`} role="alert">
          <div className="flex items-start gap-2.5 text-[13px] leading-[1.45]">
            {song.budget ? <Clock className="mt-px size-4 flex-none" aria-hidden /> : <CircleAlert className="mt-px size-4 flex-none text-destructive" aria-hidden />}
            <span>
              <strong>{song.budget ? "Today’s singing budget is used up." : "Singing didn’t go through."}</strong> {song.message}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {song.budget ? (
              <Button asChild size="sm" className="h-8 rounded-full px-3.5 text-[13px] font-semibold">
                <Link href="/library">Play an example</Link>
              </Button>
            ) : (
              <Button size="sm" className="h-8 rounded-full px-3.5 text-[13px] font-semibold" onClick={onSing} disabled={!canSing}>
                Try again
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-2 border-t pt-3 text-xs leading-[1.45] text-muted-foreground">
        <Info className="mt-0.5 size-3 flex-none" strokeWidth={2.5} aria-hidden />
        <span className="min-w-0 flex-1">{draftLabel(sheet.artist, sheet.featuring?.artist)}</span>
        {ready && <span className="rounded-full border px-[7px] py-0.5 font-mono text-[10px] whitespace-nowrap">WATERMARKED · LYRIA</span>}
      </div>
    </Card>
  );
}
