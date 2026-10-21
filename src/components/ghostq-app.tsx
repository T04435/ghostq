"use client";

import { PenLine, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BriefForm } from "@/components/brief-form";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AskCard } from "@/components/ask-card";
import { CrowdCard } from "@/components/crowd-card";
import type { Brief, Crowd } from "@/lib/brief";
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
  const [crowd, setCrowd] = useState<{ artist: string; crowd: Crowd } | null>(null);
  // The run stopped to ask (Qloo had no data); answering sends the same brief again with the answers.
  const [ask, setAsk] = useState<{ brief: Brief; event: Extract<RunEvent, { type: "ask" }> } | null>(null);
  const current = useRef<Brief | null>(null);
  // While a song shows (or a run is going) the form folds into one line; Edit unfolds it.
  const [folded, setFolded] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Songs already written for the current brief, so "Write another" asks for a clearly different one.
  const written = useRef<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const last = loadLastRun();
    if (last) {
      // Restoring from this device's storage after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitial(last.brief);
      setSheet(last.sheet);
      current.current = last.brief;
      if (last.sheet) {
        written.current = [`"${last.sheet.title}": ${last.sheet.angle}`];
        setFolded(true);
      }
    }
    return () => abort.current?.abort();
  }, []);

  function apply(event: RunEvent, n: number) {
    setItems((xs) => applyStepEvent(xs, event, n));
    if (event.type === "crowd") setCrowd({ artist: event.artist, crowd: event.crowd });
    if (event.type === "ask" && current.current) setAsk({ brief: current.current, event });
    if (event.type === "sheet") {
      setSheet(event.sheet);
      written.current = [...written.current, `"${event.sheet.title}": ${event.sheet.angle}`].slice(-10);
    }
    if (event.type === "error") setError(event.message);
    if (event.type === "done") setDone(event);
  }

  /** A brief from the form: a new artist or story starts a fresh list of songs written for it. */
  function submit(brief: Brief) {
    const prev = current.current;
    if (!prev || prev.artist !== brief.artist || (prev.story ?? "") !== (brief.story ?? "")) written.current = [];
    void run({ ...brief, answers: prev && prev.artist === brief.artist ? prev.answers : undefined, avoid: written.current.length ? written.current : undefined });
  }

  function writeAnother() {
    if (!current.current) return;
    void run({ ...current.current, avoid: written.current });
  }

  function newArtist() {
    abort.current?.abort();
    current.current = null;
    written.current = [];
    setInitial({ artist: "", story: "" });
    setFormKey((k) => k + 1);
    setFolded(false);
    setItems([]);
    setSheet(null);
    setError(null);
    setDone(null);
    setCrowd(null);
    setAsk(null);
    setBusy(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function run(brief: Brief) {
    current.current = brief;
    setFolded(true);
    setAsk(null);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setItems([]);
    setSheet(null);
    setError(null);
    setDone(null);
    setCrowd(null);
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
      {folded && current.current ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm">
          <span className="min-w-0">
            Writing for <strong>{current.current.artist}</strong>
            {current.current.story ? <span className="text-muted-foreground"> · about: {current.current.story}</span> : null}
          </span>
          <Button type="button" variant="link" size="sm" className="ml-auto h-auto p-0" onClick={() => setFolded(false)} disabled={busy}>
            <PenLine aria-hidden />
            Edit
          </Button>
        </div>
      ) : (
        <BriefForm key={`${formKey}:${JSON.stringify(current.current ?? initial ?? null)}`} initial={current.current ?? initial} busy={busy} onSubmit={submit} />
      )}

      {(items.length > 0 || busy) && (
        <section className="grid gap-4" aria-label="Live run">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Reading the crowd</h2>
            <div className="flex items-center gap-2">
              <Switch id="raw" checked={showRaw} onCheckedChange={setShowRaw} />
              <Label htmlFor="raw">Show raw data</Label>
            </div>
          </div>
          {items.length === 0 && <p className="text-sm text-muted-foreground">Finding the artist on Qloo…</p>}
          {crowd && <CrowdCard artist={crowd.artist} crowd={crowd.crowd} />}
          <RunSteps items={items} showRaw={showRaw} />
          {ask && (
            <AskCard
              fields={ask.event.fields}
              message={ask.event.message}
              busy={busy}
              onAnswer={(answers) => void run({ ...ask.brief, answers: { ...ask.brief.answers, ...answers } })}
            />
          )}
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

      {sheet && !busy && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={writeAnother}>
            <Sparkles aria-hidden />
            Write another
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={newArtist}>
            <RotateCcw aria-hidden />
            New artist
          </Button>
          <span className="text-sm text-muted-foreground">Write another keeps {sheet.artist}&apos;s crowd and writes a different song.</span>
        </div>
      )}
    </div>
  );
}
