import { cn } from "cn";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import type { Signal, SignalKind } from "@/lib/signals";

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

/** Only Qloo-sourced things get the signal colour; every other source is plain mono. */
export const isQloo = (source: string | undefined) => /qloo/i.test(source ?? "");

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

/** CollabQ sides as a disc: A is the left half filled, B the right half, Shared the full disc. Solo songs carry none. */
export function SideMark({ side, size = 10, color = "currentColor", className }: { side: NonNullable<Signal["side"]>; size?: number; color?: string; className?: string }) {
  const background = side === "A" ? `linear-gradient(90deg, ${color} 50%, transparent 50%)` : side === "B" ? `linear-gradient(90deg, transparent 50%, ${color} 50%)` : color;
  return <span aria-hidden className={cn("inline-block flex-none rounded-full", className)} style={{ width: size, height: size, border: `1.5px solid ${color}`, background }} />;
}

export const SIDE_SHORT: Record<NonNullable<Signal["side"]>, string> = { A: "A", B: "B", shared: "A+B" };

/** A source as a tag: Qloo is a lime pill, every other source plain mono text. */
export function SourceTag({ source, className, children }: { source: string; className?: string; children?: React.ReactNode }) {
  const q = isQloo(source);
  return (
    <span className={cn("rounded-full font-mono text-[10px] tracking-[.04em] whitespace-nowrap uppercase", q ? "bg-signal px-[7px] py-0.5 text-signal-foreground" : "py-0.5 text-muted-foreground", className)}>
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

type ChipSignal = Pick<Signal, "id" | "kind" | "label" | "source" | "side"> & { value?: Signal["value"] };

/** "T3 · Theme · Saudade · Qloo … 0.83 · B": the chip's tooltip. */
export function receiptTip(s: ChipSignal): string {
  return [s.id, KIND_NAME[s.kind], s.label.trim(), `${s.source}${s.value != null ? ` ${s.value}` : ""}`, s.side ? (s.side === "shared" ? "Shared" : `${s.side}’s crowd`) : null].filter(Boolean).join(" · ");
}

/**
 * ONE receipt chip, everywhere a signal is cited (lyric lines, steps, the plan, compare): the kind's glyph and the
 * id, on lime when it came from Qloo, grey when derived. Active (hovered or pinned) inverts to graphite. A CollabQ
 * signal carries its side mark. Base: shadcn Badge (inside AI Elements' InlineCitation on the sheet).
 * `as="button"` makes it a control (the sheet pins a receipt on click); other props go to the root element.
 */
export function ReceiptChip({
  signal,
  active = false,
  showLabel = false,
  as = "span",
  className,
  ...props
}: { signal: ChipSignal; active?: boolean; showLabel?: boolean; as?: "span" | "button" } & Omit<ComponentProps<"button">, "children">) {
  const q = isQloo(signal.source);
  const inner = (
    <>
      <KindGlyph kind={signal.kind} />
      <span className="pixel-circle text-[13px] leading-none">{signal.id}</span>
      {showLabel && <span className="font-sans text-[11.5px] font-medium">{signal.label.trim()}</span>}
      {signal.side && <SideMark side={signal.side} />}
    </>
  );
  return (
    <Badge
      asChild
      variant="ghost"
      className={cn(
        "h-6 gap-[5px] rounded-full border-0 pr-[9px] pl-[7px] leading-none transition-colors duration-100 [&>svg]:size-auto!",
        active ? (q ? "bg-signal-foreground text-signal hover:bg-signal-foreground hover:text-signal" : "bg-foreground text-background hover:bg-foreground hover:text-background") : q ? "bg-signal text-signal-foreground hover:bg-signal hover:text-signal-foreground" : "bg-muted text-foreground hover:bg-muted hover:text-foreground",
        as === "button" && "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring",
        className,
      )}
    >
      {as === "button" ? (
        <button type="button" title={props.title ?? receiptTip(signal)} data-active={active || undefined} {...props}>
          {inner}
        </button>
      ) : (
        <span title={props.title ?? receiptTip(signal)} data-active={active || undefined} {...(props as unknown as ComponentProps<"span">)}>
          {inner}
        </span>
      )}
    </Badge>
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
