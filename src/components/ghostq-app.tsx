"use client";

import { CircleAlert, PenLine, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BriefForm } from "@/components/brief-form";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { SongSheetView } from "@/components/song-sheet-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AskCard } from "@/components/ask-card";
import { CrowdCard } from "@/components/crowd-card";
import { RemixCompare } from "@/components/remix-compare";
import { RemixForm } from "@/components/remix-form";
import { describeAges, type Brief, type Crowd, type Remix } from "@/lib/brief";
import { describePlace } from "@/lib/place";
import { loadLastRun, saveLastRun } from "@/lib/last-run";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** The brief with the run's answers filled in for the artist it asked about (CollabQ asks per artist). */
function withAnswers(brief: Brief, who: "A" | "B" | undefined, answers: NonNullable<Brief["answers"]>): Brief {
  if (who === "B" && brief.feat) return { ...brief, feat: { ...brief.feat, answers: { ...brief.feat.answers, ...answers } } };
  return { ...brief, answers: { ...brief.answers, ...answers } };
}

/** `remixOf`: RemixQ mode, on /remix/<id>: the form asks for the new crowd, and the result shows next to the original. */
/** "18–24 in Mexico City": the remix's new crowd, as picked (what's left out stays Qloo's). */
function describeRemix(r: Remix): string {
  if (!r.ages) return `the crowd in ${describePlace(r.place!)}`;
  return [describeAges(r.ages), r.place ? `in ${describePlace(r.place)}` : null].filter(Boolean).join(" ");
}

export function GhostQApp({ remixOf, start }: { remixOf?: SongSheet; /** RemixQ picks made on the song page: the run starts on its own. */ start?: Omit<Remix, "of"> } = {}) {
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
  const router = useRouter();

  const started = useRef(false);
  useEffect(() => {
    if (!remixOf || !start) return;
    // Once only, each start being a paid run. The timer is cleared when React's development double-mount unmounts the
    // first pass, so only the second pass starts it (an immediate start would be aborted by that unmount).
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      // Drop the picks from the address, so reloading the page doesn't run (and pay for) the remix again.
      window.history.replaceState(null, "", window.location.pathname);
      remix(start);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page: the picks don't change after load.
  }, []);

  useEffect(() => {
    if (remixOf) return () => abort.current?.abort();
    const last = loadLastRun();
    // A remix lives on its own page; the home page restores plain runs only (remixes saved before this fix too).
    if (last && !last.brief.remix) {
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
  }, [remixOf]);

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

  /** RemixQ: the brief is the original's artist plus the new crowd; the server reads the rest from the saved song. */
  function remix(r: Omit<Remix, "of">) {
    if (!remixOf?.id) return;
    written.current = [];
    void run({ artist: remixOf.artist, remix: { of: remixOf.id, ...r } });
  }

  /** A section rewritten on the sheet: shown, and kept as this device's last run (a remix stays on its own page). */
  function rewritten(next: SongSheet) {
    setSheet(next);
    if (current.current && !current.current.remix) saveLastRun({ brief: current.current, sheet: next, at: new Date().toISOString() });
  }

  function writeAnother() {
    if (!current.current) return;
    void run({ ...current.current, avoid: written.current });
  }

  function newArtist() {
    abort.current?.abort();
    if (remixOf) {
      router.push("/");
      return;
    }
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
      if (!brief.remix) saveLastRun({ brief, sheet: finalSheet, at: new Date().toISOString() });
    } catch (e) {
      if (!controller.signal.aborted) setError({ message: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  }

  return (
    <div className="grid gap-10">
      {remixOf && !(folded && current.current) ? (
        <RemixForm original={remixOf} busy={busy} onSubmit={remix} />
      ) : folded && current.current ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm">
          <span className="min-w-0">
            {current.current.remix ? "Remixing" : "Writing for"} <strong>{current.current.remix ? remixOf?.title : current.current.artist}</strong>
            {current.current.remix ? <span className="text-muted-foreground"> · for {describeRemix(current.current.remix)}</span> : null}
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

      {sheet && remixOf && sheet.remixOf && <RemixCompare original={remixOf} remix={sheet} />}

      {sheet && <SongSheetView key={sheet.id} sheet={sheet} onSheetChange={rewritten} />}

      {sheet && !busy && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={writeAnother}>
            <Sparkles aria-hidden />
            {remixOf ? "Remix again" : "Write another"}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={newArtist}>
            <RotateCcw aria-hidden />
            New artist
          </Button>
          {!remixOf && sheet.id && !sheet.featuring && (
            <Button size="lg" variant="outline" asChild>
              <Link href={`/remix/${sheet.id}`}>
                <Shuffle aria-hidden />
                Remix for another crowd
              </Link>
            </Button>
          )}
          {remixOf && (
            <Button type="button" size="lg" variant="outline" onClick={() => setFolded(false)}>
              <PenLine aria-hidden />
              Another crowd
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{remixOf ? "Remix again writes another take for the same crowd." : `Write another keeps ${sheet.featuring ? "both crowds" : `${sheet.artist}'s crowd`} and writes a different song.`}</span>
        </div>
      )}
    </div>
  );
}
