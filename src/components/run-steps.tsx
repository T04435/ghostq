"use client";

import { Plan, PlanContent, PlanDescription, PlanFooter, PlanHeader, PlanTitle, PlanTrigger } from "@/components/ai-elements/plan";
import { AgentTag } from "@/components/brand/agent-tag";
import { ReceiptChip } from "@/components/brand/receipt";
import { AGENT_NAME_INLINE } from "@/lib/agent-persona";
import { AgentNote, StatusLine, StatusPill, StepCard, StepNumber, type StepStatus } from "@/components/step";
import { Trace } from "@/components/ui/trace";
import type { RunEvent } from "@/lib/run-events";
import type { Signal } from "@/lib/signals";
import { cn } from "cn";

/** The agent's pick, from its ready_to_write call: the angle and the signals the song is built on. */
type Pick = { angle: string; signalIds: string[] };

export type StepItem =
  | { kind: "note"; key: string; text: string }
  | { kind: "step"; key: string; tool: string; label: string; artist?: string; status: "running" | "ok" | "failed"; summary?: string; signals: Signal[]; pick?: Pick }
  | { kind: "writing"; key: string; signalCount: number; done: boolean };

function pickOf(event: Extract<RunEvent, { type: "step-start" }>): Pick | undefined {
  if (event.tool !== "ready_to_write") return undefined;
  const input = event.input as Partial<Pick> | null;
  return typeof input?.angle === "string" && Array.isArray(input.signalIds) ? { angle: input.angle, signalIds: input.signalIds.map(String) } : undefined;
}

/** Folds one research event into the step list (live, and when replaying a saved song's research). */
export function applyStepEvent(items: StepItem[], event: RunEvent, n: number): StepItem[] {
  switch (event.type) {
    case "note":
      return [...items, { kind: "note", key: `n${n}`, text: event.text }];
    case "step-start":
      return [...items, { kind: "step", key: event.id, tool: event.tool, label: event.label, artist: event.artist, status: "running", signals: [], pick: pickOf(event) }];
    case "step-end":
      return items.map((x) => (x.kind === "step" && x.key === event.id ? { ...x, status: event.ok ? "ok" : "failed", summary: event.summary, signals: event.signals } : x));
    case "writing":
      return [...items, { kind: "writing", key: "writing", signalCount: event.signalCount, done: false }];
    case "sheet":
      return items.map((x) => (x.kind === "writing" ? { ...x, done: true } : x));
    default:
      return items;
  }
}

type Step = Extract<StepItem, { kind: "step" }>;
type Row = Exclude<StepItem, Step> | Step | { kind: "group"; key: string; tool: string; steps: Step[] };

/** A group's title: the plural of its steps' (the agent's own steps keep their label). */
const GROUP_LABELS: Record<string, string> = { find_artist: "Find the artists on Qloo", read_crowd: "Read both crowds" };

/**
 * Calls to the same tool between two of the agent's notes fold into one step (a CollabQ calls each tool once per
 * artist, and the agent often calls one tool twice in parallel), shown where the first call was.
 */
function groupSteps(items: StepItem[]): Row[] {
  const rows: Row[] = [];
  let byTool = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "step") {
      if (item.kind === "note") byTool = new Map();
      rows.push(item);
      continue;
    }
    const at = byTool.get(item.tool);
    const row = at === undefined ? undefined : rows[at];
    if (row?.kind === "group") row.steps.push(item);
    else if (row?.kind === "step") rows[at!] = { kind: "group", key: `g-${row.key}`, tool: item.tool, steps: [row, item] };
    else {
      byTool.set(item.tool, rows.length);
      rows.push(item);
    }
  }
  return rows;
}

const STATUS: Record<Step["status"], StepStatus> = { running: "running", ok: "done", failed: "failed" };

/**
 * A step that came back empty ("Qloo has no data on…", "Wikipedia doesn't describe…") is "No data", not a red failure;
 * only a real error (a timeout, a refusal) is "Failed".
 */
const statusOf = (item: { status: Step["status"]; summary?: string }): StepStatus =>
  item.status === "failed" && /\b(no |none|nothing|doesn['’]t|didn['’]t|isn['’]t|not (yet|known|listed)|came back empty|has no)/i.test(item.summary ?? "") ? "nodata" : STATUS[item.status];

/** Where a step's data came from: Qloo, except GhostQ's own craft pass and Wikipedia's "How they sing". */
const sourceOf = (tool: string) => (tool === "craft_pass" ? "GhostQ" : tool === "vocal_style" ? "Wikipedia" : "Qloo");

/** How many steps a run shows (calls to one tool between two notes count once), for "8 steps · 7 Qloo calls". */
export function stepCount(items: StepItem[]): number {
  return groupSteps(items).filter((r) => r.kind === "step" || r.kind === "group").length;
}

/** The agent's notes from a run, for pages that show them beside the steps (the crowd column). */
export function runNotes(items: StepItem[]): Extract<StepItem, { kind: "note" }>[] {
  return items.filter((x): x is Extract<StepItem, { kind: "note" }> => x.kind === "note");
}

/**
 * The run's research as a list of step cards (shadcn Trace holds the list): the agent's notes between them, calls to
 * one tool folded into one step, the agent's pick as AI Elements' Plan, and the writing status last.
 * `notes={false}` leaves the notes out (the page shows them in the crowd column); `collapsed` shows finished steps as
 * their header only; `grid` lays the steps out as cards in columns (a saved song's research), without notes.
 */
export function RunSteps({ items, notes = true, collapsed = false, grid = false }: { items: StepItem[]; notes?: boolean; collapsed?: boolean; grid?: boolean }) {
  const rows = groupSteps(items);
  // Steps are numbered in order; notes and the writing status aren't steps.
  const numbers = rows.reduce<number[]>((ns, r) => [...ns, (ns.at(-1) ?? 0) + (r.kind === "step" || r.kind === "group" ? 1 : 0)], []);
  return (
    <Trace aria-live="polite" className={cn("gap-3", grid && "grid items-start gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]")}>
      {rows.map((item, i) => {
        const n = numbers[i];
        if (item.kind === "note") return notes && !grid ? <AgentNote key={item.key}>{item.text}</AgentNote> : null;
        if (item.kind === "writing") {
          return (
            <StatusLine key={item.key} done={item.done}>
              {item.done ? `Written from ${item.signalCount} Qloo signals.` : `Writing the song from ${item.signalCount} Qloo signals…`}
            </StatusLine>
          );
        }
        if (item.kind === "group") {
          // Running while any call runs; failed only when every call failed (each call shows its own result inside).
          const status: Step["status"] = item.steps.some((x) => x.status === "running") ? "running" : item.steps.every((x) => x.status === "failed") ? "failed" : "ok";
          return (
            <StepCard
              key={item.key}
              n={n}
              title={GROUP_LABELS[item.tool] ?? item.steps[0].label}
              status={STATUS[status]}
              source={sourceOf(item.tool)}
              calls={item.steps.map((x) => ({ key: x.key, who: x.artist ?? x.label, summary: x.summary, receipts: x.signals, side: x.signals.find((s) => s.side)?.side }))}
              collapsed={collapsed && status !== "running"}
            />
          );
        }
        if (item.pick) return <PickPlan key={item.key} n={n} item={item} pick={item.pick} />;
        return (
          <StepCard
            key={item.key}
            n={n}
            title={item.label}
            status={statusOf(item)}
            summary={item.summary}
            source={sourceOf(item.tool)}
            receipts={item.signals}
            collapsed={collapsed && item.status !== "running"}
          />
        );
      })}
    </Trace>
  );
}

/** The Ghost's pick (its ready_to_write call) as AI Elements' Plan: the angle, and the signals the song rests on. */
function PickPlan({ n, item, pick }: { n: number; item: Step; pick: Pick }) {
  const streaming = item.status === "running";
  const byId = new Map(item.signals.map((s) => [s.id, s]));
  const ids = [...new Set(pick.signalIds)];
  return (
    <Plan defaultOpen isStreaming={streaming} className="gap-3 py-3.5">
      <PlanHeader className="items-center px-4">
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <StepNumber n={n} running={streaming} />
          <PlanTitle className="text-sm font-semibold">{`Plan picked by ${AGENT_NAME_INLINE} · ${ids.length} signal${ids.length === 1 ? "" : "s"}`}</PlanTitle>
        </span>
        <span className="flex items-center gap-1">
          <StatusPill status={streaming ? "running" : item.status === "failed" ? "failed" : "done"} label={streaming ? "Picking" : undefined} />
          <PlanTrigger aria-label="Show or hide the chosen signals" className="size-8 rounded-full" />
        </span>
      </PlanHeader>
      <PlanDescription className="px-4 text-sm leading-[1.45] text-foreground">{streaming ? "Choosing signals for the song…" : pick.angle}</PlanDescription>
      <PlanContent className="px-4">
        <ul className="flex flex-wrap gap-1 border-t pt-2.5" aria-label="Chosen signals">
          {ids.map((id) => {
            const s = byId.get(id);
            return <li key={id}>{s ? <ReceiptChip signal={s} /> : <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 font-mono text-[11px] font-semibold">{id}</span>}</li>;
          })}
        </ul>
      </PlanContent>
      <PlanFooter className="border-t px-4 pt-2 pb-0">
        <AgentTag className="text-xs" />
      </PlanFooter>
    </Plan>
  );
}
