"use client";

import { Download } from "lucide-react";
import { MediaDurationDisplay, MediaPlayButton, MediaTimeDisplay, MediaTimeRange } from "media-chrome/react";
import { AudioPlayer, AudioPlayerElement } from "@/components/ai-elements/audio-player";
import { Button } from "@/components/ui/button";

/**
 * The DS player's ready row, on AI Elements' Audio Player (media-chrome): a 44 px lime play button, a 6 px lime
 * progress bar on a muted track with the times in Geist Pixel Circle under it and the voice between them, and the
 * download button. Its media-chrome elements render declarative shadow DOM on the server, which never matches on
 * hydration, so the player loads this in the browser only (next/dynamic, ssr: false).
 */
export default function SongAudio({ src, voice, fileName }: { src: string; voice: string; fileName: string }) {
  return (
    <AudioPlayer
      className="block w-full"
      style={
        {
          "--media-primary-color": "var(--color-foreground)",
          "--media-range-bar-color": "var(--color-primary)",
          "--media-range-track-background": "var(--color-muted)",
          "--media-range-track-height": "6px",
          "--media-range-track-border-radius": "3px",
          "--media-range-padding": "0",
          "--media-range-thumb-width": "0",
          "--media-range-thumb-height": "0",
          "--media-time-range-buffered-color": "transparent",
          "--media-control-hover-background": "transparent",
          // AI Elements sets `--media-font` to a bare family, which isn't a valid `font` shorthand, so the times fell back
          // to the row's mono: the full shorthand puts them in Geist Pixel at 14 px (Circle, from the class: the user's
          // call, 25 Oct). No padding or fixed height on the readouts, so they sit 6 px under the bar as the DS draws.
          "--media-font": "normal 14px/1 var(--font-pixel)",
          "--media-font-family": "var(--font-pixel)",
          "--media-font-size": "14px",
          "--media-control-padding": "0",
          "--media-control-height": "auto",
          "--media-text-content-height": "auto",
          "--media-text-color": "var(--color-foreground)",
        } as React.CSSProperties
      }
    >
      <AudioPlayerElement src={src} preload="metadata" />
      {/* One slotted row: media-controller stacks its direct children, so the DS layout lives in this wrapper. */}
      <div className="flex w-full items-center gap-3">
        <MediaPlayButton
          className="flex size-11 flex-none items-center justify-center rounded-full bg-primary p-0 text-primary-foreground hover:opacity-90"
          style={{ "--media-button-icon-width": "18px", "--media-button-icon-height": "18px", "--media-icon-color": "var(--color-primary-foreground)" } as React.CSSProperties}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <MediaTimeRange className="block w-full min-w-0 rounded-[3px] p-0" style={{ width: "100%", height: "6px", minHeight: "6px" }} />
          <div className="flex items-baseline justify-between font-mono text-[10px] leading-none text-muted-foreground">
            <MediaTimeDisplay className="p-0 leading-none text-foreground [font-variation-settings:var(--px-circle)]" />
            <span>{voice}</span>
            <MediaDurationDisplay className="p-0 leading-none text-foreground [font-variation-settings:var(--px-circle)]" />
          </div>
        </div>
        <Button variant="ghost" size="icon" asChild className="size-10 flex-none rounded-full text-foreground">
          <a href={src} download={fileName} title="Download .mp3" aria-label="Download .mp3">
            <Download aria-hidden />
          </a>
        </Button>
      </div>
    </AudioPlayer>
  );
}
