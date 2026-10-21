"use client";

import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXAMPLE_BRIEFS, type Brief } from "@/lib/brief";
import type { SpotifyArtist } from "@/lib/spotify-artist";

type Props = { initial?: Brief; busy: boolean; onSubmit: (brief: Brief) => void };

const EMPTY: Brief = { artist: "", story: "" };

/** The only inputs before a run: the artist and an optional "what it's about". GhostQ reads the crowd from Qloo during the run. */
export function BriefForm({ initial, busy, onSubmit }: Props) {
  const [brief, setBrief] = useState<Brief>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  // Spotify search runs only on Enter (or the search button), to save calls; null = no results shown.
  const [matches, setMatches] = useState<{ query: string; status: "searching" | "done" | "error"; artists: SpotifyArtist[]; message?: string } | null>(null);

  async function searchSpotify() {
    const query = brief.artist.trim();
    if (!query) return;
    setMatches({ query, status: "searching", artists: [] });
    try {
      const response = await fetch(`/api/spotify?q=${encodeURIComponent(query)}`);
      const body = (await response.json()) as SpotifyArtist[] | { error: string };
      if (!response.ok || !Array.isArray(body)) throw new Error("error" in body ? body.error : `Spotify search returned ${response.status}`);
      setMatches({ query, status: "done", artists: body });
    } catch (e) {
      setMatches({ query, status: "error", artists: [], message: e instanceof Error ? e.message : "Spotify search failed" });
    }
  }

  function pick(artist: SpotifyArtist) {
    setBrief((b) => ({ ...b, artist: artist.name, spotifyId: artist.id }));
    setMatches(null);
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!brief.artist.trim()) {
      setError("Give an artist.");
      return;
    }
    setError(null);
    setMatches(null);
    onSubmit({ artist: brief.artist.trim(), spotifyId: brief.spotifyId, story: brief.story?.trim() || undefined });
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
              setMatches(null);
            }}
          >
            {example.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="artist">Artist</Label>
        <div className="relative">
          <Input
            id="artist"
            placeholder="e.g. Teenage Joans, then Enter"
            value={brief.artist}
            maxLength={80}
            aria-describedby="artist-hint"
            className="pr-9"
            onChange={(e) => setBrief((b) => ({ ...b, artist: e.target.value, spotifyId: undefined }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchSpotify();
              }
            }}
          />
          <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" aria-label="Search Spotify" onClick={() => void searchSpotify()}>
            <Search aria-hidden />
          </Button>
        </div>
        <p id="artist-hint" className="text-xs text-muted-foreground">
          {brief.spotifyId ? "Picked on Spotify. GhostQ reads this artist's crowd from Qloo when you write." : "Press Enter to find the artist on Spotify. GhostQ then reads their crowd from Qloo."}
        </p>
        {matches && (
          <div className="grid gap-1 rounded-md border p-2" role="region" aria-label="Spotify results">
            {matches.status === "searching" && (
              <p className="flex items-center gap-2 p-1 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Searching Spotify…
              </p>
            )}
            {matches.status === "error" && <p className="p-1 text-sm text-destructive">{matches.message}</p>}
            {matches.status === "done" && matches.artists.length === 0 && <p className="p-1 text-sm text-muted-foreground">No artist called &quot;{matches.query}&quot; on Spotify.</p>}
            {matches.artists.map((a) => (
              <button key={a.id} type="button" onClick={() => pick(a)} className="flex items-center gap-3 rounded p-1 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                {a.image ? (
                  // Spotify's CDN image; next/image would need a remote pattern for one 40 px avatar.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image} alt="" width={40} height={40} className="size-10 rounded object-cover" />
                ) : (
                  <span className="size-10 rounded bg-muted" aria-hidden />
                )}
                <span className="text-sm font-medium">{a.name}</span>
              </button>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

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
