"use client";

import { BookOpen, GitFork, Mic, Pause, Play } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { audioSrc, usePlayer } from "@/components/qplayer/player-context";
import { Button } from "@/components/ui/button";
import { AGE_BANDS } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import type { SongSummary } from "@/lib/song-summary";

export type SongCardSong = Pick<SongSummary, "id" | "title" | "artist" | "featuring" | "remixOf" | "crowd" | "language" | "sung" | "audioVersion"> & { remixCount?: number };

/**
 * ONE song card (the DS's LibrarySongCard on shadcn Item), for Library rows and the recent and example strips: play
 * (or a sheet icon when it isn't sung), the title with REMIX and SUNG/SHEET, the artist, the draft label (always), and
 * the crowd chips. A sung song's round button plays it in the QPlayer (one audio for the site); `actions` adds Sing it
 * on unsung songs (the Library).
 */
export function SongCard({ song, compact = false, actions = false }: { song: SongCardSong; compact?: boolean; actions?: boolean }) {
  const player = usePlayer();
  const playing = Boolean(player?.playing && player.song?.id === song.id);
  const band = song.crowd.ages[0] ? AGE_BANDS[song.crowd.ages[0].age] : "all ages";
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[36px_minmax(0,1fr)] items-start rounded-lg border bg-card text-foreground transition-colors hover:border-foreground",
        compact ? "gap-3 px-3.5 py-3" : "gap-3.5 px-4 py-3.5",
      )}
    >
      {player ? (
        <Button
          type="button"
          size="icon"
          disabled={!song.sung}
          className={cn("size-9 rounded-full disabled:opacity-100", playing ? "bg-primary text-primary-foreground" : song.sung ? "bg-foreground text-card" : "bg-muted text-muted-foreground")}
          aria-label={song.sung ? (playing ? `Pause ${song.title}` : `Play ${song.title}`) : `${song.title} hasn't been sung yet`}
          onClick={() => player.play({ id: song.id, title: song.title, artist: song.artist, featuring: song.featuring, src: audioSrc(song.id, song.audioVersion) })}
        >
          {playing ? <Pause className="size-3.5 fill-current" aria-hidden /> : song.sung ? <Play className="size-3.5 fill-current" aria-hidden /> : <BookOpen className="size-3.5" aria-hidden />}
        </Button>
      ) : (
        <span aria-hidden className={cn("inline-flex size-9 items-center justify-center rounded-full", song.sung ? "bg-foreground text-card" : "bg-muted text-muted-foreground")}>
          {song.sung ? <Play className="size-3.5 fill-current" /> : <BookOpen className="size-3.5" />}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 items-start justify-between gap-2.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={`/song/${song.id}`} className="text-base leading-tight font-semibold tracking-[-0.01em] wrap-anywhere hover:underline">
              {song.title}
            </Link>
            {song.remixOf && (
              <Badge variant="strong">
                <GitFork aria-hidden />
                REMIX
              </Badge>
            )}
          </span>
          <Badge variant={song.sung ? "signal" : "outline"} className="mt-0.5">
            {song.sung ? "SUNG" : "SHEET"}
          </Badge>
        </span>
        <span className="text-[13px] leading-[1.35] wrap-anywhere">
          {song.featuring ? `${song.artist} feat. ${song.featuring}` : song.artist}
          {song.remixOf ? ` · remix of ${song.remixOf}` : ""}
        </span>
        <span className="text-[11px] leading-[1.4] text-pretty text-muted-foreground">{draftLabel(song.artist, song.featuring ?? undefined)}</span>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="inline-flex items-baseline gap-[5px] rounded-full bg-muted px-[9px] py-[3px] text-xs whitespace-nowrap">
            {song.crowd.place?.name ?? "Worldwide"} <span className="pixel-circle text-[13px]">{band}</span>
          </span>
          <span className="rounded-full bg-muted px-2 py-[3px] font-mono text-[11px] whitespace-nowrap">{song.language}</span>
          {Boolean(song.remixCount) && (
            <span className="inline-flex items-baseline gap-1 pl-0.5 text-xs whitespace-nowrap text-muted-foreground">
              <span className="pixel-square text-[13px] text-foreground">{song.remixCount}</span> remixes
            </span>
          )}
          {!song.sung && actions && (
            <Button variant="outline" size="xs" asChild className="ml-auto">
              <Link href={`/song/${song.id}#sing`}>
                <Mic aria-hidden />
                Sing it
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
