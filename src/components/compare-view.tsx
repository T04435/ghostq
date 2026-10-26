"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ReceiptChip } from "@/components/brand/receipt";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeCrowd } from "@/lib/brief";
import { loadLastRun, type LastRun } from "@/lib/last-run";
import type { PlainSong } from "@/lib/plain-song";
import type { SongSheet } from "@/lib/song-sheet";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { SongTitle } from "@/components/song-title";

/** The lines the compare shows: the chorus first, then the first verse (the DS's order), else the opening sections. */
function compareLines<L>(sections: { name: string; lines: L[] }[]): L[] {
  const chorus = sections.find((s) => /chorus/i.test(s.name));
  const first = sections.find((s) => s !== chorus);
  return [...(chorus?.lines ?? []), ...(first?.lines ?? [])].slice(0, 8);
}

/** A pill with a pixel count: "0 signals" outline for plain AI, "15 signals" lime for GhostQ. */
function SignalCount({ n, lime }: { n: number; lime?: boolean }) {
  return (
    <span className={lime ? "inline-flex items-baseline gap-1 rounded-full bg-signal px-[9px] py-0.5 text-xs text-signal-foreground" : "inline-flex items-baseline gap-1 rounded-full border px-[9px] py-0.5 text-xs text-muted-foreground"}>
      <span className="pixel-circle text-sm">{n}</span>signals
    </span>
  );
}

/** "Same brief, two writers": the same brief by a plain AI model with no crowd data, next to this device's last GhostQ song. */
export function CompareView() {
  const [last, setLast] = useState<LastRun | null>(null);
  const [plain, setPlain] = useState<PlainSong | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reading this device's storage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLast(loadLastRun());
  }, []);

  async function writePlain() {
    if (!last) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/plain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: last.brief, crowd: last.sheet?.crowd }) });
      const body = (await response.json()) as PlainSong & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `The server returned ${response.status}`);
      setPlain(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!last?.sheet) {
    return <EmptyState title="No song to compare yet" body="Write a song first, then come back to see it next to the same brief written with no crowd data." action={{ label: "Write a song", href: "/write" }} />;
  }

  const sheet: SongSheet = last.sheet;
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  return (
    <div className="grid items-start gap-3.5 sm:grid-cols-[1fr_1.2fr]">
      <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">Plain AI{plain ? ` · ${plain.title}` : ""}</span>
          <SignalCount n={0} />
        </div>
        {plain ? (
          <>
            <div className="flex flex-col gap-1.5">
              {compareLines(plain.sections).map((l, i) => (
                <span key={i} className="text-base leading-[1.4] text-muted-foreground">
                  {l.text}
                </span>
              ))}
            </div>
            <span className="text-xs leading-[1.45] text-muted-foreground">The same model and brief with no Qloo data. Nothing to cite.</span>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2.5">
            <p className="text-sm leading-normal text-muted-foreground">Write the same brief with a plain AI model and no crowd data, to see what the crowd changes.</p>
            <Button onClick={writePlain} disabled={busy}>
              {busy && <GhostMark size={GHOST_SIZES.tag} state="working" decorative />}
              {busy ? "Writing the plain AI version…" : "Write the same brief with plain AI"}
            </Button>
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-foreground bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-baseline gap-2 text-[13px] font-semibold">
            GhostQ · <SongTitle size="sm" title={sheet.title} artist={sheet.artist} />
          </span>
          <SignalCount n={sheet.signals.length} lime />
        </div>
        <div className="flex flex-col gap-2">
          {compareLines(sheet.sections).map((l, i) => (
            <div key={i} className="flex flex-wrap items-baseline justify-between gap-2.5">
              <span className="text-base leading-[1.4] font-medium">{l.text}</span>
              <span className="flex gap-1">
                {l.signalIds.map((id) => {
                  const s = byId.get(id);
                  return s ? <ReceiptChip key={id} signal={s} /> : null;
                })}
              </span>
            </div>
          ))}
        </div>
        <span className="text-xs leading-[1.45] text-muted-foreground">
          For {describeCrowd(sheet.crowd)}, in {sheet.language}. Every line can say why.
        </span>
      </div>
    </div>
  );
}
