"use client";

import { Pause, Play } from "lucide-react";
import { audioSrc, usePlayer } from "@/components/qplayer/player-context";
import { Button } from "@/components/ui/button";

/** Plays a sung song in the QPlayer from a server page (the Landing): the same audio the whole site shares. */
export function PlaySongButton({ song, label = "Play it", variant = "default" }: { song: { id: string; title: string; artist: string; featuring?: string | null; audioVersion: string | null }; label?: string; variant?: "default" | "secondary" }) {
  const player = usePlayer();
  const playing = Boolean(player?.playing && player.song?.id === song.id);
  return (
    <Button
      size="lg"
      variant={variant}
      className="gap-2"
      onClick={() => player?.play({ id: song.id, title: song.title, artist: song.artist, featuring: song.featuring, src: audioSrc(song.id, song.audioVersion) })}
    >
      {playing ? <Pause className="fill-current" aria-hidden /> : <Play className="fill-current" aria-hidden />}
      {playing ? "Pause" : label}
    </Button>
  );
}
