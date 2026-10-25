"use client";

import { Search, SearchX } from "lucide-react";
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

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // Picked: the DS's picked state, a pill with the artist and Change (which clears the pick, keeping the name).
  if (value.spotifyId && !matches) {
    return (
      <>
        <div className="flex h-[52px] items-center gap-3 rounded-full border border-foreground bg-card pr-2 pl-2.5" role="group" aria-label={`Picked: ${value.artist}`}>
          <span aria-hidden className="inline-flex size-[34px] flex-none items-center justify-center rounded-full bg-muted text-xs font-bold">
            {initials(value.artist)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] leading-[1.2] font-semibold">{value.artist}</span>
            <span className="text-[11px] text-muted-foreground">Picked on Spotify</span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-[34px] px-3" onClick={() => onChange({ artist: value.artist })}>
            Change
          </Button>
        </div>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          placeholder={placeholder}
          value={value.artist}
          maxLength={80}
          aria-describedby={`${id}-hint`}
          className="h-[52px] pr-20 pl-11"
          onChange={(e) => onChange({ artist: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="absolute top-1/2 right-3.5 h-6 -translate-y-1/2 rounded-sm border px-[7px] font-mono text-[10px] font-normal"
          aria-label="Search Spotify"
          onClick={() => void search()}
        >
          Enter
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {matches && matches.status === "done" && matches.artists.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[13px] leading-[1.45] text-muted-foreground" role="region" aria-label="Spotify results">
          <SearchX className="mt-px size-4 flex-none" aria-hidden />
          <span>
            <strong className="text-foreground">No artist called &quot;{matches.query}&quot; on Spotify.</strong> Check the spelling, or try the name as it appears on their Spotify page.
          </span>
        </div>
      ) : matches ? (
        <div className="flex flex-col overflow-hidden rounded-xl border bg-popover shadow-[0_12px_32px_rgba(0,0,0,.1)]" role="region" aria-label="Spotify results">
          {matches.status === "searching" && (
            <p className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Spinner /> Searching Spotify…
            </p>
          )}
          {matches.status === "error" && <p className="px-3.5 py-2.5 text-sm text-destructive">{matches.message}</p>}
          {matches.artists.map((a) => (
            <Item key={a.id} asChild size="sm" className="cursor-pointer rounded-none border-0 border-b px-3.5 py-2.5 text-left hover:bg-muted focus-visible:bg-muted">
              <button
                type="button"
                onClick={() => {
                  onChange({ artist: a.name, spotifyId: a.id });
                  setMatches(null);
                }}
              >
                <ItemMedia variant="image" className="size-[34px] rounded-full group-data-[size=sm]/item:size-[34px]">
                  {a.image ? (
                    // Spotify's CDN image; next/image would need a remote pattern for one 34 px avatar.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" width={34} height={34} className="size-[34px] rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex size-[34px] items-center justify-center rounded-full bg-muted text-xs font-bold" aria-hidden>
                      {initials(a.name)}
                    </span>
                  )}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-sm font-semibold">{a.name}</ItemTitle>
                  {a.followers !== null && (
                    <span className="flex items-baseline gap-1 text-[11px] text-muted-foreground">
                      <span className="pixel-circle text-[13px] text-foreground">{a.followers.toLocaleString("en-US")}</span> followers
                    </span>
                  )}
                </ItemContent>
              </button>
            </Item>
          ))}
          {matches.status === "done" && <span className="px-3.5 py-2 text-[11px] text-muted-foreground">Results from Spotify · pick one</span>}
        </div>
      ) : null}
    </>
  );
}
