"use client";

import { Check, Copy, Download, Link2, Loader2, Mic, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { draftFromSheet, lineFromDraft, VocalLinePicker } from "@/components/vocal-line-picker";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import type { Signal } from "@/lib/signals";
import { sheetToMarkdown, type SongSheet } from "@/lib/song-sheet";

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

/** readOnly: a shared song page (no singing); audioUrl: a saved sung version to play. */
export function SongSheetView({ sheet, readOnly = false, audioUrl }: { sheet: SongSheet; readOnly?: boolean; audioUrl?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
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
        <p className="text-xs font-medium text-muted-foreground">{draftLabel(sheet.artist)}</p>
        <CardTitle className="text-2xl">{sheet.title}</CardTitle>
        <CardDescription>
          For {sheet.artist}&apos;s crowd: {describeCrowd(sheet.crowd)}. {sheet.key} · {sheet.tempo} BPM · {sheet.language}. {sheet.feel}
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
                {song.status === "singing" ? <Loader2 className="animate-spin" aria-hidden /> : <Mic aria-hidden />}
                {song.status === "singing" ? "Singing… (can take a few minutes)" : song.status === "done" ? "Sing again" : "Sing it"}
              </Button>
            </div>
          </div>
        )}
        {song.status === "done" && song.url && (
          <div className="grid gap-1 pt-2">
            <audio controls src={song.url} className="w-full">
              <track kind="captions" />
            </audio>
            <p className="text-xs text-muted-foreground">
              Sung and produced by Google Lyria from this sheet. AI-generated, with an inaudible SynthID watermark.{" "}
              <a href={song.url} download={`${sheet.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "song"}.mp3`} className="underline">
                Download .mp3
              </a>
            </p>
          </div>
        )}
        {song.status === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 pt-2">
            <p className="text-sm text-destructive">{song.message}</p>
            {song.budget && (
              <Link href="/library" className="text-sm underline">
                Listen to the songs in the Library
              </Link>
            )}
            {song.retry && (
              <Button size="sm" variant="outline" onClick={sing} disabled={!line}>
                Try again
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-8">
        {sheet.warnings.length > 0 && (
          <div role="status" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">The receipt check still found problems after one repair:</p>
              <ul className="list-disc pl-5">
                {sheet.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {sheet.sections.map((section, si) => (
          <section key={`${section.name}-${si}`} className="grid gap-3">
            <div>
              <h3 className="font-semibold">{section.name}</h3>
              <p className="text-sm text-muted-foreground">Melody: {section.melody}</p>
            </div>
            <div className="grid gap-3">
              {section.lines.map((line, li) => (
                <div key={li} className="grid gap-0.5">
                  <p className="font-mono text-xs text-muted-foreground">{line.chords}</p>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-base">{line.text}</p>
                    <span className="flex flex-wrap gap-1">
                      {line.signalIds.map((id) => {
                        const s = byId.get(id);
                        return (
                          <Tooltip key={id}>
                            <TooltipTrigger asChild>
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
                            </TooltipTrigger>
                            {s && (
                              <TooltipContent>
                                {KIND_LABEL[s.kind]}: {s.label}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        );
                      })}
                    </span>
                  </div>
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
