"use client";

import { Check, Copy, Download, Link2, Loader2, Mic, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VOICES, type Voice } from "@/lib/voice";
import { describeCrowd } from "@/lib/brief";
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
  const [song, setSong] = useState<{ status: "idle" | "singing" | "done" | "error"; url?: string; message?: string }>(audioUrl ? { status: "done", url: audioUrl } : { status: "idle" });
  const [linkCopied, setLinkCopied] = useState(false);
  // The lead vocal: matched to the artist when MusicBrainz knows it; otherwise the user must choose (no default).
  const [voice, setVoice] = useState<Voice | null>(sheet.voice?.voice ?? null);
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
    if (!voice) return;
    setSong({ status: "singing" });
    try {
      const response = await fetch("/api/sing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheet, voice, songId: sheet.id }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; retry?: boolean } | null;
        throw new Error(body?.error ?? `The server returned ${response.status}`);
      }
      setSong({ status: "done", url: URL.createObjectURL(await response.blob()) });
    } catch (e) {
      setSong({ status: "error", message: e instanceof Error ? e.message : "Singing failed" });
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
          {!readOnly && (
          <>
          <Select value={voice ?? undefined} onValueChange={(v) => setVoice(v as Voice)}>
            <SelectTrigger size="sm" className="w-48" aria-label="Voice">
              <SelectValue placeholder="Choose a voice" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VOICES) as Voice[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {VOICES[v].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={sing} disabled={song.status === "singing" || !voice}>
            {song.status === "singing" ? <Loader2 className="animate-spin" aria-hidden /> : <Mic aria-hidden />}
            {song.status === "singing" ? "Singing… (can take a few minutes)" : song.status === "done" ? "Sing again" : "Sing it"}
          </Button>
          </>
          )}
        </div>
        {!readOnly && (
        <p className="text-xs text-muted-foreground">
          {sheet.voice?.voice
            ? voice === sheet.voice.voice
              ? `Voice matched to the artist from ${sheet.voice.source}.`
              : `You changed the voice; the artist's is ${VOICES[sheet.voice.voice].label.toLowerCase()} (${sheet.voice.source}).`
            : `${sheet.voice?.source ?? "The artist's voice is unknown"}, so choose a voice before singing.`}
        </p>
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
            <Button size="sm" variant="outline" onClick={sing} disabled={!voice}>
              Try again
            </Button>
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
