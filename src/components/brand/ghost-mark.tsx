import { cn } from "cn";
import type { CSSProperties } from "react";
import { CrowdDots, Logo, markGeometry } from "@/components/brand/logo";
import { AGENT_NAME_START } from "@/lib/agent-persona";

/**
 * Every product size of the Ghost's mark, in px, in one place. Callers use these, never literal sizes.
 */
export const GHOST_SIZES = {
  /** The tag before the Ghost's notes, the footer line. */
  tag: 14,
  /** The status line and the running step marker. */
  status: 20,
  step: 20,
  /** The run header lockup. */
  lockup: 28,
  /** Meet the Ghost (How it works). */
  card: 72,
} as const;

export type GhostMarkProps = {
  /** working: seven graphite dots and the lime tail light in turn, the centre lime. rest (default): the full logo, still. */
  state?: "working" | "rest";
  /** Width and height in px: one of GHOST_SIZES in the product. */
  size?: number;
  /** The Ghost didn't run: the empty crowd grid instead of the mark. */
  muted?: boolean;
  /** Hide it from assistive tech when adjacent text names the state. */
  decorative?: boolean;
  /** Spoken name when not decorative. Default "The Ghost" / "The Ghost, working" / "The Ghost didn't run". */
  label?: string;
  className?: string;
};

/**
 * The Ghost's mark: the DS logo's 3×3 crowd grid (geometry from logo.tsx), always with the Q's tail (the user, 30 Oct):
 * - rest: the full logo, the lime centre and the lime tail (the Q), still. Done, or replayed.
 * - working: the seven graphite dots (currentColor) and the lime tail light in turn in reading order on a 1.4 s loop
 *   (keyframes `ghost-dot` in ghostq-theme.css); the centre stays lime. Reduced motion holds the full logo, every part on.
 * - muted: the empty crowd grid (CrowdDots), when the Ghost didn't run.
 * CSS only, so it renders on the server (the footer, How it works).
 */
export function GhostMark({ state = "rest", size = GHOST_SIZES.status, muted = false, decorative = false, label, className }: GhostMarkProps) {
  const working = state === "working" && !muted;
  const spoken = decorative ? undefined : (label ?? (muted ? `${AGENT_NAME_START} didn't run` : working ? `${AGENT_NAME_START}, working` : AGENT_NAME_START));
  const { gap, cell } = markGeometry(size);
  return (
    <span
      data-slot="ghost-mark"
      data-state={muted ? "muted" : state}
      role={decorative ? undefined : "img"}
      aria-label={spoken}
      aria-hidden={decorative ? true : undefined}
      className={cn("inline-flex flex-none align-middle leading-none text-foreground", className)}
      style={{ width: size, height: size }}
    >
      {muted ? (
        <CrowdDots size={size} gap={gap} />
      ) : working ? (
        <span aria-hidden className="grid size-full grid-cols-3" style={{ gap }}>
          {Array.from({ length: 9 }, (_, i) =>
            i === 4 ? (
              <span key={i} className="rounded-full bg-signal" />
            ) : i === 8 ? (
              // The tail as in logo.tsx, taking the last turn.
              <span key={i} className="relative">
                <span
                  className="ghost-dot absolute top-1/2 left-1/2 bg-signal"
                  style={{ width: cell, height: cell * 1.6, borderRadius: cell / 2, transform: "translate(-50%,-50%) rotate(-45deg)", "--ghost-i": 7 } as CSSProperties}
                />
              </span>
            ) : (
              // Reading order of the eight outer dots: 0..7 (the centre is skipped).
              <span key={i} className="ghost-dot rounded-full bg-current" style={{ "--ghost-i": i < 4 ? i : i - 1 } as CSSProperties} />
            ),
          )}
        </span>
      ) : (
        <Logo size={size} ink="currentColor" />
      )}
    </span>
  );
}
