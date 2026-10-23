"use client";

import { Check, CircleAlert, Copy, Download, FileMusic, Link2, Mic, Minus, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InlineCitation, InlineCitationCard, InlineCitationCardBody, InlineCitationSource, InlineCitationText } from "@/components/ai-elements/inline-citation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { capoFor, parseKey, toChordPro, transposeKey, transposeLine } from "@/lib/chords";
import { draftFromSheet, lineFromDraft, VocalLinePicker } from "@/components/vocal-line-picker";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import type { Signal } from "@/lib/signals";
import { sheetToMarkdown, songArtist, type SongSheet } from "@/lib/song-sheet";
import { possessive } from "@/lib/possessive";

// AI Elements' Audio Player, browser-only (its media-chrome elements can't hydrate from server HTML).
const SongAudio = dynamic(() => import("@/components/song-audio"), { ssr: false, loading: () => <Skeleton className="h-10 w-full" /> });

/** CollabQ: whose crowd a signal came from. */
function sideLabel(sheet: SongSheet, side: NonNullable<Signal["side"]>): string {
  return side === "shared" ? "Shared" : side === "A" ? sheet.artist : (sheet.featuring?.artist ?? "B");
}

const KIND_LABEL: Record<Signal["kind"], string> = {
  theme: "Theme",
  style: "Style",
  genre: "Genre",
  artist: "Style reference",
  movie: "Film",
  book: "Book",
  audience: "Lifestyle",
  crowd: "Crowd",
  home: "Home (voice)",
};

/**
 * readOnly: a shared song page (no singing); audioUrl: a saved sung version to play; onSheetChange: the write page's
 * hook for a rewritten section (only the browser that wrote the song may rewrite it, and only before it's sung).
 */
export function SongSheetView({ sheet, readOnly = false, audioUrl, onSheetChange }: { sheet: SongSheet; readOnly?: boolean; audioUrl?: string; onSheetChange?: (sheet: SongSheet) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  // Transpose, in semitones: display and ChordPro only; the saved sheet keeps its key.
  const [steps, setSteps] = useState(0);
  const shownKey = transposeKey(sheet.key, steps);
  // Chords are spelt the way the shown key is (Ab major, not G# major).
  const flats = parseKey(shownKey)?.flats ?? false;
  const capo = capoFor(shownKey);
  const [rewriting, setRewriting] = useState<{ section: number | null; error?: string }>({ section: null });
  const [copied, setCopied] = useState(false);
  // Singing: one Lyria call per click (about US$0.08), kept as an object URL for this page view.
  const [song, setSong] = useState<{ status: "idle" | "singing" | "done" | "error"; url?: string; message?: string; retry?: boolean; budget?: boolean }>(audioUrl ? { status: "done", url: audioUrl } : { status: "idle" });
  const [linkCopied, setLinkCopied] = useState(false);
  // The vocals: matched to the artist from MusicBrainz and Qloo; where they don't know, the user must choose (no default).
  const [vocals, setVocals] = useState(() => draftFromSheet(sheet));
  const line = lineFromDraft(vocals);
  useEffect(() => () => {
    if (song.url?.startsWith("blob:")) URL.revokeObjectURL(song.url);
  }, [song.url]);

  async function copyLink() {
    if (!sheet.id) return;
    await navigator.clipboard.writeText(`${location.origin}/song/${sheet.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function sing() {
    if (!line) return;
    if (!sheet.id) return setSong({ status: "error", message: "This song wasn't saved, so it can't be sung. Write it again.", retry: false });
    setSong({ status: "singing" });
    try {
      // The server sings the saved sheet; only the song's id and the vocals go up.
      const response = await fetch("/api/sing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ songId: sheet.id, vocals: line }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; retry?: boolean; budget?: boolean } | null;
        return setSong({ status: "error", message: body?.error ?? `The server returned ${response.status}`, retry: body?.retry ?? !body?.budget, budget: body?.budget });
      }
      setSong({ status: "done", url: URL.createObjectURL(await response.blob()) });
    } catch (e) {
      setSong({ status: "error", message: e instanceof Error ? e.message : "Singing failed", retry: true });
    }
  }
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));

  async function copy() {
    await navigator.clipboard.writeText(sheetToMarkdown(sheet));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rewrite(section: number) {
    if (!sheet.id || !onSheetChange) return;
    setRewriting({ section });
    try {
      const response = await fetch("/api/rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ songId: sheet.id, section }) });
      const body = (await response.json()) as { sheet?: SongSheet; error?: string };
      if (!response.ok || !body.sheet) throw new Error(body.error ?? `The server returned ${response.status}`);
      onSheetChange(body.sheet);
      setRewriting({ section: null });
    } catch (e) {
      setRewriting({ section: null, error: e instanceof Error ? e.message : "The rewrite failed." });
    }
  }

  function downloadChordPro() {
    const url = URL.createObjectURL(new Blob([toChordPro({ ...sheet, artist: sheet.artist }, steps)], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "song"}.cho`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([sheetToMarkdown(sheet)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "song"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium text-muted-foreground">{draftLabel(sheet.artist, sheet.featuring?.artist)}</p>
        {sheet.featuring && <p className="text-sm font-medium">{songArtist(sheet)}</p>}
        <CardTitle className="text-2xl">{sheet.title}</CardTitle>
        {sheet.remixOf && (
          <p className="text-sm text-muted-foreground">
            RemixQ of{" "}
            <Link href={`/song/${sheet.remixOf.id}`} className="underline">
              the original
            </Link>
            , written for {describeCrowd(sheet.remixOf.crowd)}.
          </p>
        )}
        <CardDescription>
          {sheet.featuring ? `Verse 1 for ${possessive(sheet.artist)} crowd (${describeCrowd(sheet.crowd)}), verse 2 for ${possessive(sheet.featuring.artist)} (${describeCrowd(sheet.featuring.crowd)}), the chorus for both.` : `For ${possessive(sheet.artist)} crowd: ${describeCrowd(sheet.crowd)}.`} {sheet.key} · {sheet.tempo} BPM · {sheet.language}. {sheet.feel}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download aria-hidden />
            Download .md
          </Button>
          <Button variant="outline" size="sm" onClick={downloadChordPro}>
            <FileMusic aria-hidden />
            ChordPro
          </Button>
          {sheet.id && (
            <Button variant="outline" size="sm" onClick={copyLink}>
              {linkCopied ? <Check aria-hidden /> : <Link2 aria-hidden />}
              {linkCopied ? "Link copied" : "Copy share link"}
            </Button>
          )}

        </div>
        {!readOnly && (
          <div className="grid gap-2 pt-2">
            <VocalLinePicker sheet={sheet} draft={vocals} onChange={setVocals} />
            <div>
              <Button size="sm" onClick={sing} disabled={song.status === "singing" || !line}>
                {song.status === "singing" ? <Spinner /> : <Mic aria-hidden />}
                {song.status === "singing" ? <span className="shimmer">Singing… (can take a few minutes)</span> : song.status === "done" ? "Sing again" : "Sing it"}
              </Button>
            </div>
          </div>
        )}
        {song.status === "done" && song.url && (
          <div className="grid gap-1 pt-2">
            <SongAudio src={song.url} />
            <p className="text-xs text-muted-foreground">
              Sung and produced by Google Lyria from this sheet. AI-generated, with an inaudible SynthID watermark.{" "}
              <a href={song.url} download={`${sheet.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "song"}.mp3`} className="underline">
                Download .mp3
              </a>
            </p>
          </div>
        )}
        {song.status === "error" && (
          <Alert variant="destructive" className="mt-2">
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{song.message}</span>
              {song.budget && (
                <Link href="/library" className="font-medium underline">
                  Listen to the songs in the Library
                </Link>
              )}
              {song.retry && (
                <Button size="sm" variant="outline" onClick={sing} disabled={!line}>
                  Try again
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent className="grid gap-8">
        {sheet.warnings.length > 0 && (
          <Alert role="status">
            <TriangleAlert aria-hidden />
            <AlertTitle>The receipt check still found problems after one repair:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {sheet.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <ButtonGroup aria-label="Transpose">
            <Button variant="outline" size="icon-sm" aria-label="Down a semitone" onClick={() => setSteps((n) => n - 1)}>
              <Minus aria-hidden />
            </Button>
            <ButtonGroupText className="font-mono text-xs">
              {shownKey}
              {steps ? ` (${steps > 0 ? "+" : ""}${steps})` : ""}
            </ButtonGroupText>
            <Button variant="outline" size="icon-sm" aria-label="Up a semitone" onClick={() => setSteps((n) => n + 1)}>
              <Plus aria-hidden />
            </Button>
          </ButtonGroup>
          {steps !== 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSteps(0)}>
              Back to {sheet.key}
            </Button>
          )}
          {capo && (
            <span className="text-xs text-muted-foreground">
              On guitar: capo {capo.fret}, play {capo.shapes} shapes.
            </span>
          )}
        </div>
        {rewriting.error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{rewriting.error}</AlertDescription>
          </Alert>
        )}

        {sheet.sections.map((section, si) => (
          <section key={`${section.name}-${si}`} className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{section.name}</h3>
                <p className="text-sm text-muted-foreground">Melody: {section.melody}</p>
              </div>
              {onSheetChange && sheet.id && song.status !== "done" && (
                <Button variant="ghost" size="sm" disabled={rewriting.section !== null} onClick={() => void rewrite(si)}>
                  {rewriting.section === si ? <Spinner /> : <RefreshCw aria-hidden />}
                  {rewriting.section === si ? <span className="shimmer">Rewriting…</span> : "Rewrite"}
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              {section.lines.map((line, li) => (
                <div key={li} className="grid gap-0.5">
                  <p className="font-mono text-xs text-muted-foreground">{transposeLine(line.chords, steps, flats)}</p>
                  {/* Every line's receipts as AI Elements' Inline Citation: hover or focus a badge for its Qloo signal. */}
                  <InlineCitation className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <InlineCitationText className="text-base">{line.text}</InlineCitationText>
                    <span className="flex flex-wrap gap-1">
                      {[...new Set(line.signalIds)].map((id) => {
                        const s = byId.get(id);
                        return (
                          <InlineCitationCard key={id}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setSelected(selected === id ? null : id)}
                                className="rounded focus-visible:outline-2 focus-visible:outline-ring"
                                aria-label={s ? `Receipt ${id}: ${KIND_LABEL[s.kind]} ${s.label}` : `Receipt ${id}`}
                              >
                                <Badge variant={selected === id ? "default" : "outline"} className="font-mono">
                                  {id}
                                </Badge>
                              </button>
                            </HoverCardTrigger>
                            {s && (
                              <InlineCitationCardBody className="w-72 p-3">
                                <InlineCitationSource
                                  title={`${KIND_LABEL[s.kind]}: ${s.label.trim()}`}
                                  description={`${s.source}${s.value !== null ? ` · ${s.value}` : ""}`}
                                />
                              </InlineCitationCardBody>
                            )}
                          </InlineCitationCard>
                        );
                      })}
                    </span>
                  </InlineCitation>
                </div>
              ))}
            </div>
          </section>
        ))}

        <Separator />
        <section className="grid gap-2">
          <h3 className="font-semibold">Genre</h3>
          <p className="text-sm">{sheet.genre}</p>
        </section>
        <section className="grid gap-2">
          <h3 className="font-semibold">Vocal direction</h3>
          <p className="text-sm">{sheet.vocalDirection}</p>
        </section>
        <section className="grid gap-2">
          <h3 className="font-semibold">Production brief</h3>
          <p className="text-sm">{sheet.productionBrief}</p>
        </section>
        <section className="grid gap-2">
          <h3 className="font-semibold">Why it fits this crowd</h3>
          <p className="text-sm">{sheet.angle}</p>
        </section>

        <section className="grid gap-2">
          <h3 className="font-semibold">Receipts: the Qloo signals behind the song</h3>
          <ul className="grid gap-1 text-sm">
            {sheet.signals.map((s) => (
              <li key={s.id} className={`flex flex-wrap gap-x-2 rounded px-2 py-1 ${selected === s.id ? "bg-accent" : ""}`}>
                <span className="font-mono font-medium">{s.id}</span>
                <span>
                  {KIND_LABEL[s.kind]}: <strong>{s.label}</strong>
                </span>
                {s.side && <Badge variant={s.side === "shared" ? "default" : "secondary"}>{sideLabel(sheet, s.side)}</Badge>}
                <span className="text-muted-foreground">
                  {s.source}
                  {s.value !== null ? ` · ${s.value}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
