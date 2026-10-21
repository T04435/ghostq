"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describeCrowd, PLACES } from "@/lib/brief";
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
      cities: [...new Set(songs.map((s) => s.crowd.place).filter((p): p is NonNullable<typeof p> => Boolean(p)))].sort(),
      languages: [...new Set(songs.map((s) => s.language))].sort(),
    }),
    [songs],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter(
      (s) =>
        (artist === ALL || s.artist === artist) &&
        (city === ALL || s.crowd.place === city) &&
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
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        No songs yet. Every song written with GhostQ appears here, with the research behind it. <Link href="/" className="underline">Write the first one</Link>
      </p>
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
          <Filter id="lib-city" label="City" value={city} onChange={setCity} options={options.cities.map((c) => [c, PLACES[c].name])} />
          <Filter id="lib-language" label="Language" value={language} onChange={setLanguage} options={options.languages.map((l) => [l, l])} />
          <p className="self-end text-sm text-muted-foreground">
            {shown.length} of {songs.length} songs
          </p>
        </div>
      )}
      <ul className="grid gap-2">
        {shown.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
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
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Link href={`/song/${s.id}`} className="truncate font-medium hover:underline">
                {s.title}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                {s.artist} · {describeCrowd(s.crowd)} · {s.language}
              </p>
            </div>
            {!s.sung && <Badge variant="secondary">Not sung yet</Badge>}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No songs match. Clear a filter or the search.</p>}
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
