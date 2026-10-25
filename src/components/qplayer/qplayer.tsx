"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { usePlayer } from "@/components/qplayer/player-context";
import { draftLabel } from "@/lib/draft-label";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * The DS's QPlayer: a 48 px graphite bar under the header, sticky, on every page once a song plays. Previous, the lime
 * play button and Next (the user's call, 26 Oct: next walks forward through what's been played, else picks a random sung
 * song, and a song that ends goes on to it), the title · credit over the draft label, then (wide, from 1024 px) a lime progress line, the
 * time in Geist Pixel Square and Open song, and Mute. Dense (640 to 1023 px) drops the progress and time; compact (a
 * phone) keeps the short label.
 */
export function QPlayer() {
  const player = usePlayer();
  if (!player?.song) return null;
  const { song, playing, time, duration, muted } = player;
  const label = draftLabel(song.artist, song.featuring ?? undefined);
  const credit = song.featuring ? `${song.artist} feat. ${song.featuring}` : song.artist;
  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  const icon = "inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-full opacity-80 outline-none hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring";

  return (
    <div
      role="region"
      aria-label="QPlayer"
      className="sticky top-0 z-40 flex h-12 items-center gap-1 bg-foreground pr-2.5 pl-2 text-background sm:gap-3 sm:pr-(--page-x) sm:pl-[calc(var(--page-x)-6px)]"
    >
      <button type="button" onClick={player.prev} title="Previous song" aria-label="Previous song" className={icon}>
        <SkipBack className="size-3.5 fill-current" aria-hidden />
      </button>
      <button
        type="button"
        onClick={player.toggle}
        aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
        className="inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-full bg-signal text-[oklch(0.18_0.03_115)] outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {playing ? <Pause className="size-[13px] fill-current" aria-hidden /> : <Play className="size-[13px] fill-current" aria-hidden />}
      </button>
      <button type="button" onClick={() => void player.next()} title="Next song" aria-label="Next song" className={icon}>
        <SkipForward className="size-3.5 fill-current" aria-hidden />
      </button>
      <Link href={`/song/${song.id}`} className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 leading-[1.15] outline-none focus-visible:underline">
        <span className="truncate text-[13px] font-semibold">
          {song.title}
          <span className="font-normal opacity-75"> · {credit}</span>
        </span>
        <span title={label} className="truncate text-[10.5px] opacity-80">
          <span className="sm:hidden">GhostQ draft · AI-generated · not affiliated</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
      </Link>
      <span
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        className="relative hidden h-[3px] w-[120px] flex-none overflow-hidden rounded-[2px] bg-[rgba(128,128,128,.35)] lg:block"
      >
        <span className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${pct}%` }} />
      </span>
      <span className="hidden pixel-square text-[13px] whitespace-nowrap lg:inline">
        {clock(time)} <span className="opacity-60">/ {clock(duration)}</span>
      </span>
      <Link href={`/song/${song.id}`} className="hidden flex-none text-xs font-semibold whitespace-nowrap underline underline-offset-3 lg:inline">
        Open song
      </Link>
      <button type="button" onClick={() => player.setMuted(!muted)} title={muted ? "Unmute" : "Mute"} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className={icon}>
        {muted ? <VolumeX className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
      </button>
    </div>
  );
}
