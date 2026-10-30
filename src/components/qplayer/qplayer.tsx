"use client";

import { ArrowUpRight, Maximize, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { usePlayer } from "@/components/qplayer/player-context";
import { FullScreenSingAlong } from "@/components/sing-along/full-screen";
import { CountIn, gapLabel, LiveWords } from "@/components/sing-along/live-line";
import { useSavedSheet, useSingAlong } from "@/components/sing-along/use-sing-along";
import { draftLabel } from "@/lib/draft-label";
import { SongTitle } from "@/components/song-title";
import { Tip } from "@/components/tip";

const NO_SHEET = { tempo: 90, sections: [] };
const phone = () => window.matchMedia("(max-width: 639px)").matches;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * The DS's QPlayer: a 48 px graphite bar under the header, sticky, on every page once a song plays. Previous, the lime
 * play button and Next (the user's call, 26 Oct: next walks forward through what's been played, else picks a random sung
 * song, and a song that ends goes on to it), the title · credit over the draft label, then (wide, from 1024 px) a lime progress line, the
 * time in Geist Pixel Square and Open song, and Mute. Dense (640 to 1023 px) drops the progress and time; compact (a
 * phone) keeps the short label. Sing-along: while a line is sung its words light up in place of the label (the bar then
 * says "GhostQ draft" after the credit), with the count-in between lines; the expand button, or the title on a phone,
 * opens the full-screen sing-along (the title opens the song's page from 640 px).
 */
export function QPlayer() {
  const player = usePlayer();
  const router = useRouter();
  const [full, setFull] = useState(false);
  const saved = useSavedSheet(player?.song?.id);
  const sheet = saved?.sheet ?? null;
  const sing = useSingAlong(sheet ?? NO_SHEET, sheet ? (player?.song ?? undefined) : undefined, saved?.timing);
  if (!player?.song) return null;
  const { song, playing, time, duration, muted } = player;
  const label = draftLabel(song.artist, song.featuring ?? undefined);
  const credit = song.featuring ? `${song.artist} feat. ${song.featuring}` : song.artist;
  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  const live = sing && sheet ? sing.position : null;
  const lineText = live && live.line >= 0 ? sheet!.sections[sing!.timing.lines[live.line].section]?.lines[sing!.timing.lines[live.line].line]?.text : undefined;
  const between = Boolean(live && live.line < 0 && live.next >= 0 && sing!.time > 0);
  // The ^ opens the full-screen sing-along at any size (the user, 26 Oct); the title does too on a phone, and opens the
  // song's page on anything wider.
  const expand = (e?: MouseEvent) => {
    if (sheet && sing && (!e || phone())) {
      e?.preventDefault();
      setFull(true);
    } else if (!e) router.push(`/song/${song.id}`);
  };
  const icon = "inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-full opacity-80 outline-none hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring";

  return (
    <div
      role="region"
      aria-label="QPlayer"
      className="sticky top-0 z-40 flex h-12 items-center gap-1 bg-foreground pr-2.5 pl-2 text-background sm:gap-3 sm:pr-(--page-x) sm:pl-[calc(var(--page-x)-6px)]"
    >
      <Tip label="Previous song">
        <button type="button" onClick={player.prev} aria-label="Previous song" className={icon}>
          <SkipBack className="size-3.5 fill-current" aria-hidden />
        </button>
      </Tip>
      <button
        type="button"
        onClick={player.toggle}
        aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
        className="inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-full bg-signal text-[oklch(0.18_0.03_115)] outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {playing ? <Pause className="size-[13px] fill-current" aria-hidden /> : <Play className="size-[13px] fill-current" aria-hidden />}
      </button>
      <Tip label="Next song">
        <button type="button" onClick={() => void player.next()} aria-label="Next song" className={icon}>
          <SkipForward className="size-3.5 fill-current" aria-hidden />
        </button>
      </Tip>
      <Link href={`/song/${song.id}`} onClick={expand} className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 leading-[1.15] outline-none focus-visible:underline">
        {/* Title and artist in Geist Pixel Circle, as on the Library card and the sheet (the user, 26 Oct). */}
        <span className="flex min-w-0 items-baseline gap-2 text-[13px]">
          <SongTitle size="sm" title={song.title} artist={credit} truncate className="[&>span:last-child]:text-current [&>span:last-child]:opacity-75" />
          {(lineText || between) && <span className="flex-none opacity-75">· GhostQ draft</span>}
        </span>
        {lineText ? (
          <LiveWords text={lineText} line={sing!.timing.lines[live!.line]} time={sing!.time} className="flex-nowrap overflow-hidden text-xs leading-[1.2] font-medium whitespace-nowrap" />
        ) : between ? (
          <span className="flex items-center gap-2 text-xs opacity-80">
            {gapLabel(sing!.timing, sing!.time, live!.section)}
            <CountIn timing={sing!.timing} time={sing!.time} size={7} />
          </span>
        ) : (
          <Tip label={label} side="bottom">
            <span className="truncate text-[10.5px] opacity-80">
              <span className="sm:hidden">GhostQ draft · AI-generated · not affiliated</span>
              <span className="hidden sm:inline">{label}</span>
            </span>
          </Tip>
        )}
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
      <Tip label="Open song">
        <Link href={`/song/${song.id}`} aria-label="Open song" className={`${icon} hidden lg:inline-flex`}>
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </Tip>
      {sheet && (
        <Tip label="Sing along">
          <button type="button" onClick={() => expand()} aria-label="Sing along" className={icon}>
            <Maximize className="size-3.5" aria-hidden />
          </button>
        </Tip>
      )}
      <Tip label={muted ? "Unmute" : "Mute"}>
        <button type="button" onClick={() => player.setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className={icon}>
          {muted ? <VolumeX className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
        </button>
      </Tip>
      {sheet && sing && <FullScreenSingAlong open={full} onOpenChange={setFull} sheet={sheet} sing={sing} onPrev={player.prev} onNext={() => void player.next()} />}
    </div>
  );
}
