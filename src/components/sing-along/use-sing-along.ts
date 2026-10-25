"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayer, type QSong } from "@/components/qplayer/player-context";
import type { SongSheet } from "@/lib/song-sheet";
import type { SungTiming } from "@/lib/lyric-align";
import { fitTiming, planTiming, positionAt, timingFromSung, type SongTiming } from "@/lib/song-timing";

export type SingAlong = {
  timing: SongTiming;
  /** True when the timing was heard in the recording (Whisper), false when it's the plan stretched to the track. */
  heard: boolean;
  /** Seconds into the song (0 until it plays). */
  time: number;
  playing: boolean;
  /** Whether this song is the one loaded in the QPlayer. */
  live: boolean;
  position: ReturnType<typeof positionAt>;
  /** Jumps to a second, starting the song when it isn't playing. */
  seek: (time: number) => void;
  toggle: () => void;
};

/**
 * The sing-along clock for one sung song: the planned timing (song-timing) stretched to the real track, and where the
 * voice is now, read from the QPlayer while this song is the one it plays. `audio`: the song's address, so a tapped
 * line can start it. `sung`: when the lines were actually heard (Whisper), which replaces the plan. Null without audio.
 */
export function useSingAlong(sheet: Pick<SongSheet, "id" | "tempo" | "sections">, audio?: QSong, sung?: SungTiming | null): SingAlong | null {
  const player = usePlayer();
  const live = Boolean(player && audio && player.song?.id === audio.id);
  const duration = live && player!.duration ? player!.duration : 0;
  const plan = useMemo(() => planTiming(sheet), [sheet]);
  const timing = useMemo(() => (sung ? timingFromSung(sheet, sung) : fitTiming(plan, duration)), [sheet, sung, plan, duration]);
  if (!player || !audio) return null;
  const time = live ? player.time : 0;
  return {
    timing,
    heard: Boolean(sung),
    time,
    playing: live && player.playing,
    live,
    position: positionAt(timing, time),
    seek: (t) => (live ? player.seek(t) : player.playAt(audio, t)),
    toggle: () => (live ? player.toggle() : player.playAt(audio, 0)),
  };
}

/**
 * The heard timing for a sung song: the saved one, else (a fresh sing, timed on the server after it lands) asked for
 * every 5 s for up to two minutes.
 */
export function useSungTiming(id: string | undefined, sung: string | undefined, saved: SungTiming | null | undefined): SungTiming | null {
  const [fetched, setFetched] = useState<{ src: string; timing: SungTiming } | null>(null);
  const need = Boolean(id && sung && !saved && fetched?.src !== sung);
  useEffect(() => {
    if (!need) return;
    let tries = 0;
    const iv = setInterval(async () => {
      if (++tries > 24) return clearInterval(iv);
      const r = await fetch(`/api/songs/${id}`).catch(() => null);
      const timing = r?.ok ? ((await r.json()) as { audio?: { timing?: SungTiming | null } }).audio?.timing : null;
      if (timing) {
        clearInterval(iv);
        setFetched({ src: sung!, timing });
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [need, id, sung]);
  return saved ?? (fetched && fetched.src === sung ? fetched.timing : null);
}

const sheets = new Map<string, Promise<{ sheet: SongSheet; timing: SungTiming | null } | null>>();

/** A saved song's sheet and heard timing for the QPlayer (fetched once per song and kept for the visit). */
export function useSavedSheet(id: string | undefined): { sheet: SongSheet; timing: SungTiming | null } | null {
  const [entry, setEntry] = useState<{ id: string; value: { sheet: SongSheet; timing: SungTiming | null } | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let on = true;
    if (!sheets.has(id)) {
      sheets.set(
        id,
        fetch(`/api/songs/${id}`)
          .then((r) => (r.ok ? (r.json() as Promise<{ sheet: SongSheet; audio?: { timing?: SungTiming | null } | null }>) : null))
          .then((s) => (s ? { sheet: { ...s.sheet, id }, timing: s.audio?.timing ?? null } : null))
          .catch(() => null),
      );
    }
    void sheets.get(id)!.then((value) => on && setEntry({ id, value }));
    return () => {
      on = false;
    };
  }, [id]);
  return entry && entry.id === id ? entry.value : null;
}
