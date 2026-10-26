"use client";

import { ChevronLeft, CircleAlert, GitFork, PenLine, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgentLockup } from "@/components/brand/agent-lockup";
import { AgentStatusLine, agentStatusText, type AgentState } from "@/components/brand/agent-status-line";
import { BriefForm } from "@/components/brief-form";
import { BudgetNotice } from "@/components/budget-notice";
import { applyStepEvent, runNotes, RunSteps, stepCount, type StepItem } from "@/components/run-steps";
import { AgentNote, StatusLine } from "@/components/step";
import { SongSheetView } from "@/components/song-sheet-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AskCard } from "@/components/ask-card";
import { CrowdCard, sharedOf } from "@/components/crowd-card";
import { RemixCompare } from "@/components/remix-compare";
import { RemixForm } from "@/components/remix-form";
import { RemixOfLink } from "@/components/remix-links";
import { SectionCollapsible } from "@/components/section-collapsible";
import { describeAges, describeCrowd, type Brief, type Crowd, type Remix } from "@/lib/brief";
import { possessive } from "@/lib/possessive";
import { clearLastRun, loadLastRun, saveLastRun } from "@/lib/last-run";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";

/** The brief with the run's answers filled in for the artist it asked about (CollabQ asks per artist). */
function withAnswers(brief: Brief, who: "A" | "B" | undefined, answers: NonNullable<Brief["answers"]>): Brief {
  if (who === "B" && brief.feat) return { ...brief, feat: { ...brief.feat, answers: { ...brief.feat.answers, ...answers } } };
  return { ...brief, answers: { ...brief.answers, ...answers } };
}

/** "Los Angeles, 18–24": the remix's new crowd in the heading's words. */
function remixHeading(r: Remix): string {
  return [r.place?.name, r.ages ? describeAges(r.ages) : null].filter(Boolean).join(", ");
}

type Crowds = { A?: { artist: string; crowd: Crowd }; B?: { artist: string; crowd: Crowd } };

/**
 * The write page (/write) and RemixQ (/remix/<id>, with `remixOf`): the brief or the remix form, the live run (the
 * crowd and the agent's notes beside the steps), then the finished song with its side rail.
 * `recent`: the Library strip under the brief, `examples`: songs for the budget notice (server-rendered slots).
 * RemixQ: `start` runs the picks made on the song page on its own; `original`: the original's card, crowd and remixes
 * beside the form.
 */
export function GhostQApp({
  remixOf,
  start,
  recent,
  examples,
  original,
}: {
  remixOf?: SongSheet;
  /** RemixQ picks made on the song page: the run starts on its own. */
  start?: Omit<Remix, "of">;
  recent?: ReactNode;
  examples?: ReactNode;
  original?: ReactNode;
} = {}) {
  const [initial, setInitial] = useState<Brief | undefined>();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<StepItem[]>([]);
  const [sheet, setSheet] = useState<SongSheet | null>(null);
  // `budget`: a daily budget or rate limit was hit, so the notice shows songs from the Library, which always play.
  const [error, setError] = useState<{ message: string; budget?: boolean } | null>(null);
  const [done, setDone] = useState<Extract<RunEvent, { type: "done" }> | null>(null);
  // CollabQ reads two crowds: A (the artist) and B (the "feat." artist).
  const [crowds, setCrowds] = useState<Crowds>({});
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
    // A remix lives on its own page; the write page restores plain runs only (remixes saved before this fix too).
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
    // The last song is remembered until the next one starts: leave now and Write opens empty.
    clearLastRun();
    void run({ ...current.current, avoid: written.current });
  }

  function newArtist() {
    abort.current?.abort();
    if (remixOf) {
      router.push("/write");
      return;
    }
    clearLastRun();
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

  const brief = current.current;
  const budget = error?.budget ? error : null;
  const failed = error && !error.budget ? error : null;
  const finished = Boolean(sheet) && !busy;
  const inRun = items.length > 0 || busy || Boolean(failed);
  const collab = Boolean(brief?.feat);
  const compareSignals = items.flatMap((x) => (x.kind === "step" && x.tool === "compare_crowds" ? x.signals : []));
  const steps = stepCount(items);

  /** The crowd column: ONE crowd card (both crowds for a CollabQ), then the agent's notes. */
  const crowdColumn = (
    <div className="flex min-w-0 flex-col gap-3.5">
      {ask ? (
        <CrowdCard artist={ask.event.artist} loading heading="The crowd · waiting for your answers" />
      ) : crowds.A ? (
        <CrowdCard
          artist={crowds.A.artist}
          crowd={crowds.A.crowd}
          partner={crowds.B}
          shared={crowds.B && compareSignals.length ? sharedOf(crowds.A.crowd, crowds.B.crowd, compareSignals) : undefined}
          heading={remixOf ? "The new crowd" : undefined}
        />
      ) : (
        !failed && <CrowdCard artist={brief?.artist ?? ""} loading heading={remixOf ? "The new crowd" : collab ? "Two crowds" : "The crowd"} />
      )}
      {runNotes(items).map((x) => (
        <AgentNote key={x.key}>{x.text}</AgentNote>
      ))}
    </div>
  );

  // What the Ghost is doing, for the header's status line (third person). A failed run says so once, in the alert.
  const writing = items.find((x): x is Extract<StepItem, { kind: "writing" }> => x.kind === "writing");
  const agent: AgentState | null = failed
    ? null
    : ask
      ? { state: "asking" }
      : finished && done
        ? { state: "done", qlooCalls: done.qlooCalls }
        : writing && !writing.done
          ? { state: "writing", signals: writing.signalCount }
          : busy
            ? { state: "researching", artist: crowds.A?.artist ?? brief?.artist, city: crowds.A?.crowd.place?.name }
            : null;
  const runSection = inRun && (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-5" aria-label="Live run">
      <div className="flex flex-col gap-3 border-t pt-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">
            {failed
              ? "The run stopped"
              : ask
                ? "The run needs you"
                : finished
                  ? remixOf
                    ? "How GhostQ researched this remix"
                    : "How GhostQ researched this song"
                  : remixOf
                    ? "Reading the new crowd"
                    : collab
                      ? "Reading both crowds"
                      : "Reading the crowd"}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {ask
              ? "Qloo has no data for this artist. Answer inline and the run carries on."
              : finished && done
                ? `${steps} steps · ${done.qlooCalls} Qloo calls · ${done.seconds} s`
                : collab && brief?.feat
                  ? `CollabQ · ${brief.artist} feat. ${brief.feat.artist}`
                  : "Each step shows its source as it finishes"}
          </p>
        </div>
        {/* The Ghost: its mark works while the run streams and rests when it's done; the status line sits under its name. */}
        <div className="flex flex-col gap-1.5">
          <AgentLockup live={busy && !ask} />
          {agent && <AgentStatusLine status={agent} mark={false} className="pl-[38px]" />}
        </div>
      </div>
      <div className="grid items-start gap-5 desk:grid-cols-[360px_minmax(0,1fr)]">
        {crowdColumn}
        <div className="flex min-w-0 flex-col gap-2.5">
          {items.length === 0 && busy && <StatusLine>Finding the artist on Qloo…</StatusLine>}
          <RunSteps items={items} notes={false} collapsed={finished} />
          {ask && (
            <AskCard
              fields={ask.event.fields}
              message={ask.event.message}
              artist={ask.event.artist}
              options={ask.event.options}
              languages={ask.event.languages}
              busy={busy}
              onAnswer={(answers) => void run(withAnswers(ask.brief, ask.event.who, answers))}
            />
          )}
          {failed && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>{agentStatusText({ state: "failed", step: steps, reason: failed.message })}</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {brief && (
                    <Button size="sm" onClick={() => (remixOf && brief.remix ? remix(brief.remix) : writeAnother())}>
                      <RotateCcw aria-hidden />
                      Try again
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={newArtist}>
                    New artist
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {done && (
            <p className="px-0.5 py-1 pixel-square text-sm">
              {done.qlooCalls} Qloo calls{done.qlooCached ? ` (+${done.qlooCached} from cache)` : ""} · {done.seconds} s{sheet ? ` · ${sheet.signals.length} signals` : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  if (remixOf) {
    const picked = brief?.remix;
    const stage = budget ? "budget" : finished && sheet?.remixOf ? "result" : inRun || ask ? "running" : "form";
    const [heading, sub] =
      stage === "result" && picked
        ? [`${remixOf.title}, remixed for ${remixHeading(picked)}`, "The original and the remix side by side. Each keeps its own receipts; rewritten lines are marked on both."]
        : stage === "running" && picked
          ? [`Remixing for ${remixHeading(picked)}`, "Live steps, like a write. About a minute."]
          : stage === "budget"
            ? [`Remix ${remixOf.title}`, "Remixes read a new crowd from Qloo, so they wait for the daily budget too."]
            : [`Remix ${remixOf.title}`, "Pick a new city, up to three age bands, or both. GhostQ reads the new crowd and rewrites the verses and bridge. The title, key, tempo, sections and hook stay."];
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-(--page-x) pt-7 pb-18">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="xs" asChild className="-ml-1">
            <Link href={`/song/${remixOf.id}`}>
              <ChevronLeft aria-hidden />
              {remixOf.title}
            </Link>
          </Button>
          <span className="font-mono text-[11px] text-muted-foreground">RemixQ · the same song for another crowd</span>
        </div>
        <div className="flex max-w-[720px] flex-col gap-2">
          <h1 className="text-[clamp(30px,4vw,44px)] leading-[1.02] font-semibold tracking-[-0.04em] text-pretty">{heading}</h1>
          <p className="text-[15px] leading-normal text-pretty text-muted-foreground">{sub}</p>
        </div>

        {stage === "form" && (
          <div className="grid items-start gap-5 desk:grid-cols-2">
            <RemixForm original={remixOf} busy={busy} onSubmit={remix} />
            <div className="flex min-w-0 flex-col gap-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-muted-foreground">THE ORIGINAL</span>
              {original}
            </div>
          </div>
        )}

        {budget && (
          <div className="w-full max-w-[720px]">
            <BudgetNotice kind="qloo" message={budget.message} examples={examples} />
          </div>
        )}

        {stage === "running" && runSection}

        {stage === "result" && sheet && (
          <>
            <SongSheetView
              key={sheet.id}
              sheet={sheet}
              compare={<RemixCompare original={remixOf} remix={sheet} />}
              aside={
                <>
                  {remixOf.id && <RemixOfLink of={{ id: remixOf.id, title: remixOf.title, crowdText: describeCrowd(remixOf.crowd) }} />}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={writeAnother}>
                      <Sparkles aria-hidden />
                      Remix again
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setFolded(false)}>
                      <PenLine aria-hidden />
                      Another crowd
                    </Button>
                  </div>
                  <span className="px-1 text-xs leading-normal text-muted-foreground">Remix again writes another take for the same crowd. Both versions are saved and linked.</span>
                </>
              }
            />
            <section className="flex flex-col gap-3 border-t pt-6">
              <SectionCollapsible title="How GhostQ researched this remix" meta={done ? `${steps} steps · ${done.qlooCalls} Qloo calls · ${done.seconds} s` : `${steps} steps`} bare>
                <div className="pt-3">
                  <RunSteps items={items} grid />
                </div>
              </SectionCollapsible>
            </section>
          </>
        )}

        {stage === "result" && folded === false && (
          <div className="grid items-start gap-5 desk:grid-cols-2">
            <RemixForm original={remixOf} busy={busy} onSubmit={remix} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-14 px-(--page-x) pb-18">
      <section className="mx-auto flex w-full max-w-[680px] flex-col gap-7 pt-9 sm:gap-9 sm:pt-18">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[clamp(32px,5vw,56px)] leading-none font-semibold tracking-[-0.045em] text-pretty">A song written for the crowd that loves an artist.</h1>
          <p className="max-w-[560px] text-base leading-normal text-pretty text-muted-foreground">
            Name an artist. GhostQ reads their crowd from Qloo, finds what that crowd loves, and writes an original draft for them, with receipts for every line. Add a
            “feat.” artist and verse 2 goes to their crowd.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {/* A budget refusal before any step leaves the brief open beside the notice, as the DS draws it. */}
          {folded && brief && !(budget && items.length === 0) ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm">
              <span className="min-w-0">
                Writing for <strong>{brief.artist}</strong>
                {brief.feat ? (
                  <>
                    {" "}
                    feat. <strong>{brief.feat.artist}</strong>
                  </>
                ) : null}
                {brief.story ? <span className="text-muted-foreground"> · about: {brief.story}</span> : null}
              </span>
              <Button type="button" variant="link" size="sm" className="ml-auto" onClick={() => setFolded(false)} disabled={busy}>
                <PenLine aria-hidden />
                Edit
              </Button>
            </div>
          ) : (
            <BriefForm
              key={`${formKey}:${JSON.stringify(brief ?? initial ?? null)}`}
              initial={brief ?? initial}
              busy={busy}
              onSubmit={submit}
              note={budget ? "Writing is paused until the limit resets." : undefined}
            />
          )}
          {/* What's next, once a song is written: right under the brief, not at the foot of the page (the user, 26 Oct). */}
          {sheet && !busy && folded && (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" onClick={writeAnother}>
                  <Sparkles aria-hidden />
                  Write another
                </Button>
                <Button type="button" variant="outline" onClick={newArtist}>
                  <RotateCcw aria-hidden />
                  New artist
                </Button>
                {sheet.id && !sheet.featuring && (
                  <Button variant="outline" asChild>
                    <Link href={`/remix/${sheet.id}`}>
                      <GitFork aria-hidden />
                      Remix for another crowd
                    </Link>
                  </Button>
                )}
              </div>
              <span className="max-w-[560px] px-1 text-xs leading-normal text-pretty text-muted-foreground">
                Write another keeps {sheet.featuring ? "both crowds" : `${possessive(sheet.artist)} crowd`} and writes a different song. Saved to the public Library with its
                research. Anyone with the link can open it.
              </span>
            </div>
          )}
          {budget && <BudgetNotice kind="qloo" message={budget.message} examples={examples} />}
        </div>
      </section>

      {runSection}

      {sheet && (
        <SongSheetView
          key={sheet.id}
          sheet={sheet}
          onSheetChange={rewritten}
          sticky
        />
      )}

      {!inRun && !budget && !sheet && recent && (
        <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-3.5 border-t pt-7" aria-label="Recent from the Library">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Recent from the Library</h2>
            <Link href="/library" className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
              All songs
            </Link>
          </div>
          {recent}
        </section>
      )}
    </div>
  );
}
