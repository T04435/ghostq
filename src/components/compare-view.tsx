"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeBrief } from "@/lib/brief";
import { loadLastRun, type LastRun } from "@/lib/last-run";
import type { PlainSong } from "@/lib/plain-song";

/** The last GhostQ song next to the same brief written by plain AI with no Qloo data. */
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
    return (
      <p className="text-sm text-muted-foreground">
        Write a song first, then come back to compare it with plain AI. <Link href="/" className="underline">Write a song</Link>
      </p>
    );
  }

  const sheet = last.sheet;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Brief: {describeBrief(last.brief, sheet.crowd)}</p>
      {!plain && (
        <div>
          <Button onClick={writePlain} disabled={busy}>
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {sheet.title} <Badge>GhostQ</Badge>
            </CardTitle>
            <CardDescription>Built on {sheet.signals.length} Qloo signals, cited line by line.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {sheet.sections.map((s, i) => (
              <div key={i}>
                <p className="font-semibold">{s.name}</p>
                {s.lines.map((l, j) => (
                  <p key={j}>
                    {l.text} <span className="font-mono text-xs text-muted-foreground">[{l.signalIds.join(", ")}]</span>
                  </p>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
        {plain && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {plain.title} <Badge variant="secondary">Plain AI</Badge>
              </CardTitle>
              <CardDescription>The same model and brief with no Qloo data. Nothing to cite.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              {plain.sections.map((s, i) => (
                <div key={i}>
                  <p className="font-semibold">{s.name}</p>
                  {s.lines.map((l, j) => (
                    <p key={j}>{l.text}</p>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
