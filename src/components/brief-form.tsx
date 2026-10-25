"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { ArtistSearch } from "@/components/artist-search";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXAMPLE_BRIEFS, type Brief } from "@/lib/brief";

type Props = { initial?: Brief; busy: boolean; onSubmit: (brief: Brief) => void; /** The line beside Write the song. */ note?: string };

const EMPTY: Brief = { artist: "", story: "" };

/**
 * The only inputs before a run: the artist, an optional "feat." artist (CollabQ) and an optional "what it's about".
 * GhostQ reads each crowd from Qloo during the run.
 */
export function BriefForm({ initial, busy, onSubmit, note = "About a minute. The crowd and every step show as they happen." }: Props) {
  const [brief, setBrief] = useState<Brief>({ ...EMPTY, ...initial });
  const [feat, setFeat] = useState<{ artist: string; spotifyId?: string }>({ artist: initial?.feat?.artist ?? "", spotifyId: initial?.feat?.spotifyId });
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const artist = brief.artist.trim();
    const featArtist = feat.artist.trim();
    if (!artist) {
      setError("Give an artist.");
      return;
    }
    // A typed name isn't enough: the Spotify pick pins the artist on Qloo, so the run reads the right crowd.
    if (!brief.spotifyId) {
      setError(`Pick "${artist}" from the Spotify results first: press Enter in the Artist field to search.`);
      return;
    }
    if (featArtist && !feat.spotifyId) {
      setError(`Pick "${featArtist}" from the Spotify results for feat. first, or clear the field.`);
      return;
    }
    if (featArtist && featArtist.toLowerCase() === artist.toLowerCase()) {
      setError("Pick a different artist for the feat., or leave it empty.");
      return;
    }
    setError(null);
    onSubmit({
      artist,
      spotifyId: brief.spotifyId,
      story: brief.story?.trim() || undefined,
      ...(featArtist ? { feat: { artist: featArtist, spotifyId: feat.spotifyId } } : {}),
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Try:</span>
        {EXAMPLE_BRIEFS.map((example) => (
          <Button
            key={example.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setBrief({ ...EMPTY, ...example.brief });
              setFeat({ artist: example.brief.feat?.artist ?? "", spotifyId: example.brief.feat?.spotifyId });
            }}
          >
            {example.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="artist" className="text-[13px] font-semibold">
          Artist
        </Label>
        <ArtistSearch
          id="artist"
          placeholder="e.g. Teenage Joans, then Enter"
          value={{ artist: brief.artist, spotifyId: brief.spotifyId }}
          hint={brief.spotifyId ? "Picked on Spotify. GhostQ reads this artist's crowd from Qloo when you write." : "Press Enter to find the artist on Spotify. GhostQ then reads their crowd from Qloo."}
          onChange={(v) => setBrief((b) => ({ ...b, artist: v.artist, spotifyId: v.spotifyId }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feat" className="gap-[5px] text-[13px] font-semibold">
          feat. <span className="font-normal text-muted-foreground">optional · CollabQ</span>
        </Label>
        <ArtistSearch
          id="feat"
          placeholder="A second artist, then Enter"
          value={feat}
          hint="Verse 1 for the first artist's crowd, verse 2 for this one's, and the chorus on what both crowds share (Qloo's compare)."
          onChange={setFeat}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story" className="flex items-baseline justify-between gap-2.5 text-[13px] font-semibold">
          <span className="inline-flex items-baseline gap-[5px]">
            Story seed <span className="font-normal text-muted-foreground">optional</span>
          </span>
          <span className="font-mono text-[11px] font-normal text-muted-foreground">
            {(brief.story ?? "").length}/280
          </span>
        </Label>
        <Textarea
          id="story"
          placeholder="One line about the story, if you have one"
          value={brief.story ?? ""}
          maxLength={280}
          rows={2}
          onChange={(e) => setBrief((b) => ({ ...b, story: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3.5 pt-1">
        <Button type="submit" disabled={busy}>
          {busy ? "Writing…" : "Write the song"}
        </Button>
        <span className="min-w-[200px] flex-1 text-xs leading-[1.45] text-muted-foreground">{note}</span>
      </div>
    </form>
  );
}
