"use client";

import { useEffect, useRef, useState } from "react";
import { BriefForm } from "@/components/brief-form";
import { RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Brief } from "@/lib/brief";
import { loadLastRun, saveLastRun } from "@/lib/last-run";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

export function GhostQApp() {
  const [initial, setInitial] = useState<Brief | undefined>();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<StepItem[]>([]);
  const [sheet, setSheet] = useState<SongSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<RunEvent, { type: "done" }> | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const last = loadLastRun();
    if (last) {
      // Restoring from this device's storage after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitial(last.brief);
      setSheet(last.sheet);
    }
    return () => abort.current?.abort();
  }, []);

  function apply(event: RunEvent, n: number) {
    switch (event.type) {
      case "note":
        setItems((xs) => [...xs, { kind: "note", key: `n${n}`, text: event.text }]);
        break;
      case "step-start":
        setItems((xs) => [...xs, { kind: "step", key: event.id, label: event.label, input: event.input, status: "running", signals: [], raw: null }]);
        break;
      case "step-end":
        setItems((xs) => xs.map((x) => (x.kind === "step" && x.key === event.id ? { ...x, status: event.ok ? "ok" : "failed", summary: event.summary, signals: event.signals, raw: event.raw } : x)));
        break;
      case "writing":
        setItems((xs) => [...xs, { kind: "writing", key: "writing", signalCount: event.signalCount, done: false }]);
        break;
      case "sheet":
        setItems((xs) => xs.map((x) => (x.kind === "writing" ? { ...x, done: true } : x)));
        setSheet(event.sheet);
        break;
      case "error":
        setError(event.message);
        break;
      case "done":
        setDone(event);
        break;
    }
  }

  async function run(brief: Brief) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setItems([]);
    setSheet(null);
    setError(null);
    setDone(null);
    let finalSheet: SongSheet | null = null;
    try {
      const response = await fetch("/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief), signal: controller.signal });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server returned ${response.status}`);
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let n = 0;
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RunEvent;
          if (event.type === "sheet") finalSheet = event.sheet;
          apply(event, n++);
        }
      }
      saveLastRun({ brief, sheet: finalSheet, at: new Date().toISOString() });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  }

  return (
    <div className="grid gap-10">
      <BriefForm key={JSON.stringify(initial ?? null)} initial={initial} busy={busy} onSubmit={run} />

      {(items.length > 0 || busy) && (
        <section className="grid gap-4" aria-label="Live run">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Reading the crowd</h2>
            <div className="flex items-center gap-2">
              <Switch id="raw" checked={showRaw} onCheckedChange={setShowRaw} />
              <Label htmlFor="raw">Show raw data</Label>
            </div>
          </div>
          {items.length === 0 && <p className="text-sm text-muted-foreground">Starting the agent…</p>}
          <RunSteps items={items} showRaw={showRaw} />
          {done && (
            <p className="text-sm text-muted-foreground">
              {done.qlooCalls} Qloo calls{done.qlooCached ? ` (+${done.qlooCached} from cache)` : ""} · {done.seconds} s
            </p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {sheet && <SongSheetView sheet={sheet} />}
    </div>
  );
}
