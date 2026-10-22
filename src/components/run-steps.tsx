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
  | { kind: "step"; key: string; label: string; status: "running" | "ok" | "failed"; summary?: string; signals: Signal[]; pick?: Pick }
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
      return [...items, { kind: "step", key: event.id, label: event.label, status: "running", signals: [], pick: pickOf(event) }];
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

/** The run's research as shadcn's Trace: one row per Qloo step (expand it for what came back), the agent's notes between. */
export function RunSteps({ items }: { items: StepItem[] }) {
  return (
    <Trace aria-live="polite">
      {items.map((item) => {
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
        const status = item.status === "running" ? "running" : item.status === "failed" ? "error" : undefined;
        return (
          <TraceCollapsible key={item.key}>
            <TraceCollapsibleTrigger>
              <TraceLine status={status}>
                <TraceIcon>
                  {item.status === "running" ? <Spinner /> : item.status === "failed" ? <CircleAlert /> : <CircleCheck className="text-emerald-600" />}
                </TraceIcon>
                <TraceTitle>{item.label}</TraceTitle>
                <TraceDescription>Qloo</TraceDescription>
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
                        {item.pick.signalIds.map((id) => (
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
                    {item.signals.map((s) => (
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
      })}
    </Trace>
  );
}
