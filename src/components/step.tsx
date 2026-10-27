"use client";

import { Check, ChevronDown, ChevronRight, Clock, Minus, X } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { InlineCitationCard, InlineCitationCardBody } from "@/components/ai-elements/inline-citation";
import { isQloo, ReceiptCardBody, ReceiptChip, SideMark, SourceTag } from "@/components/brand/receipt";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { AGENT_NAME_START } from "@/lib/agent-persona";
import type { Signal } from "@/lib/signals";

export type StepStatus = "running" | "done" | "nodata" | "failed" | "pending";

const STATUS: Record<StepStatus, { label: string; icon: ReactNode; className: string }> = {
  // Running shows the Ghost at work, never a spinner (the user, 26 Oct).
  running: { label: "Running", icon: <GhostMark size={GHOST_SIZES.tag} state="working" decorative />, className: "border-border text-foreground" },
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

/**
 * "01": a step's number, in Geist Pixel Square (agent work), with the Ghost's mark before it for the finished states:
 * rest (the full logo) when done, the empty crowd grid when it found nothing. These replace the Done and No data pills
 * (the user's call, 25 Oct). While the step runs the working mark takes the number's place; the pill says "Running".
 */
export function StepNumber({ n, status = "pending" }: { n: number; status?: StepStatus }) {
  if (status === "running") return <GhostMark size={GHOST_SIZES.step} state="working" decorative />;
  const marked = status === "done" || status === "nodata";
  return (
    <span className="inline-flex flex-none items-center gap-2">
      {marked && <GhostMark size={GHOST_SIZES.step} muted={status === "nodata"} label={status === "done" ? "Done" : "No data"} />}
      <span className="pixel-square text-base leading-none">{String(n).padStart(2, "0")}</span>
    </span>
  );
}

/**
 * A step's receipt with the sheet's hover card (the user, 27 Oct): id, kind and label, then where it came from on Qloo
 * and its score, as soon as the step has it.
 */
export function SignalChip({ signal }: { signal: Signal }) {
  return (
    <InlineCitationCard openDelay={150}>
      <HoverCardTrigger asChild>
        <ReceiptChip signal={signal} title="" />
      </HoverCardTrigger>
      <InlineCitationCardBody className="w-auto max-w-[260px] px-[11px] py-[9px]">
        <ReceiptCardBody signal={signal} />
      </InlineCitationCardBody>
    </InlineCitationCard>
  );
}

/** The pill shows only the states the mark doesn't: running, failed, waiting. */
export const hasPill = (status: StepStatus) => status !== "done" && status !== "nodata";

export type StepCall = { key: string; who: string; side?: Signal["side"]; summary?: string; receipts: Signal[] };

/**
 * ONE step card for the agent's research (the DS's StepCard on AI Elements' Trace step): number, title, status pill;
 * the summary, the receipts it found, and the source. Repeated calls to one tool fold into one step with a call count,
 * and "Show each of the N calls" opens them, each with its side. `collapsed`: a finished run's steps, once the sheet is
 * there: closed, with the step's receipts (or "Nothing found") under its title, and the header opens the rest (the user,
 * 27 Oct: every step's data stays one click away). `retried`: a failed call this step retried folded into it.
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
  retried = false,
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
  retried?: boolean;
  children?: ReactNode;
}) {
  const grouped = calls.length > 1;
  const unique = [...new Map(receipts.map((s) => [s.id, s])).values()];
  const card = cn("flex flex-col gap-2.5 rounded-lg border bg-card px-4 py-3.5 text-foreground", status === "pending" && "opacity-60");
  const head = (
    <>
      <span className="inline-flex min-w-0 items-center gap-2.5">
        <StepNumber n={n} status={status} />
        <span className="truncate text-sm font-semibold tracking-[-0.01em]">{title}</span>
        {grouped && (
          <span className="inline-flex flex-none items-baseline gap-1 text-xs whitespace-nowrap text-muted-foreground">
            · <span className="pixel-square text-[13px] text-foreground">{calls.length}</span> calls
          </span>
        )}
        {retried && <span className="flex-none text-xs whitespace-nowrap text-muted-foreground">· retried</span>}
      </span>
      {hasPill(status) && <StatusPill status={status} qloo={isQloo(source)} />}
    </>
  );
  const empty = status === "nodata" && unique.length === 0;
  const body = status !== "pending" && (
        <>
          {summary ? <p className="text-sm leading-[1.45]">{summary}</p> : empty && <p className="text-sm text-muted-foreground">Nothing found.</p>}
          {unique.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Signals from this step">
              {unique.map((s) => (
                <li key={s.id}>
                  <SignalChip signal={s} />
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
                          <SignalChip key={s.id} signal={s} />
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
  );
  if (!collapsed) {
    return (
      <div className={card}>
        <div className="flex items-center justify-between gap-2.5">{head}</div>
        {body}
      </div>
    );
  }
  return (
    <Collapsible className={cn(card, "group/step")}>
      <CollapsibleTrigger className="-mx-2 -my-1.5 flex cursor-pointer flex-col gap-2.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring">
        <span className="flex w-full items-center justify-between gap-2.5">
          {head}
          <ChevronDown className="ml-auto size-4 flex-none text-muted-foreground transition-transform group-data-[state=open]/step:rotate-180" aria-hidden />
        </span>
        {/* Closed: what the step found at a glance (its receipts, else its summary). Open: the full step below. */}
        <span className="flex flex-wrap items-center gap-1 group-data-[state=open]/step:hidden">
          {empty ? (
            <span className="text-xs text-muted-foreground">Nothing found</span>
          ) : unique.length ? (
            unique.map((s) => <SignalChip key={s.id} signal={s} />)
          ) : (
            summary && <span className="line-clamp-1 text-xs text-muted-foreground">{summary}</span>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2.5">{body}</CollapsibleContent>
    </Collapsible>
  );
}

/** The Ghost's own words between steps (the DS's AgentNote, compact): its mark (GHOST_SIZES.tag) as the tag, then its name. */
export function AgentNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-1 text-sm leading-normal text-muted-foreground">
      <GhostMark size={GHOST_SIZES.tag} decorative className="mt-[3px]" />
      <span className="min-w-0 whitespace-pre-line">
        <span className="font-semibold text-foreground">{AGENT_NAME_START} · </span>
        {children}
      </span>
    </div>
  );
}

/**
 * The writing status: the Ghost's bar ("The Ghost is writing the song from 12 Qloo signals"), its mark working while it
 * writes and at rest once it's done. Brand graphite with paper ink in both themes (the user, 26 Oct: the agent, not a
 * spinner, and never a white bar in dark mode).
 */
export function StatusLine({ children, done = false }: { children: ReactNode; done?: boolean }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg border border-transparent bg-[oklch(0.2_0.012_250)] px-4 py-3.5 text-sm font-semibold text-[oklch(0.96_0.003_250)] dark:border-border"
    >
      <GhostMark size={GHOST_SIZES.status} state={done ? "rest" : "working"} decorative />
      <span>{children}</span>
    </div>
  );
}
