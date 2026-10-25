"use client";

import { Check, ChevronRight, Clock, LoaderCircle, Minus, X } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { isQloo, ReceiptChip, SideMark, SourceTag } from "@/components/brand/receipt";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Signal } from "@/lib/signals";

export type StepStatus = "running" | "done" | "nodata" | "failed" | "pending";

const STATUS: Record<StepStatus, { label: string; icon: ReactNode; className: string }> = {
  running: { label: "Running", icon: <LoaderCircle className="animate-spin" strokeWidth={2.5} />, className: "border-border text-foreground" },
  done: { label: "Done", icon: <Check strokeWidth={3} />, className: "bg-signal text-signal-foreground" },
  nodata: { label: "No data", icon: <Minus strokeWidth={3} />, className: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", icon: <X strokeWidth={3} />, className: "bg-destructive text-destructive-foreground" },
  pending: { label: "Waiting", icon: <Clock strokeWidth={2.5} />, className: "border-dashed border-border text-muted-foreground" },
};

/**
 * A step's state as icon plus word (shadcn Badge). Done is lime only for Qloo's work: a step from any other source
 * (GhostQ's craft pass, Wikipedia) shows done in graphite outline, since lime means Qloo.
 */
export function StatusPill({ status, label, qloo = true }: { status: StepStatus; label?: string; qloo?: boolean }) {
  const s = STATUS[status];
  return (
    <Badge variant="ghost" className={cn("gap-[5px] px-2 py-[3px] text-[11px] font-semibold hover:bg-[unset] [&>svg]:size-[13px]!", s.className, status === "done" && !qloo && "border-border bg-transparent text-foreground")}>
      {s.icon}
      <span>{label ?? s.label}</span>
    </Badge>
  );
}

/** "01": a step's number, in Geist Pixel Square (agent work). */
export function StepNumber({ n }: { n: number }) {
  return <span className="flex-none pixel-square text-base leading-none">{String(n).padStart(2, "0")}</span>;
}

export type StepCall = { key: string; who: string; side?: Signal["side"]; summary?: string; receipts: Signal[] };

/**
 * ONE step card for the agent's research (the DS's StepCard on AI Elements' Trace step): number, title, status pill;
 * the summary, the receipts it found, and the source. Repeated calls to one tool fold into one step with a call count,
 * and "Show each of the N calls" opens them, each with its side. `collapsed`: the header only (a finished run's steps,
 * once the sheet is there).
 */
export function StepCard({
  n,
  title,
  status,
  summary,
  source,
  receipts = [],
  calls = [],
  collapsed = false,
  children,
}: {
  n: number;
  title: string;
  status: StepStatus;
  summary?: string;
  source: string;
  receipts?: Signal[];
  calls?: StepCall[];
  collapsed?: boolean;
  children?: ReactNode;
}) {
  const grouped = calls.length > 1;
  const unique = [...new Map(receipts.map((s) => [s.id, s])).values()];
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-lg border bg-card px-4 py-3.5 text-foreground", status === "pending" && "opacity-60")}>
      <div className="flex items-center justify-between gap-2.5">
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <StepNumber n={n} />
          <span className="truncate text-sm font-semibold tracking-[-0.01em]">{title}</span>
          {grouped && (
            <span className="inline-flex flex-none items-baseline gap-1 text-xs whitespace-nowrap text-muted-foreground">
              · <span className="pixel-square text-[13px] text-foreground">{calls.length}</span> calls
            </span>
          )}
        </span>
        <StatusPill status={status} qloo={isQloo(source)} />
      </div>
      {status !== "pending" && !collapsed && (
        <>
          {summary && <p className="text-sm leading-[1.45]">{summary}</p>}
          {unique.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Signals from this step">
              {unique.map((s) => (
                <li key={s.id}>
                  <ReceiptChip signal={s} />
                </li>
              ))}
            </ul>
          )}
          {status === "running" && unique.length === 0 && (
            <div className="flex gap-1" aria-hidden>
              <span className="h-6 w-11 rounded-full bg-muted" />
              <span className="h-6 w-11 rounded-full bg-muted" />
            </div>
          )}
          {children}
          {grouped && (
            <Collapsible>
              <CollapsibleTrigger className="group/calls flex cursor-pointer items-center gap-2 self-start rounded-sm py-0.5 text-xs font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring">
                <ChevronRight className="size-3 transition-transform group-aria-expanded/calls:rotate-90" strokeWidth={3} aria-hidden />
                <span className="group-aria-expanded/calls:hidden">Show each of the {calls.length} calls</span>
                <span className="hidden group-aria-expanded/calls:inline">Hide the {calls.length} calls</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2.5 ml-[5px] flex flex-col gap-3 border-l pl-3.5">
                {calls.map((c, i) => (
                  <div key={c.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[10px] text-muted-foreground">CALL {i + 1}</span>
                      {c.side && <SideMark side={c.side} color="var(--foreground)" />}
                      <span className="font-semibold">{c.who}</span>
                    </div>
                    {c.summary && <span className="text-[13px] leading-[1.45]">{c.summary}</span>}
                    {c.receipts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {[...new Map(c.receipts.map((s) => [s.id, s])).values()].map((s) => (
                          <ReceiptChip key={s.id} signal={s} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <SourceTag source={source} />
            {grouped && <span className="text-[11px] text-muted-foreground">one step, {calls.length} calls</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** The agent's own words between steps (the DS's AgentNote on AI Elements Message, compact). */
export function AgentNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-1 text-sm leading-normal text-muted-foreground">
      <span aria-hidden className="mt-0.5 inline-flex size-[18px] flex-none items-center justify-center rounded-full bg-foreground">
        <span className="size-1.5 rounded-full bg-background" />
      </span>
      <span className="min-w-0 whitespace-pre-line">
        <span className="font-semibold text-foreground">Agent · </span>
        {children}
      </span>
    </div>
  );
}

/**
 * The writing status: a graphite bar with a spinner while the agent works ("Writing the song from 12 Qloo signals").
 * `done` swaps the spinner for a check (the DS has no finished state: design gap).
 */
export function StatusLine({ children, done = false }: { children: ReactNode; done?: boolean }) {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-lg bg-foreground px-4 py-3.5 text-sm font-semibold text-background">
      {done ? <Check className="size-4 flex-none" strokeWidth={3} aria-hidden /> : <LoaderCircle className="size-4 flex-none animate-spin" strokeWidth={2.5} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}
