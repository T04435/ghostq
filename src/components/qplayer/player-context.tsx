"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** A song the QPlayer can play: enough for its bar (title, credit, the draft label) and the audio's address. */
export type QSong = { id: string; title: string; artist: string; featuring?: string | null; src: string };

type Player = {
  song: QSong | null;
  playing: boolean;
  time: number;
  duration: number;
  muted: boolean;
  /** Plays a song from the start, or toggles it when it's the one loaded. */
  play: (song: QSong) => void;
  toggle: () => void;
  /** The next song: forward through what's been played, else a random sung song from the Library. A song that ends goes on to it. */
  next: () => Promise<void>;
  /** Back to the start of the song, or (in its first 3 seconds) the song played before it. */
  prev: () => void;
  setMuted: (muted: boolean) => void;
  seek: (time: number) => void;
  /**
   * The song page's own player hands its audio element over while it plays, so the bar shows and steers it; when the
   * page goes away mid-song the shared audio carries on from the same second. Returns the release.
   */
  attach: (el: HTMLAudioElement, song: QSong) => () => void;
};

const PlayerContext = createContext<Player | null>(null);

/** play() rejects when a newer load (the next song) interrupts it; that's expected, not an error. */
const start = (el: HTMLAudioElement) => void el.play().catch(() => {});

/** The QPlayer's state; null outside the provider (the bar and the song cards then do nothing). */
export function usePlayer(): Player | null {
  return useContext(PlayerContext);
}

/** The audio's address for a saved song: the version stamp makes it cacheable for good. */
export function audioSrc(id: string, version?: string | null): string {
  return `/api/songs/${id}/audio${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}

/**
 * ONE audio element for the whole site (the DS's QPlayer on every page): the root layout mounts it once, so a song keeps
 * playing across pages. The active element is this shared one, or the song page's own player while that one plays.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const own = useRef<HTMLAudioElement | null>(null);
  const active = useRef<HTMLAudioElement | null>(null);
  const [song, setSong] = useState<QSong | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMutedState] = useState(false);
  // What's been played this visit, and where in it the player is (prev and next walk it).
  const history = useRef<QSong[]>([]);
  const at = useRef(-1);
  const nextRef = useRef<() => void>(() => {});

  const remember = useCallback((s: QSong) => {
    if (history.current[at.current]?.id === s.id) return;
    history.current = [...history.current.slice(0, at.current + 1), s];
    at.current = history.current.length - 1;
  }, []);

  // Loads a song on the shared audio and plays it from the start.
  const load = useCallback((s: QSong) => {
    const el = own.current;
    if (!el) return;
    if (active.current !== el) {
      active.current?.pause();
      active.current = el;
    }
    el.src = s.src;
    el.currentTime = 0;
    setSong(s);
    setTime(0);
    start(el);
  }, []);

  // Follows whichever element is active: its time, length and play state.
  const follow = useCallback((el: HTMLAudioElement) => {
    const sync = () => {
      if (active.current !== el) return;
      setTime(el.currentTime);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      setPlaying(!el.paused && !el.ended);
    };
    const events = ["timeupdate", "durationchange", "loadedmetadata", "play", "pause", "ended", "seeked"] as const;
    events.forEach((e) => el.addEventListener(e, sync));
    return () => events.forEach((e) => el.removeEventListener(e, sync));
  }, []);

  useEffect(() => {
    const el = own.current!;
    active.current = el;
    const ended = () => nextRef.current();
    el.addEventListener("ended", ended);
    const unfollow = follow(el);
    return () => {
      el.removeEventListener("ended", ended);
      unfollow();
    };
  }, [follow]);

  const play = useCallback(
    (next: QSong) => {
      const el = own.current;
      if (el && active.current === el && song?.id === next.id && el.src.endsWith(next.src)) {
        if (el.paused) start(el);
        else el.pause();
        return;
      }
      remember(next);
      load(next);
    },
    [song, remember, load],
  );

  const toggle = useCallback(() => {
    const el = active.current;
    if (!el) return;
    if (el.paused) start(el);
    else el.pause();
  }, []);

  const next = useCallback(async () => {
    if (at.current < history.current.length - 1) {
      at.current++;
      load(history.current[at.current]);
      return;
    }
    const res = await fetch(`/api/songs/random${song ? `?not=${song.id}` : ""}`);
    if (!res.ok) return;
    const s = (await res.json()) as { id: string; title: string; artist: string; featuring: string | null; audioVersion: string | null };
    const q = { id: s.id, title: s.title, artist: s.artist, featuring: s.featuring, src: audioSrc(s.id, s.audioVersion) };
    remember(q);
    load(q);
  }, [song, remember, load]);

  useEffect(() => {
    nextRef.current = () => void next();
  }, [next]);

  const prev = useCallback(() => {
    const el = active.current;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    if (at.current > 0) {
      at.current--;
      load(history.current[at.current]);
    } else if (el) el.currentTime = 0;
  }, [load]);

  const setMuted = useCallback((m: boolean) => {
    if (own.current) own.current.muted = m;
    if (active.current) active.current.muted = m;
    setMutedState(m);
  }, []);

  const seek = useCallback((t: number) => {
    if (active.current) active.current.currentTime = Math.max(0, t);
  }, []);

  const attach = useCallback(
    (el: HTMLAudioElement, s: QSong) => {
      const unfollow = follow(el);
      const ended = () => nextRef.current();
      el.addEventListener("ended", ended);
      const onPlay = () => {
        remember(s);
        if (active.current === el) return;
        active.current?.pause();
        active.current = el;
        el.muted = own.current?.muted ?? false;
        setSong(s);
        setTime(el.currentTime);
        setPlaying(true);
      };
      el.addEventListener("play", onPlay);
      return () => {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("ended", ended);
        unfollow();
        if (active.current !== el) return;
        // The page is going: the shared audio picks the song up at the same second if it was playing.
        const at = el.currentTime;
        const wasPlaying = !el.paused && !el.ended;
        const shared = own.current!;
        active.current = shared;
        shared.src = s.src;
        shared.currentTime = at;
        setTime(at);
        if (wasPlaying) start(shared);
        else setPlaying(false);
      };
    },
    [follow, remember],
  );

  const value = useMemo(
    () => ({ song, playing, time, duration, muted, play, toggle, next, prev, setMuted, seek, attach }),
    [song, playing, time, duration, muted, play, toggle, next, prev, setMuted, seek, attach],
  );

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={own} preload="metadata" className="hidden">
        <track kind="captions" />
      </audio>
      {children}
    </PlayerContext.Provider>
  );
}
