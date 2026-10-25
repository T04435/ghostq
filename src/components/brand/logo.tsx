import { cn } from "cn";

/**
 * The GhostQ mark, copied from the design system's logo(): a 3×3 crowd of dots. The centre dot is lit (the taste
 * signal Qloo reads from the crowd) and cell (3,3) is a rounded tail at −45°, as wide as a dot and 1.6× as long, also
 * lit: it makes the Q. Gap is about a third of a cell; minimum size 16 px.
 */
export function Logo({ size = 28, ink = "var(--foreground)", lit = "var(--signal)", className }: { size?: number; ink?: string; lit?: string; className?: string }) {
  const gap = Math.max(1.5, Math.round(size * 0.11 * 2) / 2);
  const cell = (size - 2 * gap) / 3;
  return (
    <span aria-hidden className={cn("grid flex-none grid-cols-3", className)} style={{ width: size, height: size, gap }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="relative rounded-full" style={{ background: i === 8 ? "transparent" : i === 4 ? lit : ink }}>
          {i === 8 && (
            <span
              className="absolute top-1/2 left-1/2"
              style={{ width: cell, height: cell * 1.6, borderRadius: cell / 2, background: lit, transform: "translate(-50%,-50%) rotate(-45deg)" }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

/** The lockup: the mark and the wordmark (Hanken Grotesk 600, tracking −4%). Header: 28 px mark, 20 px word, 10 px gap. */
export function Wordmark({ size = 28, fontSize = 20, gap = 10, className }: { size?: number; fontSize?: number; gap?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap }}>
      <Logo size={size} />
      <span className="leading-none font-semibold tracking-[-0.04em]" style={{ fontSize }}>
        GhostQ
      </span>
    </span>
  );
}

/** The same 3×3 grid as a quiet placeholder: eight dots, the tail cell empty (Empty states). */
export function CrowdDots({ size = 40, gap = 4, className }: { size?: number; gap?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("grid grid-cols-3 opacity-30", className)} style={{ width: size, height: size, gap }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={i < 8 ? "rounded-full bg-foreground" : undefined} />
      ))}
    </span>
  );
}
