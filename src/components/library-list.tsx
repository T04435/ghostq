"use client";

import { Music, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
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
      artists: [...new Set(songs.map((s) => s.artist))].sort(),
      cities: [...new Set(songs.map((s) => s.crowd.place?.name).filter((p): p is string => Boolean(p)))].sort(),
      languages: [...new Set(songs.map((s) => s.language))].sort(),
    }),
    [songs],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter(
      (s) =>
        (artist === ALL || s.artist === artist) &&
        (city === ALL || s.crowd.place?.name === city) &&
        (language === ALL || s.language === language) &&
        (!q || [s.title, s.artist, s.story ?? ""].some((t) => t.toLowerCase().includes(q))),
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
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Music aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No songs yet</EmptyTitle>
          <EmptyDescription>Every song written with GhostQ appears here, with the research behind it.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Write the first one</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4">
      {/* One shared player, so only one song plays at a time. */}
      <audio ref={audio} onEnded={() => setPlaying(null)} className="hidden">
        <track kind="captions" />
      </audio>
      {(
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="grid gap-1 sm:col-span-4">
            <Label htmlFor="lib-search">Search</Label>
            <Input id="lib-search" placeholder="Title, artist or story" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Filter id="lib-artist" label="Artist" value={artist} onChange={setArtist} options={options.artists.map((a) => [a, a])} />
          <Filter id="lib-city" label="City" value={city} onChange={setCity} options={options.cities.map((c) => [c, c])} />
          <Filter id="lib-language" label="Language" value={language} onChange={setLanguage} options={options.languages.map((l) => [l, l])} />
          <p className="self-end text-sm text-muted-foreground">
            {shown.length} of {songs.length} songs
          </p>
        </div>
      )}
      <ItemGroup className="gap-2">
        {shown.map((s) => (
          <Item key={s.id} variant="outline">
            <ItemMedia>
            <Button
              type="button"
              variant={playing === s.id ? "default" : "outline"}
              size="icon"
              disabled={!s.sung}
              aria-label={s.sung ? (playing === s.id ? `Pause ${s.title}` : `Play ${s.title}`) : `${s.title} hasn't been sung yet`}
              onClick={() => toggle(s)}
            >
              {playing === s.id ? <Pause aria-hidden /> : <Play aria-hidden />}
            </Button>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full">
                <Link href={`/song/${s.id}`} className="truncate hover:underline">
                  {s.title}
                </Link>
              </ItemTitle>
              <ItemDescription className="truncate">
                {s.artist} · {describeCrowd(s.crowd)} · {s.language}
              </ItemDescription>
              <p className="truncate text-xs text-muted-foreground">{draftLabel(s.artist)}</p>
            </ItemContent>
            {!s.sung && (
              <ItemActions>
                <Badge variant="secondary">Not sung yet</Badge>
              </ItemActions>
            )}
          </Item>
        ))}
      </ItemGroup>
      {shown.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No songs match</EmptyTitle>
            <EmptyDescription>Clear a filter or the search.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function Filter({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
