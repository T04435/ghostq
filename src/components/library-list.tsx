"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, SearchField } from "@/components/search-filter";
import { SongCard } from "@/components/song-card";
import { Label } from "@/components/ui/label";
import type { SongSummary } from "@/lib/song-summary";

const ALL = "all";

/** The Library's Type filter: originals, remixes or CollabQ songs. */
const TYPES: [string, string][] = [
  ["original", "Originals"],
  ["remix", "Remixes"],
  ["collab", "CollabQ"],
];
const typeOf = (s: SongSummary) => (s.remixOf ? "remix" : s.featuring ? "collab" : "original");
/** "Your songs": the ones this browser wrote, offered as a Type when there are any. */
const YOURS: [string, string] = ["yours", "Your songs"];

/** The public Library: every saved song, with search and filters; a sung song plays in the QPlayer. */
export function LibraryList({ songs }: { songs: SongSummary[] }) {
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [type, setType] = useState(ALL);

  const options = useMemo(
    () => ({
      artists: [...new Set(songs.flatMap((s) => (s.featuring ? [s.artist, s.featuring] : [s.artist])))].sort(),
      cities: [...new Set(songs.map((s) => s.crowd.place?.name).filter((p): p is string => Boolean(p)))].sort(),
      languages: [...new Set(songs.map((s) => s.language))].sort(),
    }),
    [songs],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter(
      (s) =>
        (artist === ALL || s.artist === artist || s.featuring === artist) &&
        (city === ALL || s.crowd.place?.name === city) &&
        (language === ALL || s.language === language) &&
        (type === ALL || (type === YOURS[0] ? Boolean(s.mine) : typeOf(s) === type)) &&
        (!q || [s.title, s.artist, s.featuring ?? "", s.story ?? ""].some((t) => t.toLowerCase().includes(q))),
    );
  }, [songs, query, artist, city, language, type]);

  if (!songs.length) {
    return (
      <EmptyState
        size="lg"
        title="The Songbook is empty"
        body="Nobody has written a song yet. The first one lands here with its crowd and receipts, for everyone to open."
        action={{ label: "Write the first song", href: "/write" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="lib-search" className="sr-only">
            Search title or artist
          </Label>
          <SearchField id="lib-search" placeholder="Search title or artist" className="flex-1" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            <FilterSelect id="lib-artist" label="Artist" all={ALL} value={artist} onChange={setArtist} options={options.artists.map((a) => [a, a])} />
            <FilterSelect id="lib-city" label="City" all={ALL} value={city} onChange={setCity} options={options.cities.map((c) => [c, c])} />
            <FilterSelect id="lib-language" label="Language" all={ALL} value={language} onChange={setLanguage} options={options.languages.map((l) => [l, l])} />
            <FilterSelect id="lib-type" label="Type" all={ALL} value={type} onChange={setType} options={songs.some((s) => s.mine) ? [YOURS, ...TYPES] : TYPES} />
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
          <p className="inline-flex items-baseline gap-[5px]" aria-live="polite">
            <span className="pixel-square text-sm text-foreground">{shown.length}</span>
            {shown.length < songs.length ? `of ${songs.length} songs · filtered` : `song${shown.length === 1 ? "" : "s"}`}
          </p>
          <span>Newest first</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {shown.map((s) => (
          <SongCard key={s.id} song={s} actions />
        ))}
      </div>
      {shown.length === 0 && <EmptyState title="No songs match" body="Clear a filter or the search." />}
    </div>
  );
}
