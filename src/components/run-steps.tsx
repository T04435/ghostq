"use client";

import { CircleAlert, CircleCheck, MessageSquareText, PenLine } from "lucide-react";
import { Plan, PlanContent, PlanDescription, PlanHeader, PlanTitle, PlanTrigger } from "@/components/ai-elements/plan";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import type { RunEvent } from "@/lib/run-events";
import type { Signal } from "@/lib/signals";

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

function StepIcon({ status }: { status: Step["status"] }) {
  return <TraceIcon>{status === "running" ? <Spinner /> : status === "failed" ? <CircleAlert /> : <CircleCheck className="text-emerald-600" />}</TraceIcon>;
}

const lineStatus = (status: Step["status"]) => (status === "running" ? "running" : status === "failed" ? "error" : undefined);

/** The run's research as shadcn's Trace: one row per Qloo step (expand it for what came back), the agent's notes between. */
export function RunSteps({ items }: { items: StepItem[] }) {
  return (
    <Trace aria-live="polite">
      {groupSteps(items).map((item) => {
        if (item.kind === "note") {
          return (
            <TraceLine key={item.key}>
              <TraceIcon>
                <MessageSquareText />
              </TraceIcon>
              <span className="min-w-0 whitespace-pre-line">{item.text}</span>
            </TraceLine>
          );
        }
        if (item.kind === "writing") {
          return (
            <TraceLine key={item.key} status={item.done ? undefined : "running"}>
              <TraceIcon>{item.done ? <CircleCheck className="text-emerald-600" /> : <PenLine />}</TraceIcon>
              <TraceTitle>{item.done ? `Written from ${item.signalCount} Qloo signals.` : `Writing the song from ${item.signalCount} Qloo signals…`}</TraceTitle>
            </TraceLine>
          );
        }
        if (item.kind === "group") {
          // Running while any call runs; failed only when every call failed (each call shows its own result inside).
          const status: Step["status"] = item.steps.some((x) => x.status === "running") ? "running" : item.steps.every((x) => x.status === "failed") ? "failed" : "ok";
          return (
            <TraceCollapsible key={item.key}>
              <TraceCollapsibleTrigger>
                <TraceLine status={lineStatus(status)}>
                  <StepIcon status={status} />
                  <TraceTitle>{GROUP_LABELS[item.tool] ?? item.steps[0].label}</TraceTitle>
                  <TraceDescription>Qloo · {item.steps.length} calls</TraceDescription>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent>
                <Trace>{item.steps.map((x) => <StepRow key={x.key} item={x} title={x.artist ?? x.label} />)}</Trace>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          );
        }
        return <StepRow key={item.key} item={item} title={item.label} />;
      })}
    </Trace>
  );
}

/** One Qloo call: expand it for what came back. */
function StepRow({ item, title }: { item: Step; title: string }) {
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={lineStatus(item.status)}>
          <StepIcon status={item.status} />
          <TraceTitle>{title}</TraceTitle>
          <TraceDescription>{item.tool === "craft_pass" ? "GhostQ" : "Qloo"}</TraceDescription>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="grid gap-2 py-2 pl-6">
          {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
          {item.pick && (
            <Plan defaultOpen isStreaming={item.status === "running"}>
              <PlanHeader>
                <div className="grid gap-1">
                  <PlanTitle>The song&apos;s plan</PlanTitle>
                  <PlanDescription>{item.pick.angle}</PlanDescription>
                </div>
                <PlanTrigger aria-label="Show or hide the chosen signals" />
              </PlanHeader>
              <PlanContent>
                <ul className="flex flex-wrap gap-1" aria-label="Chosen signals">
                  {[...new Set(item.pick.signalIds)].map((id) => (
                    <li key={id}>
                      <Badge variant="outline" className="font-mono">
                        {id}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </PlanContent>
            </Plan>
          )}
          {item.signals.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Signals from this step">
              {/* A step can return the same Qloo tag twice (the registry gives it one id): show it once. */}
              {[...new Map(item.signals.map((s) => [s.id, s])).values()].map((s) => (
                <li key={s.id}>
                  <Badge variant="secondary">
                    <span className="font-mono">{s.id}</span> {s.label.trim()}
                    {s.value !== null ? ` · ${s.value}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
