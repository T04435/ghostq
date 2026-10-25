"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayer, type QSong } from "@/components/qplayer/player-context";
import type { SongSheet } from "@/lib/song-sheet";
import { fitTiming, planTiming, positionAt, type SongTiming } from "@/lib/song-timing";

export type SingAlong = {
  timing: SongTiming;
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
 * line can start it. Null without audio.
 */
export function useSingAlong(sheet: Pick<SongSheet, "id" | "tempo" | "sections">, audio?: QSong): SingAlong | null {
  const player = usePlayer();
  const live = Boolean(player && audio && player.song?.id === audio.id);
  const duration = live && player!.duration ? player!.duration : 0;
  const plan = useMemo(() => planTiming(sheet), [sheet]);
  const timing = useMemo(() => fitTiming(plan, duration), [plan, duration]);
  if (!player || !audio) return null;
  const time = live ? player.time : 0;
  return {
    timing,
    time,
    playing: live && player.playing,
    live,
    position: positionAt(timing, time),
    seek: (t) => (live ? player.seek(t) : player.playAt(audio, t)),
    toggle: () => (live ? player.toggle() : player.playAt(audio, 0)),
  };
}

const sheets = new Map<string, Promise<SongSheet | null>>();

/** A saved song's sheet for the QPlayer (fetched once per song and kept for the visit). */
export function useSavedSheet(id: string | undefined): SongSheet | null {
  const [sheet, setSheet] = useState<{ id: string; sheet: SongSheet | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let on = true;
    if (!sheets.has(id)) {
      sheets.set(
        id,
        fetch(`/api/songs/${id}`)
          .then((r) => (r.ok ? (r.json() as Promise<{ sheet: SongSheet }>) : null))
          .then((s) => (s ? { ...s.sheet, id } : null))
          .catch(() => null),
      );
    }
    void sheets.get(id)!.then((s) => on && setSheet({ id, sheet: s }));
    return () => {
      on = false;
    };
  }, [id]);
  return sheet && sheet.id === id ? sheet.sheet : null;
}
