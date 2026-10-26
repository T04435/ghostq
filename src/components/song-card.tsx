"use client";

import { Feather, GitFork, MicAudioLines, Pause, Play } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { ReceiptChip } from "@/components/brand/receipt";
import { audioSrc, usePlayer } from "@/components/qplayer/player-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AGE_BANDS } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import type { SongSummary } from "@/lib/song-summary";
import { SongTitle } from "@/components/song-title";

export type SongCardSong = Pick<SongSummary, "id" | "title" | "artist" | "featuring" | "remixOf" | "crowd" | "language" | "sung" | "audioVersion" | "mine"> &
  Partial<Pick<SongSummary, "key" | "tempo" | "receiptCount" | "receipts">> & { remixCount?: number };

const chip = "inline-flex items-baseline gap-[5px] rounded-full bg-muted px-[9px] py-[3px] text-xs whitespace-nowrap";

/**
 * ONE song card (the DS's LibrarySongCard, redesigned 26 Oct with the user) for Library rows and the recent and example
 * strips:
 * - one round control: play for a sung song, a feather (a written sheet) for one that isn't sung yet;
 * - the title and, smaller, the artist on one line, both in Geist Pixel Circle (the user, 26 Oct); the draft label under it (always);
 * - top right: the Write page's lime Sing it on an unsung song (`actions`, the Library); a sung one says so by its play button;
 * - a footer under a hairline with the song's tags: the crowd, language, key and tempo, the three receipts its lines
 *   cite most, and how many receipts it has, linking to the sheet.
 * Songs written in this browser carry a graphite and lime ring.
 */
export function SongCard({ song, compact = false, actions = false }: { song: SongCardSong; compact?: boolean; actions?: boolean }) {
  const player = usePlayer();
  const playing = Boolean(player?.playing && player.song?.id === song.id);
  const band = song.crowd.ages[0] ? AGE_BANDS[song.crowd.ages[0].age] : "all ages";
  const control = cn("inline-flex size-9 flex-none items-center justify-center rounded-full", song.sung ? (playing ? "bg-primary text-primary-foreground" : "bg-foreground text-card") : "bg-muted text-muted-foreground");
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card text-foreground transition-colors hover:border-foreground",
        // Written in this browser: a graphite, lime, graphite ring (the user, 26 Oct).
        song.mine && "border-foreground shadow-[0_0_0_3px_var(--signal),0_0_0_4px_var(--foreground)]",
      )}
    >
      <div className={cn("grid grid-cols-[36px_minmax(0,1fr)_auto] items-start", compact ? "gap-3 px-3.5 pt-3 pb-2.5" : "gap-3.5 px-4 pt-3.5 pb-3")}>
        {player && song.sung ? (
          <Button
            type="button"
            size="icon"
            className={cn(control, "hover:opacity-90")}
            aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
            onClick={() => player.play({ id: song.id, title: song.title, artist: song.artist, featuring: song.featuring, src: audioSrc(song.id, song.audioVersion) })}
          >
            {playing ? <Pause className="size-3.5 fill-current" aria-hidden /> : <Play className="size-3.5 fill-current" aria-hidden />}
          </Button>
        ) : (
          <span className={control} role="img" aria-label={song.sung ? "Sung" : "A written sheet, not sung yet"}>
            {song.sung ? <Play className="size-3.5 fill-current" aria-hidden /> : <Feather className="size-4" aria-hidden />}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1 pt-0.5">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <SongTitle title={song.title} artist={song.featuring ? `${song.artist} feat. ${song.featuring}` : song.artist} href={`/song/${song.id}`} />
            {song.mine && (
              <Badge variant="strong" className="self-center">
                YOURS
              </Badge>
            )}
            {song.remixOf && (
              <Badge variant="strong" className="self-center" title={`Remix of ${song.remixOf}`}>
                <GitFork aria-hidden />
                REMIX
              </Badge>
            )}
          </span>
          <span className="text-[11px] leading-[1.4] text-pretty text-muted-foreground">{draftLabel(song.artist, song.featuring ?? undefined)}</span>
        </div>
        {!song.sung && actions ? (
          <Button asChild size="sm" className="h-8 gap-1.5 rounded-full px-3 text-[13px] font-semibold">
            <Link href={`/song/${song.id}#sing`}>
              <MicAudioLines aria-hidden />
              Sing it
            </Link>
          </Button>
        ) : null}
      </div>
      <div className={cn("flex flex-wrap items-center gap-1.5 border-t", compact ? "px-3.5 py-2.5" : "px-4 py-3")}>
        <span className={chip}>
          {song.crowd.place?.name ?? "Worldwide"} <span className="pixel-circle text-[13px]">{band}</span>
        </span>
        <span className={cn(chip, "font-mono text-[11px]")}>{song.language}</span>
        {song.key && <span className={cn(chip, "font-mono text-[11px]")}>{song.key}</span>}
        {song.tempo ? <span className={cn(chip, "font-mono text-[11px]")}>{song.tempo} BPM</span> : null}
        {song.receipts?.map((s) => (
          <ReceiptChip key={s.id} signal={s} showLabel />
        ))}
        {Boolean(song.remixCount) && (
          <span className="inline-flex items-baseline gap-1 px-1 text-xs whitespace-nowrap text-muted-foreground">
            <span className="pixel-square text-[13px] text-foreground">{song.remixCount}</span> remixes
          </span>
        )}
        {Boolean(song.receiptCount) && (
          <Link
            href={`/song/${song.id}`}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap hover:border-foreground"
          >
            Receipts <span className="pixel-square text-[13px]">{song.receiptCount}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
