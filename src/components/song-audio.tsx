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
    <AudioPlayer className="w-full">
      <AudioPlayerElement src={src} />
      <AudioPlayerControlBar>
        <AudioPlayerPlayButton />
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
