"use client";

import { CircleAlert, CircleCheck, Loader2, MessageSquareText, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RunEvent } from "@/lib/run-events";
import type { Signal } from "@/lib/signals";

export type StepItem =
  | { kind: "note"; key: string; text: string }
  | { kind: "step"; key: string; label: string; input: unknown; status: "running" | "ok" | "failed"; summary?: string; signals: Signal[]; raw: unknown }
  | { kind: "writing"; key: string; signalCount: number; done: boolean };

/** Folds one research event into the step list (live, and when replaying a saved song's research). */
export function applyStepEvent(items: StepItem[], event: RunEvent, n: number): StepItem[] {
  switch (event.type) {
    case "note":
      return [...items, { kind: "note", key: `n${n}`, text: event.text }];
    case "step-start":
      return [...items, { kind: "step", key: event.id, label: event.label, input: event.input, status: "running", signals: [], raw: null }];
    case "step-end":
      return items.map((x) => (x.kind === "step" && x.key === event.id ? { ...x, status: event.ok ? "ok" : "failed", summary: event.summary, signals: event.signals, raw: event.raw } : x));
    case "writing":
      return [...items, { kind: "writing", key: "writing", signalCount: event.signalCount, done: false }];
    case "sheet":
      return items.map((x) => (x.kind === "writing" ? { ...x, done: true } : x));
    default:
      return items;
  }
}

export function RunSteps({ items, showRaw }: { items: StepItem[]; showRaw: boolean }) {
  return (
    <ol className="grid gap-3" aria-live="polite">
      {items.map((item) => {
        if (item.kind === "note") {
          return (
            <li key={item.key} className="flex gap-3 text-sm text-muted-foreground">
              <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="whitespace-pre-line">{item.text}</p>
            </li>
          );
        }
        if (item.kind === "writing") {
          return (
            <li key={item.key} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              {item.done ? <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden /> : <PenLine className="size-4 shrink-0 animate-pulse" aria-hidden />}
              <span>{item.done ? `Written from ${item.signalCount} Qloo signals.` : `Writing the song from ${item.signalCount} Qloo signals…`}</span>
            </li>
          );
        }
        return (
          <li key={item.key} className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              {item.status === "running" && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
              {item.status === "ok" && <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden />}
              {item.status === "failed" && <CircleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />}
              <span className="font-medium">{item.label}</span>
              <Badge variant="secondary" className="ml-auto">
                Qloo
              </Badge>
            </div>
            {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
            {showRaw && (
              <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify({ input: item.input, output: item.raw }, null, 2)}</pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
