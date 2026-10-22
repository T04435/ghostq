"use client";

import { CircleAlert, PenLine, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BriefForm } from "@/components/brief-form";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AskCard } from "@/components/ask-card";
import { CrowdCard } from "@/components/crowd-card";
import type { Brief, Crowd } from "@/lib/brief";
import { loadLastRun, saveLastRun } from "@/lib/last-run";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** The brief with the run's answers filled in for the artist it asked about (CollabQ asks per artist). */
function withAnswers(brief: Brief, who: "A" | "B" | undefined, answers: NonNullable<Brief["answers"]>): Brief {
  if (who === "B" && brief.feat) return { ...brief, feat: { ...brief.feat, answers: { ...brief.feat.answers, ...answers } } };
  return { ...brief, answers: { ...brief.answers, ...answers } };
}

export function GhostQApp() {
  const [initial, setInitial] = useState<Brief | undefined>();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<StepItem[]>([]);
  const [sheet, setSheet] = useState<SongSheet | null>(null);
  // `budget`: a daily budget or rate limit was hit, so the message points to the Library, whose songs always play.
  const [error, setError] = useState<{ message: string; budget?: boolean } | null>(null);
  const [done, setDone] = useState<Extract<RunEvent, { type: "done" }> | null>(null);
  // CollabQ reads two crowds: A (the artist) and B (the "feat." artist).
  const [crowds, setCrowds] = useState<{ A?: { artist: string; crowd: Crowd }; B?: { artist: string; crowd: Crowd } }>({});
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
    if (event.type === "crowd") setCrowds((c) => ({ ...c, [event.who ?? "A"]: { artist: event.artist, crowd: event.crowd } }));
    if (event.type === "ask" && current.current) setAsk({ brief: current.current, event });
    if (event.type === "sheet") {
      setSheet(event.sheet);
      written.current = [...written.current, `"${event.sheet.title}": ${event.sheet.angle}`].slice(-10);
    }
    if (event.type === "error") setError({ message: event.message, budget: event.budget });
    if (event.type === "done") setDone(event);
  }

  /** A brief from the form: a new artist or story starts a fresh list of songs written for it. */
  function submit(brief: Brief) {
    const prev = current.current;
    if (!prev || prev.artist !== brief.artist || prev.feat?.artist !== brief.feat?.artist || (prev.story ?? "") !== (brief.story ?? "")) written.current = [];
    const featAnswers = prev?.feat && brief.feat && prev.feat.artist === brief.feat.artist ? prev.feat.answers : undefined;
    void run({
      ...brief,
      answers: prev && prev.artist === brief.artist ? prev.answers : undefined,
      ...(brief.feat ? { feat: { ...brief.feat, answers: featAnswers } } : {}),
      avoid: written.current.length ? written.current : undefined,
    });
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
    setCrowds({});
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
    setCrowds({});
    let finalSheet: SongSheet | null = null;
    try {
      const response = await fetch("/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief), signal: controller.signal });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string; budget?: boolean } | null;
        setError({ message: body?.error ?? `The server returned ${response.status}`, budget: body?.budget });
        return;
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
      if (!controller.signal.aborted) setError({ message: e instanceof Error ? e.message : "Something went wrong." });
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
            {current.current.feat ? (
              <>
                {" "}
                feat. <strong>{current.current.feat.artist}</strong>
              </>
            ) : null}
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
          <h2 className="text-lg font-semibold">Reading the crowd</h2>
          {items.length === 0 && <p className="text-sm text-muted-foreground">Finding the artist on Qloo…</p>}
          {crowds.A && <CrowdCard artist={crowds.A.artist} crowd={crowds.A.crowd} />}
          {crowds.B && <CrowdCard artist={crowds.B.artist} crowd={crowds.B.crowd} featured />}
          <RunSteps items={items} />
          {ask && (
            <AskCard
              fields={ask.event.fields}
              message={ask.event.message}
              busy={busy}
              onAnswer={(answers) => void run(withAnswers(ask.brief, ask.event.who, answers))}
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
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            <p>
              {error.message}
              {error.budget && (
                <>
                  {" "}
                  <Link href="/library" className="font-medium underline">
                    Listen to the songs in the Library
                  </Link>
                </>
              )}
            </p>
          </AlertDescription>
        </Alert>
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
          <span className="text-sm text-muted-foreground">Write another keeps {sheet.featuring ? `both crowds` : `${sheet.artist}'s crowd`} and writes a different song.</span>
        </div>
      )}
    </div>
  );
}
