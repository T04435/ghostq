"use client";

import { GitFork, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { InlineCitation, InlineCitationCard, InlineCitationCardBody, InlineCitationText } from "@/components/ai-elements/inline-citation";
import { isQloo, KIND_NAME, KIND_ORDER, KindGlyph, ReceiptCardBody, ReceiptChip, SIDE_SHORT, SideMark } from "@/components/brand/receipt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiveChords, LiveWords } from "@/components/sing-along/live-line";
import type { SingAlong } from "@/components/sing-along/use-sing-along";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { Sheet as SidePanel, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { possessive } from "@/lib/possessive";
import type { Signal } from "@/lib/signals";
import { songArtist, type SongSheet as Sheet } from "@/lib/song-sheet";
import { SongTitle } from "@/components/song-title";

/** The required label on every song: plain text with Lucide info. Fixed wording, never truncated on a sheet or card. */
export function DraftLabel({ artist, feat, className }: { artist: string; feat?: string; className?: string }) {
  return (
    <span className={cn("flex items-start gap-1.5 text-xs leading-[1.45] text-muted-foreground", className)}>
      <Info className="mt-0.5 size-3 flex-none" strokeWidth={2.5} aria-hidden />
      <span>{draftLabel(artist, feat)}</span>
    </span>
  );
}

/** Opens the receipts panel on one signal; SongSheetView provides it so the rail's brief can link its ids. */
export const ReceiptLink = createContext<((id: string) => void) | null>(null);

/** CollabQ: whose crowd a signal came from, in words. */
export function sideName(sheet: Sheet, side: NonNullable<Signal["side"]>): string {
  return side === "shared" ? "Shared, from Qloo compare" : `${possessive(side === "A" ? sheet.artist : (sheet.featuring?.artist ?? "B"))} crowd`;
}

/**
 * ONE song sheet (the DS's SongSheet, hand-written ChordPro layout on shadcn Card): the header (title, credit, key and
 * tempo, the draft label, the feel), then chords over lyrics with a receipt chip on every line (no glyph legend: the
 * panel's group headings name each kind). Clicking a chip (or "Receipts") opens the receipts in a side Sheet, one column, the clicked one highlighted
 * and scrolled to (the user's call, 25 Oct); hover still previews a chip. The brief lives in the rail (SongBrief).
 * `compact` drops the feel and actions (RemixCompare); `changed` marks rewritten lines ("s:l" keys) for a diff.
 */
export function SongSheet({
  sheet,
  compact = false,
  changed,
  caption,
  notice,
  sectionAction,
  actions,
  openReceipt,
  sing,
}: {
  sheet: Sheet;
  compact?: boolean;
  changed?: Set<string>;
  caption?: ReactNode;
  /** Anything to show under the header (errors from a rewrite). */
  notice?: ReactNode;
  /** A control beside each section's heading (the write page's Rewrite). */
  sectionAction?: (section: number) => ReactNode;
  /** The action bar at the foot of a full sheet. */
  actions?: ReactNode;
  /** A receipt to open from outside the sheet (a linked id in the brief); `at` makes a repeat click open it again. */
  openReceipt?: { id: string; at: number } | null;
  /** A sung song's sing-along: the line being sung lights up word by word with its chord, and a tapped line jumps there. */
  sing?: SingAlong | null;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hover ?? pinned;
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  const collab = Boolean(sheet.featuring);
  const diff = Boolean(changed);
  const total = sheet.sections.reduce((n, s) => n + s.lines.length, 0);
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: sheet.signals.filter((s) => s.kind === kind).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
  })).filter((g) => g.items.length);
  const count = (side: NonNullable<Signal["side"]>) => sheet.signals.filter((s) => s.side === side).length;
  const [open, setOpen] = useState(false);
  const pin = (id: string) => setPinned((p) => (p === id ? null : id));
  // Each sung line's place on the sing-along timeline, by "section:line".
  const timed = new Map(sing?.timing.lines.map((l, i) => [`${l.section}:${l.line}`, i]));
  const show = (id: string) => {
    setPinned(id);
    setOpen(true);
  };
  // A new request from outside opens the panel on it (state adjusted during render, no effect).
  const [request, setRequest] = useState(openReceipt);
  if (openReceipt !== request) {
    setRequest(openReceipt);
    if (openReceipt) {
      setPinned(openReceipt.id);
      setOpen(true);
    }
  }
  // The clicked receipt into view once the panel has opened.
  useEffect(() => {
    if (!open || !pinned) return;
    const t = setTimeout(() => document.getElementById(`receipt-${pinned}`)?.scrollIntoView({ block: "center" }), 60);
    return () => clearTimeout(t);
  }, [open, pinned]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {caption && <span className="font-mono text-[11px] tracking-[.06em] text-muted-foreground">{caption}</span>}
      <Card className="@container/sheet gap-0 overflow-clip py-0 [--sheet-x:--spacing(6)]">
        <div className="flex flex-col gap-2.5 border-b px-(--sheet-x) pt-[22px] pb-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              {/* Title and artist on one line in Geist Pixel Circle, as on the Library card (the user, 26 Oct). */}
              <SongTitle as="h2" size="lg" title={sheet.title} artist={songArtist(sheet)} />
              <span className="text-[13px] text-muted-foreground">
                {sheet.featuring
                  ? `Verse 1 for ${possessive(sheet.artist)} crowd (${describeCrowd(sheet.crowd)}), verse 2 for ${possessive(sheet.featuring.artist)} (${describeCrowd(sheet.featuring.crowd)}), the chorus for both.`
                  : sheet.remixOf
                    ? `Remixed for ${describeCrowd(sheet.crowd)}.`
                    : `For ${possessive(sheet.artist)} crowd: ${describeCrowd(sheet.crowd)}.`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-muted px-[9px] py-[5px] font-mono text-[11px] whitespace-nowrap">{sheet.key}</span>
              <span className="rounded-full bg-muted px-[9px] py-[5px] font-mono text-[11px] whitespace-nowrap">{sheet.tempo} BPM</span>
              <span className="rounded-full bg-muted px-[9px] py-[5px] font-mono text-[11px] whitespace-nowrap">{sheet.language}</span>
              <Button variant="outline" size="xs" className="rounded-full" onClick={() => setOpen(true)}>
                Receipts <span className="pixel-square">{sheet.signals.length}</span>
              </Button>
            </div>
          </div>
          <DraftLabel artist={sheet.artist} feat={sheet.featuring?.artist} />
          {sheet.remixOf && (
            <Link
              href={`/song/${sheet.remixOf.id}`}
              className="inline-flex items-center gap-1.5 self-start rounded-full border py-1 pr-2.5 pl-2 text-xs font-semibold hover:border-foreground"
            >
              <GitFork className="size-3" strokeWidth={2.5} aria-hidden />
              RemixQ of the original <span className="font-normal text-muted-foreground">· written for {describeCrowd(sheet.remixOf.crowd)}</span>
            </Link>
          )}
          {!compact && <p className="text-[15px] leading-normal text-pretty text-muted-foreground">{sheet.feel}</p>}
          {diff && (
            <span className="inline-flex items-baseline gap-[5px] self-start rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
              <span className="pixel-square text-sm">{changed!.size}</span> of <span className="pixel-square text-sm">{total}</span> lines changed
            </span>
          )}
        </div>

        {sheet.warnings.length > 0 && (
          <Alert variant="warning" role="status" className="mx-(--sheet-x) mt-4 w-auto">
            <TriangleAlert aria-hidden />
            <AlertTitle>The receipt check still found problems after one repair:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {sheet.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {notice && <div className="mx-(--sheet-x) mt-4">{notice}</div>}

        <div className="min-w-0">
          <div className="min-w-0">
            <div className="flex flex-col gap-2 px-(--sheet-x) pt-1 pb-6">
              {sheet.sections.map((section, si) => (
                <section key={`${section.name}-${si}`} className="flex flex-col gap-3 pt-5">
                  <div className="flex flex-col gap-1.5 border-b pb-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="pixel-grid text-xl leading-none tracking-[.02em] whitespace-nowrap uppercase">{section.name}</h3>
                      <span className="font-mono text-[10px] tracking-[.06em] whitespace-nowrap text-muted-foreground">MELODY</span>
                      <span className="min-w-[180px] flex-1 text-xs leading-[1.45] text-pretty text-muted-foreground">{section.melody}</span>
                      {sectionAction?.(si)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3.5">
                    {section.lines.map((line, li) => {
                      const isChanged = changed?.has(`${si}:${li}`) ?? false;
                      const ids = [...new Set(line.signalIds)];
                      const ti = timed.get(`${si}:${li}`);
                      const at = sing && ti !== undefined ? sing.timing.lines[ti] : undefined;
                      const now = Boolean(at && sing!.position.line === ti);
                      return (
                        <div
                          key={li}
                          data-singing={now || undefined}
                          onClick={at ? (e) => !(e.target as HTMLElement).closest("button") && sing!.seek(Math.max(0, at.start - 0.1)) : undefined}
                          title={at ? "Play from this line" : undefined}
                          className={cn("min-w-0 rounded-md px-2.5 py-1.5", diff && "border-l-[3px] border-transparent", isChanged && "border-foreground bg-muted", at && "cursor-pointer hover:bg-muted/60")}
                        >
                          {/* Every line's receipts as AI Elements' Inline Citation: hover or focus a chip for its signal, click to pin it. */}
                          <InlineCitation className="flex flex-wrap items-end gap-x-4 gap-y-1.5">
                            <InlineCitationText className="flex min-w-0 flex-col gap-0.5 group-hover:bg-transparent">
                              {now ? (
                                <>
                                  <LiveChords chords={line.chords} text={line.text} line={at} time={sing!.time} className="min-h-3.5 pr-2 font-mono text-[13px] leading-[1.1] font-semibold" />
                                  <LiveWords text={line.text} line={at} time={sing!.time} className="text-[17px] leading-[1.35] font-medium" />
                                </>
                              ) : (
                                <>
                                  <span className="min-h-3.5 pr-2 font-mono text-[13px] leading-[1.1] font-semibold whitespace-pre-wrap">{line.chords}</span>
                                  <span className="text-[17px] leading-[1.35] font-medium">{line.text}</span>
                                </>
                              )}
                            </InlineCitationText>
                            <span className="flex flex-none flex-wrap items-center gap-1 pb-[3px]">
                              {isChanged && (
                                <span className="rounded-full border border-foreground px-1.5 py-0.5 font-mono text-[9px] tracking-[.06em] whitespace-nowrap">
                                  CHANGED<span className="sr-only"> line</span>
                                </span>
                              )}
                              {ids.map((id) => {
                                const s = byId.get(id);
                                if (!s) return <span key={id} className="font-mono text-[11px] text-muted-foreground">{id}</span>;
                                return (
                                  <InlineCitationCard key={id} openDelay={150}>
                                    <HoverCardTrigger asChild>
                                      <ReceiptChip
                                        as="button"
                                        signal={s}
                                        active={active === id}
                                        aria-label={`Receipt ${id}: ${KIND_NAME[s.kind]} ${s.label}`}
                                        aria-haspopup="dialog"
                                        title=""
                                        onClick={() => show(id)}
                                        onMouseEnter={() => setHover(id)}
                                        onMouseLeave={() => setHover(null)}
                                      />
                                    </HoverCardTrigger>
                                    <InlineCitationCardBody className="w-auto max-w-[260px] px-[11px] py-[9px]">
                                      <ReceiptCardBody signal={s} sideName={s.side ? sideName(sheet, s.side) : undefined} />
                                    </InlineCitationCardBody>
                                  </InlineCitationCard>
                                );
                              })}
                            </span>
                          </InlineCitation>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

        </div>

        {!compact && (
          <>
            {actions && <div className="flex flex-wrap gap-2 border-t px-(--sheet-x) py-3.5">{actions}</div>}
          </>
        )}
      </Card>
      {/* Not modal: no overlay or blur, and the page still scrolls, so the lines using a receipt stay in view beside it.
          Clicks on the page (another tag) keep it open; the close button or Escape shuts it. */}
      <SidePanel open={open} onOpenChange={setOpen} modal={false}>
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md" aria-label="Receipts" onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => e.preventDefault()}>
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="text-[15px]">Receipts</SheetTitle>
              <SheetDescription className="text-xs">
                {collab ? `${sheet.signals.length} signals · ${count("A")} A · ${count("B")} B · ${count("shared")} shared` : `${sheet.signals.length} signals · from Qloo unless marked`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3.5 px-4 py-4">
            {collab && (
              <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11px] text-muted-foreground">
                {(["A", "B", "shared"] as const).map((side) => (
                  <span key={side} className="inline-flex items-center gap-1.5">
                    <SideMark side={side} color="var(--foreground)" />
                    <span className="font-mono text-foreground">{SIDE_SHORT[side]}</span>
                    {sideName(sheet, side)}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-[18px]">
              {groups.map((g) => (
                <div key={g.kind} className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2 px-2 pb-1">
                    <KindGlyph kind={g.kind} ink="var(--foreground)" dim={0.16} size={14} />
                    <h4 className="text-xs font-semibold">{KIND_NAME[g.kind]}</h4>
                  </div>
                  <ul>
                    {g.items.map((s) => {
                      const q = isQloo(s.source);
                      const on = active === s.id;
                      return (
                        <li
                          key={s.id}
                          id={`receipt-${s.id}`}
                          aria-current={pinned === s.id || undefined}
                          onClick={() => pin(s.id)}
                          onMouseEnter={() => setHover(s.id)}
                          onMouseLeave={() => setHover(null)}
                          className={cn("grid cursor-pointer grid-cols-[38px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] hover:bg-muted", pinned === s.id && "bg-muted")}
                        >
                          <span
                            className={cn(
                              "justify-self-start rounded-full px-1.5 py-0.5 pixel-circle text-[13px] leading-none transition-colors",
                              on ? (q ? "bg-signal-foreground text-signal" : "bg-foreground text-background") : q ? "bg-signal text-signal-foreground" : "bg-muted text-foreground",
                            )}
                          >
                            {s.id}
                          </span>
                          <span className="flex min-w-0 flex-col gap-[3px]">
                            <span className="leading-[1.3] font-medium">{s.label.trim()}</span>
                            <span className="text-[11px] text-muted-foreground">{s.source}</span>
                          </span>
                          <span className="inline-flex items-center gap-[5px] font-mono text-[10px] whitespace-nowrap">
                            {s.side && (
                              <>
                                <SideMark side={s.side} color="var(--foreground)" />
                                {SIDE_SHORT[s.side]}
                              </>
                            )}
                          </span>
                          <span className="text-right pixel-circle text-[15px] whitespace-nowrap">{s.value ?? ""}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            </div>
          </SheetContent>
      </SidePanel>
    </div>
  );
}

/**
 * The song's brief as a rail card (the user's call, 25 Oct: on the song page between the crowd and the remixes, on the
 * write page under the player): production brief, why it fits, genre, vocal direction, one column.
 */
export function SongBrief({ sheet }: { sheet: Sheet }) {
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  return (
    <Card className="gap-4 p-[18px]" aria-label="The brief">
      {[
        ["Production brief", sheet.productionBrief],
        [sheet.featuring ? "Why it fits both crowds" : "Why it fits this crowd", sheet.angle],
        ["Genre", sheet.genre],
        ["Vocal direction", sheet.vocalDirection],
      ].map(([title, body]) => (
        <section key={title} className="flex flex-col gap-1.5">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="text-sm leading-[1.9] text-pretty text-muted-foreground">
            <LinkedIds text={body} byId={byId} />
          </p>
        </section>
      ))}
    </Card>
  );
}

/**
 * The brief's signal ids ("S1", "T8") as the same receipt chips as the lyrics, without the brackets around them; a click
 * opens the receipt in the panel.
 */
function LinkedIds({ text, byId }: { text: string; byId: Map<string, Signal> }) {
  const open = useContext(ReceiptLink);
  // "(S1, G4)" → "S1 G4": the chips mark the citation, so the brackets and commas go, and so do ids with no receipt.
  // A group with none on this song stays as written.
  const bare = text.replace(/\s*\(((?:[A-Z]\d{1,2})(?:\s*,\s*[A-Z]\d{1,2})*)\)/g, (group: string, ids: string) => {
    const known = ids.split(/\s*,\s*/).filter((id) => byId.has(id));
    return known.length ? ` ${known.join(" ")}` : group;
  });
  return bare.split(/\b([A-Z]\d{1,2})\b/).map((part, i) => {
    const s = i % 2 ? byId.get(part) : undefined;
    if (!s) return part;
    const chip = "mx-px -my-1 align-middle";
    if (!open) return <ReceiptChip key={i} signal={s} className={chip} />;
    return <ReceiptChip key={i} as="button" signal={s} className={chip} aria-label={`Receipt ${s.id}: ${KIND_NAME[s.kind]} ${s.label}`} aria-haspopup="dialog" onClick={() => open(s.id)} />;
  });
}
