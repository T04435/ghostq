"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import type { SpotifyArtist } from "@/lib/spotify-artist";

type Value = { artist: string; spotifyId?: string };

/**
 * An artist field: type a name, press Enter (or the button) to find it on Spotify, pick a result. Search runs only on
 * Enter, to save calls. Used for the artist and for CollabQ's "feat." artist.
 */
export function ArtistSearch({ id, value, placeholder, hint, onChange }: { id: string; value: Value; placeholder: string; hint: string; onChange: (value: Value) => void }) {
  // null = no results shown.
  const [matches, setMatches] = useState<{ query: string; status: "searching" | "done" | "error"; artists: SpotifyArtist[]; message?: string } | null>(null);

  async function search() {
    const query = value.artist.trim();
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

  return (
    <>
      <div className="relative">
        <Input
          id={id}
          placeholder={placeholder}
          value={value.artist}
          maxLength={80}
          aria-describedby={`${id}-hint`}
          className="pr-9"
          onChange={(e) => onChange({ artist: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" aria-label="Search Spotify" onClick={() => void search()}>
          <Search aria-hidden />
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {matches && (
        <div className="grid gap-1 rounded-md border p-2" role="region" aria-label="Spotify results">
          {matches.status === "searching" && (
            <p className="flex items-center gap-2 p-1 text-sm text-muted-foreground">
              <Spinner /> Searching Spotify…
            </p>
          )}
          {matches.status === "error" && <p className="p-1 text-sm text-destructive">{matches.message}</p>}
          {matches.status === "done" && matches.artists.length === 0 && <p className="p-1 text-sm text-muted-foreground">No artist called &quot;{matches.query}&quot; on Spotify.</p>}
          {matches.artists.map((a) => (
            <Item key={a.id} asChild size="sm" className="cursor-pointer text-left hover:bg-accent focus-visible:bg-accent">
              <button
                type="button"
                onClick={() => {
                  onChange({ artist: a.name, spotifyId: a.id });
                  setMatches(null);
                }}
              >
                <ItemMedia variant="image">
                  {a.image ? (
                    // Spotify's CDN image; next/image would need a remote pattern for one 40 px avatar.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" width={40} height={40} className="size-10 rounded object-cover" />
                  ) : (
                    <span className="size-10 rounded bg-muted" aria-hidden />
                  )}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{a.name}</ItemTitle>
                </ItemContent>
              </button>
            </Item>
          ))}
        </div>
      )}
    </>
  );
}
