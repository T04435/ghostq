import { cn } from "cn";
import type { ComponentProps } from "react";
import { InlineCitationCard, InlineCitationCardBody } from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { originOf, type Origin, type Signal, type SignalKind } from "@/lib/signals";

/**
 * Receipt glyphs: each signal kind is a letter drawn on the logo's 3×3 grid, so kinds are told apart without colour.
 * Cell 9 (bottom right) is the tail: rotated −45° and stretched, as in the mark. From the design system's glyph():
 * T theme, S style, G genre, R artist (style reference), F movie (film), B book, L audience (lifestyle), C crowd.
 * O home and V voice ("How they sing") aren't in the DS: drawn here on the same grid (design gap).
 */
export const GLYPHS: Record<SignalKind, string> = {
  theme: "111010010",
  style: "011010110",
  genre: "110101111",
  artist: "110111101",
  movie: "111110100",
  book: "110111110",
  audience: "100100111",
  crowd: "111100111",
  home: "010101010",
  voice: "101101010",
};

/** The DS's letter for each kind (the glyph it draws). */
export const KIND_LETTER: Record<SignalKind, string> = { theme: "T", style: "S", genre: "G", artist: "R", movie: "F", book: "B", audience: "L", crowd: "C", home: "O", voice: "V" };

/** The kind in words (the app's names; the DS's for the eight it has). */
export const KIND_NAME: Record<SignalKind, string> = {
  theme: "Theme",
  style: "Style",
  genre: "Genre",
  artist: "Style reference",
  movie: "Film",
  book: "Book",
  audience: "Lifestyle",
  crowd: "Crowd",
  home: "Home (voice)",
  voice: "How they sing",
};

/** The receipts rail's order: the DS's eight, then the app's two extra kinds. */
export const KIND_ORDER: SignalKind[] = ["crowd", "theme", "genre", "style", "artist", "movie", "book", "audience", "home", "voice"];

/**
 * Each origin's colours (the user, 31 Oct): Qloo's data is lime, what NotOnQ filled in is NotOnQ's amber, anything else
 * is muted. Read from the signal's typed origin, never from its source text.
 */
export const ORIGIN_TONE: Record<Origin, { chip: string; active: string; pill: string }> = {
  qloo: { chip: "bg-signal text-signal-foreground hover:bg-signal hover:text-signal-foreground", active: "bg-signal-foreground text-signal hover:bg-signal-foreground hover:text-signal", pill: "bg-signal px-[7px] text-signal-foreground" },
  notonq: { chip: "bg-notonq text-notonq-foreground hover:bg-notonq hover:text-notonq-foreground", active: "bg-notonq-foreground text-notonq hover:bg-notonq-foreground hover:text-notonq", pill: "bg-notonq px-[7px] text-notonq-foreground" },
  other: { chip: "bg-muted text-foreground hover:bg-muted hover:text-foreground", active: "bg-foreground text-background hover:bg-foreground hover:text-background", pill: "text-muted-foreground" },
};

/**
 * Any 3×3 dot glyph on the brand's grid: nine bits in reading order, lit at full ink, unlit at `dim`. Cell 9 is the
 * mark's rounded tail. The receipt kinds and the Landing's feature glyphs are drawn with it.
 */
export function DotGlyph({ bits, ink = "currentColor", dim = 0.2, size = 12, gap = 1.5, tail = true, className }: { bits: string; ink?: string; dim?: number; size?: number; gap?: number; tail?: boolean; className?: string }) {
  const cell = (size - 2 * gap) / 3;
  return (
    <span aria-hidden className={cn("grid flex-none grid-cols-3", className)} style={{ width: size, height: size, gap }}>
      {bits.split("").map((bit, i) => {
        const opacity = bit === "1" ? 1 : dim;
        // The tail, drawn as the logo draws it (logo.tsx): a pill one dot wide and 1.6 long at −45°, not a stretched dot.
        if (tail && i === 8)
          return (
            <span key={i} className="relative">
              <span
                className="absolute top-1/2 left-1/2"
                style={{ width: cell, height: cell * 1.6, borderRadius: cell / 2, background: ink, opacity, transform: "translate(-50%,-50%) rotate(-45deg)" }}
              />
            </span>
          );
        return <span key={i} className="rounded-full" style={{ background: ink, opacity }} />;
      })}
    </span>
  );
}

/** A kind's letter on the grid. `dim` is the opacity of the unlit cells (0.2 on chips, 0.16 in legends). */
export function KindGlyph({ kind, ...rest }: { kind: SignalKind; ink?: string; dim?: number; size?: number; gap?: number; className?: string }) {
  return <DotGlyph bits={GLYPHS[kind]} {...rest} />;
}

/**
 * The Landing features as receipt-style letters (the user, 26 Oct): C (the Crowd glyph) for CollabQ, R and P drawn on
 * the same grid for RemixQ and QPlayer.
 */
export const FEATURE_GLYPHS = { collab: GLYPHS.crowd, remix: "110110101", player: "110110100" } as const;

/**
 * RemixQ's icon everywhere (the user, 27 Oct, in place of lucide's GitFork): the R glyph in the text colour, sized like
 * the icon it replaces, with the logo's gap of about a third of a cell.
 */
export function RemixGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return <DotGlyph bits={FEATURE_GLYPHS.remix} size={size} gap={Math.max(1, Math.round(size * 0.11 * 2) / 2)} dim={0.25} className={className} />;
}

/** CollabQ's icon, drawn the same way: the C glyph (the Ghost's feat. suggestions on Write). */
export function CollabGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return <DotGlyph bits={FEATURE_GLYPHS.collab} size={size} gap={Math.max(1, Math.round(size * 0.11 * 2) / 2)} dim={0.25} className={className} />;
}

/** CollabQ sides as a disc: A is the left half filled, B the right half, Shared the full disc. Solo songs carry none. */
export function SideMark({ side, size = 10, color = "currentColor", className }: { side: NonNullable<Signal["side"]>; size?: number; color?: string; className?: string }) {
  const background = side === "A" ? `linear-gradient(90deg, ${color} 50%, transparent 50%)` : side === "B" ? `linear-gradient(90deg, transparent 50%, ${color} 50%)` : color;
  return <span aria-hidden className={cn("inline-block flex-none rounded-full", className)} style={{ width: size, height: size, border: `1.5px solid ${color}`, background }} />;
}

export const SIDE_SHORT: Record<NonNullable<Signal["side"]>, string> = { A: "A", B: "B", shared: "A+B" };

/** A source as a tag, in its origin's colour: Qloo a lime pill, NotOnQ an amber one, any other source plain mono. */
export function SourceTag({ source, origin, className, children }: { source: string; origin: Origin; className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("rounded-full py-0.5 font-mono text-[10px] tracking-[.04em] whitespace-nowrap uppercase", ORIGIN_TONE[origin].pill, className)}>
      {children ?? source}
    </span>
  );
}

/** "FROM QLOO": the pill on data that came from Qloo. */
export function FromQloo({ children = "FROM QLOO", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[5px] rounded-full bg-signal px-2 py-[3px] font-mono text-[10px] whitespace-nowrap text-signal-foreground", className)}>
      <span className="size-[7px] rounded-full bg-signal-foreground" />
      {children}
    </span>
  );
}

type ChipSignal = Pick<Signal, "id" | "kind" | "label" | "source" | "side" | "origin"> & { value?: Signal["value"] };

/**
 * ONE receipt chip, everywhere a signal is cited (lyric lines, steps, the plan, compare): the kind's glyph and the
 * id, in its origin's colour: lime when it's Qloo's, amber when NotOnQ filled it in, grey otherwise. Active (hovered or pinned) inverts to graphite. A CollabQ
 * signal carries its side mark. Base: shadcn Badge (inside AI Elements' InlineCitation on the sheet).
 * `as="button"` makes it a control (the sheet pins a receipt on click); other props go to the root element.
 * Hover or focus shows the receipt card (shadcn HoverCard, as on the sheet). `title=""` leaves the card to a caller
 * that wraps the chip in its own trigger.
 */
export function ReceiptChip({
  signal,
  active = false,
  showLabel = false,
  as = "span",
  className,
  title,
  ...props
}: { signal: ChipSignal; active?: boolean; showLabel?: boolean; as?: "span" | "button" } & Omit<ComponentProps<"button">, "children">) {
  const tone = ORIGIN_TONE[originOf(signal)];
  const inner = (
    <>
      <KindGlyph kind={signal.kind} />
      <span className="pixel-circle text-[13px] leading-none">{signal.id}</span>
      {showLabel && <span className="font-sans text-[11.5px] font-medium">{signal.label.trim()}</span>}
      {signal.side && <SideMark side={signal.side} />}
    </>
  );
  const chip = (
    <Badge
      asChild
      variant="ghost"
      className={cn(
        "h-6 gap-[5px] rounded-full border-0 pr-[9px] pl-[7px] leading-none transition-colors duration-100 [&>svg]:size-auto!",
        active ? tone.active : tone.chip,
        as === "button" && "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring",
        className,
      )}
    >
      {as === "button" ? (
        <button type="button" data-active={active || undefined} {...props}>
          {inner}
        </button>
      ) : (
        <span data-active={active || undefined} {...(props as unknown as ComponentProps<"span">)}>
          {inner}
        </span>
      )}
    </Badge>
  );
  if (title === "") return chip;
  return (
    <InlineCitationCard openDelay={150}>
      <HoverCardTrigger asChild>{chip}</HoverCardTrigger>
      <InlineCitationCardBody className="w-auto max-w-[260px] px-[11px] py-[9px]">
        <ReceiptCardBody signal={signal} />
      </InlineCitationCardBody>
    </InlineCitationCard>
  );
}

/** The receipt's hover card: id, kind and label; the source and value in mono; the side in words. */
export function ReceiptCardBody({ signal, sideName }: { signal: ChipSignal; sideName?: string }) {
  return (
    <span className="flex flex-col gap-[3px] text-xs leading-[1.35]">
      <span className="font-semibold">
        {signal.id} · {KIND_NAME[signal.kind]} · {signal.label.trim()}
      </span>
      <span className="font-mono text-[10px]">
        {signal.source}
        {signal.value != null ? ` · ${signal.value}` : ""}
      </span>
      {signal.side && sideName && (
        <span className="text-[11px]">
          {SIDE_SHORT[signal.side]} · {sideName}
        </span>
      )}
    </span>
  );
}
