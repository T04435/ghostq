"use client";

import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerMuteButton,
  AudioPlayerPlayButton,
  AudioPlayerSeekBackwardButton,
  AudioPlayerSeekForwardButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
  AudioPlayerVolumeRange,
} from "@/components/ai-elements/audio-player";

/**
 * A sung song in AI Elements' Audio Player. Its media-chrome elements render declarative shadow DOM on the server,
 * which never matches on hydration, so the song view loads this in the browser only (next/dynamic, ssr: false).
 */
export default function SongAudio({ src }: { src: string }) {
  return (
    // DS player colours: graphite progress on a muted track, the lime play button, Geist Pixel Square for the times.
    <AudioPlayer
      className="w-full rounded-full border bg-card px-1.5 py-1 [font-variation-settings:var(--px-square)]"
      style={{
        "--media-control-hover-background": "var(--color-muted)",
        "--media-font": "var(--font-pixel)",
        "--media-font-size": "13px",
        "--media-range-bar-color": "var(--color-foreground)",
        "--media-range-track-background": "var(--color-muted)",
        "--media-primary-color": "var(--color-foreground)",
      } as React.CSSProperties}
    >
      <AudioPlayerElement src={src} />
      <AudioPlayerControlBar>
        <AudioPlayerPlayButton className="rounded-full border-0 bg-primary text-primary-foreground hover:opacity-88" />
        <AudioPlayerSeekBackwardButton seekOffset={10} />
        <AudioPlayerSeekForwardButton seekOffset={10} />
        <AudioPlayerTimeDisplay />
        <AudioPlayerTimeRange />
        <AudioPlayerDurationDisplay />
        <AudioPlayerMuteButton />
        <AudioPlayerVolumeRange />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
