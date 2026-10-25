"use client";

import { Check, CircleAlert, Copy, Download, FileMusic, RefreshCw } from "lucide-react";
import { cn } from "cn";
import { useEffect, useState, type ReactNode } from "react";
import { ShareText } from "@/components/share-text";
import { SongPlayer, type SingState } from "@/components/song-player";
import { SongBrief, SongSheet } from "@/components/song-sheet";
import { draftFromSheet, lineFromDraft } from "@/components/vocal-line-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toChordPro } from "@/lib/chords";
import { sheetToMarkdown, type SongSheet as Sheet } from "@/lib/song-sheet";

/**
 * A finished song as the DS lays it out: the sheet, with a side rail (the player, the share text, then `aside`) that
 * is a 380 px column from 1100 px and follows the sheet below that (`asideFirst` puts it above: the song page).
 * `sticky` keeps the rail in view on a desktop. `compare`: RemixQ's result, the original and the remix side by side in
 * place of the sheet, then the player beside the share text and `aside`.
 * readOnly: no singing (a saved song that's already sung); audioUrl: a saved sung version to play; onSheetChange: the write
 * page's hook for a rewritten section (only the browser that wrote the song may rewrite it, and only before it's sung).
 * `share`: the share text inline in the rail, or as a popover in the sheet's actions.
 */
export function SongSheetView({
  sheet,
  readOnly = false,
  audioUrl,
  onSheetChange,
  aside,
  asideFirst = false,
  sticky = false,
  share = "inline",
  brief = "rail",
  compare,
}: {
  sheet: Sheet;
  readOnly?: boolean;
  audioUrl?: string;
  onSheetChange?: (sheet: Sheet) => void;
  aside?: ReactNode;
  asideFirst?: boolean;
  sticky?: boolean;
  share?: "inline" | "popover";
  /** "rail": the brief card under the player and share text; "aside": the caller places SongBrief in `aside` itself. */
  brief?: "rail" | "aside";
  compare?: ReactNode;
}) {
  const [rewriting, setRewriting] = useState<{ section: number | null; error?: string }>({ section: null });
  const [copied, setCopied] = useState(false);
  // Singing: one Lyria call per click (about US$0.08), kept as an object URL for this page view.
  const [song, setSong] = useState<SingState>(audioUrl ? { status: "done", url: audioUrl } : { status: "idle" });
  // The vocals: matched to the artist from MusicBrainz and Qloo; where they don't know, the user must choose (no default).
  const [vocals, setVocals] = useState(() => draftFromSheet(sheet));
  const line = lineFromDraft(vocals);
  useEffect(() => () => {
    if (song.url?.startsWith("blob:")) URL.revokeObjectURL(song.url);
  }, [song.url]);

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
      const body = (await response.json()) as { sheet?: Sheet; error?: string };
      if (!response.ok || !body.sheet) throw new Error(body.error ?? `The server returned ${response.status}`);
      onSheetChange(body.sheet);
      setRewriting({ section: null });
    } catch (e) {
      setRewriting({ section: null, error: e instanceof Error ? e.message : "The rewrite failed." });
    }
  }

  function downloadChordPro() {
    const url = URL.createObjectURL(new Blob([toChordPro({ ...sheet, artist: sheet.artist })], { type: "text/plain" }));
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

  const player = (!readOnly || (song.status === "done" && song.url)) && (
    <SongPlayer sheet={sheet} song={song} draft={vocals} onDraft={setVocals} canSing={Boolean(line)} readOnly={readOnly} onSing={() => void sing()} />
  );
  const shareCard = sheet.id && share === "inline" && <ShareText sheet={sheet} path={`/song/${sheet.id}`} inline />;

  if (compare) {
    return (
      <div className="flex flex-col gap-7">
        {compare}
        <div className="grid items-start gap-5 desk:grid-cols-2">
          {player || <div />}
          <div className="flex min-w-0 flex-col gap-3">
            {shareCard}
            {aside}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-[1200px] items-start gap-5 desk:grid-cols-[minmax(0,1fr)_380px]" aria-label="The song">
      <div className="min-w-0">
        <SongSheet
          sheet={sheet}
          notice={
            rewriting.error && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{rewriting.error}</AlertDescription>
              </Alert>
            )
          }
          sectionAction={
            onSheetChange && sheet.id && song.status !== "done"
              ? (si) => (
                  <Button variant="ghost" size="xs" disabled={rewriting.section !== null} onClick={() => void rewrite(si)}>
                    {rewriting.section === si ? <Spinner /> : <RefreshCw aria-hidden />}
                    {rewriting.section === si ? <span className="shimmer">Rewriting…</span> : "Rewrite"}
                  </Button>
                )
              : undefined
          }
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copied" : "Copy sheet"}
              </Button>
              <Button variant="secondary" size="sm" onClick={download}>
                <Download aria-hidden />
                Download .md
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadChordPro}>
                <FileMusic aria-hidden />
                ChordPro
              </Button>
              {sheet.id && share === "popover" && <ShareText sheet={sheet} path={`/song/${sheet.id}`} />}
            </>
          }
        />
      </div>
      <div className={cn("flex min-w-0 flex-col gap-3.5", sticky && "desk:sticky desk:top-4", asideFirst && "-order-1 desk:order-none")}>
        {player}
        {shareCard}
        {brief === "rail" && <SongBrief sheet={sheet} />}
        {aside}
      </div>
    </section>
  );
}
