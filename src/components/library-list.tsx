"use client";

import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, SearchField } from "@/components/search-filter";
import { SongCard } from "@/components/song-card";
import { Label } from "@/components/ui/label";
import type { SongSummary } from "@/lib/song-summary";

const ALL = "all";

/** The public Library: every saved song, with search, filters and play in place. */
export function LibraryList({ songs }: { songs: SongSummary[] }) {
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

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
        (!q || [s.title, s.artist, s.featuring ?? "", s.story ?? ""].some((t) => t.toLowerCase().includes(q))),
    );
  }, [songs, query, artist, city, language]);

  function toggle(song: SongSummary) {
    const el = audio.current;
    if (!el) return;
    if (playing === song.id) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = `/api/songs/${song.id}/audio?v=${encodeURIComponent(song.audioVersion ?? "")}`;
    void el.play();
    setPlaying(song.id);
  }

  if (!songs.length) {
    return <EmptyState size="lg" title="No songs yet" body="Every song written with GhostQ appears here, with the research behind it." action={{ label: "Write the first one", href: "/" }} />;
  }

  return (
    <div className="grid gap-4">
      {/* One shared player, so only one song plays at a time. */}
      <audio ref={audio} onEnded={() => setPlaying(null)} className="hidden">
        <track kind="captions" />
      </audio>
      <div className="flex flex-col gap-3">
        <Label htmlFor="lib-search" className="sr-only">
          Search
        </Label>
        <SearchField id="lib-search" placeholder="Title, artist or story" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect id="lib-artist" label="Artist" all={ALL} value={artist} onChange={setArtist} options={options.artists.map((a) => [a, a])} />
          <FilterSelect id="lib-city" label="City" all={ALL} value={city} onChange={setCity} options={options.cities.map((c) => [c, c])} />
          <FilterSelect id="lib-language" label="Language" all={ALL} value={language} onChange={setLanguage} options={options.languages.map((l) => [l, l])} />
          <p className="ml-auto text-sm text-muted-foreground">
            <span className="pixel-square text-foreground">{shown.length}</span> of {songs.length} songs
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        {shown.map((s) => (
          <SongCard key={s.id} song={s} playing={playing === s.id} onToggle={() => toggle(s)} />
        ))}
      </div>
      {shown.length === 0 && <EmptyState title="No songs match" body="Clear a filter or the search." />}
    </div>
  );
}
