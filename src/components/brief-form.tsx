"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { ArtistSearch } from "@/components/artist-search";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXAMPLE_BRIEFS, type Brief } from "@/lib/brief";

type Props = { initial?: Brief; busy: boolean; onSubmit: (brief: Brief) => void };

const EMPTY: Brief = { artist: "", story: "" };

/**
 * The only inputs before a run: the artist, an optional "feat." artist (CollabQ) and an optional "what it's about".
 * GhostQ reads each crowd from Qloo during the run.
 */
export function BriefForm({ initial, busy, onSubmit }: Props) {
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
    <form onSubmit={submit} className="grid gap-5">
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

      <div className="grid gap-2">
        <Label htmlFor="artist">Artist</Label>
        <ArtistSearch
          id="artist"
          placeholder="e.g. Teenage Joans, then Enter"
          value={{ artist: brief.artist, spotifyId: brief.spotifyId }}
          hint={brief.spotifyId ? "Picked on Spotify. GhostQ reads this artist's crowd from Qloo when you write." : "Press Enter to find the artist on Spotify. GhostQ then reads their crowd from Qloo."}
          onChange={(v) => setBrief((b) => ({ ...b, artist: v.artist, spotifyId: v.spotifyId }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feat">feat. (optional, CollabQ)</Label>
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

      <div className="grid gap-2">
        <Label htmlFor="story">What&apos;s it about? (optional)</Label>
        <Textarea id="story" placeholder="e.g. a last tram home after a house party" value={brief.story ?? ""} maxLength={280} rows={2} onChange={(e) => setBrief((b) => ({ ...b, story: e.target.value }))} />
      </div>

      <div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Writing…" : "Write the song"}
        </Button>
      </div>
    </form>
  );
}
