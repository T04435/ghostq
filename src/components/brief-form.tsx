"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AGE_BANDS, describeAges, EXAMPLE_BRIEFS, LANGUAGES, PLACES, type AgeBand, type Brief, type PlaceId } from "@/lib/brief";
import type { FanProfile } from "@/lib/fan-profile";
import type { SpotifyArtist } from "@/lib/spotify-artist";

type Props = { initial?: Brief; busy: boolean; onSubmit: (brief: Brief) => void };

const EMPTY: Brief = { artist: "", sound: "", place: "melbourne", ages: ["25_to_29"], language: "English", story: "" };

/**
 * Where the crowd comes from:
 * - "manual": no artist, or the user chose another crowd: three pickers;
 * - "checking": reading the artist's fans on Qloo;
 * - "qloo": read-only, from Qloo's data on the artist (a picker only for what Qloo didn't have).
 */
type Crowd = { mode: "manual"; message?: string } | { mode: "checking"; artist: string } | { mode: "qloo"; profile: FanProfile };

export function BriefForm({ initial, busy, onSubmit }: Props) {
  const [brief, setBrief] = useState<Brief>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [crowd, setCrowd] = useState<Crowd>({ mode: "manual" });
  const looked = useRef<string | null>(null);
  // Spotify search runs only on Enter, to save calls; null = no search shown.
  const [matches, setMatches] = useState<{ query: string; status: "searching" | "done" | "error"; artists: SpotifyArtist[]; message?: string } | null>(null);

  async function searchSpotify() {
    const query = brief.artist?.trim();
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
    void lookUpFans(artist.name, artist.id);
  }
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => setBrief((b) => ({ ...b, [key]: value }));
  const setPlace = (place: PlaceId) => setBrief((b) => ({ ...b, place, language: PLACES[place].language }));

  async function lookUpFans(name: string, spotifyId?: string) {
    const key = `${name.trim().toLowerCase()}|${spotifyId ?? ""}`;
    if (!key || key === looked.current) return;
    looked.current = key;
    setCrowd({ mode: "checking", artist: name.trim() });
    try {
      const response = await fetch(`/api/artist?${new URLSearchParams({ name: name.trim(), ...(spotifyId ? { spotifyId } : {}) })}`);
      if (looked.current !== key) return;
      const profile = response.ok ? ((await response.json()) as FanProfile | null) : null;
      if (!response.ok) return setCrowd({ mode: "manual", message: "Couldn't reach Qloo, so pick the crowd yourself." });
      if (!profile) return setCrowd({ mode: "manual", message: `Qloo doesn't know "${name.trim()}", so pick the crowd yourself.` });
      if (!profile.place && !profile.ages.length) return setCrowd({ mode: "manual", message: `Qloo has no fan data for ${profile.artist} yet, so pick the crowd yourself.` });
      if (profile.place) setPlace(profile.place);
      if (profile.ages.length) set("ages", profile.ages.map((a) => a.age));
      setCrowd({ mode: "qloo", profile });
    } catch {
      if (looked.current === key) setCrowd({ mode: "manual", message: "Couldn't reach Qloo, so pick the crowd yourself." });
    }
  }

  // A brief restored from this device: read its artist's crowd again (the server caches Qloo for 24 h).
  useEffect(() => {
    if (initial?.artist) void lookUpFans(initial.artist, initial.spotifyId);
    // Only on mount: the parent remounts the form when it restores a brief.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!brief.artist?.trim() && !brief.sound?.trim()) {
      setError("Give an artist or describe your sound.");
      return;
    }
    if (crowd.mode === "checking") {
      setError("Still reading the artist's fans on Qloo: a few more seconds.");
      return;
    }
    setError(null);
    onSubmit({ ...brief, artist: brief.artist?.trim() || undefined, sound: brief.sound?.trim() || undefined, story: brief.story?.trim() || undefined });
  }

  const placePicker = (
    <div className="grid gap-2">
      <Label htmlFor="place">City</Label>
      <Select value={brief.place} onValueChange={(v) => setPlace(v as PlaceId)}>
        <SelectTrigger id="place" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PLACES).map(([id, p]) => (
            <SelectItem key={id} value={id}>
              {p.name}, {p.country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  // Up to three bands; the last one can't be switched off.
  const toggleAge = (band: AgeBand) =>
    setBrief((b) => {
      const has = b.ages.includes(band);
      if (has) return b.ages.length > 1 ? { ...b, ages: b.ages.filter((a) => a !== band) } : b;
      return b.ages.length < 3 ? { ...b, ages: [...b.ages, band] } : b;
    });
  const agePicker = (
    <div className="grid gap-2">
      <span className="text-sm font-medium" id="age-label">
        Age (up to 3)
      </span>
      <div className="flex flex-wrap gap-1" role="group" aria-labelledby="age-label">
        {(Object.entries(AGE_BANDS) as [AgeBand, string][]).map(([id, label]) => {
          const on = brief.ages.includes(id);
          return (
            <Button key={id} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} disabled={!on && brief.ages.length >= 3} onClick={() => toggleAge(id)}>
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
  const languagePicker = (
    <div className="grid gap-2">
      <Label htmlFor="language">Language</Label>
      <Select value={brief.language} onValueChange={(v) => set("language", v as Brief["language"])}>
        <SelectTrigger id="language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

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
              looked.current = null;
              setCrowd({ mode: "manual" });
              setMatches(null);
              if (example.brief.artist) void lookUpFans(example.brief.artist, example.brief.spotifyId);
            }}
          >
            {example.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="artist">Artist</Label>
          <div className="relative">
            <Input
              id="artist"
              placeholder="e.g. Teenage Joans, then Enter"
              value={brief.artist ?? ""}
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
            {brief.spotifyId ? "Picked on Spotify." : "Press Enter to find the artist on Spotify."}
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
                  <span className="grid">
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[a.genres.join(", "), a.followers !== null ? `${a.followers.toLocaleString()} followers` : ""].filter(Boolean).join(" · ") || "Spotify artist"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sound">or your sound, in your words</Label>
          <Input id="sound" placeholder="e.g. dreamy lo-fi bedroom pop" value={brief.sound ?? ""} maxLength={160} onChange={(e) => set("sound", e.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">The crowd you&apos;re writing for</legend>

        {crowd.mode === "checking" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Reading where {crowd.artist}&apos;s fans are and who they are on Qloo (about 10 s)…
          </p>
        )}

        {crowd.mode === "qloo" && (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">City</dt>
                {crowd.profile.place ? (
                  <dd>
                    <span className="font-medium">{PLACES[brief.place].name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Fans&apos; strongest area on Qloo{crowd.profile.placeRank ? ` (#${crowd.profile.placeRank.rank} of ${crowd.profile.placeRank.of})` : ""}
                    </span>
                  </dd>
                ) : (
                  <dd className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Qloo has no location data: pick one</span>
                    {placePicker}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-muted-foreground">Age</dt>
                {crowd.profile.ages.length ? (
                  <dd>
                    <span className="font-medium">{describeAges(brief.ages)}</span>
                    <span className="block text-xs text-muted-foreground">
                      Fans skew {crowd.profile.ages.map((a) => `${AGE_BANDS[a.age]} +${a.skew}`).join(", ")}
                    </span>
                  </dd>
                ) : (
                  <dd className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Qloo has no age data: pick one</span>
                    {agePicker}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-muted-foreground">Language</dt>
                <dd>
                  <span className="font-medium">{brief.language}</span>
                  <span className="block text-xs text-muted-foreground">From the city</span>
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">From Qloo: {crowd.profile.artist}</Badge>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setCrowd({ mode: "manual" })}>
                Write for a different crowd
              </Button>
            </div>
          </>
        )}

        {crowd.mode === "manual" && (
          <>
            <p className="text-sm text-muted-foreground">{crowd.message ?? "Pick an artist from Spotify and GhostQ reads their crowd from Qloo, or set it here."}</p>
            <div className="grid gap-5 sm:grid-cols-3">
              {placePicker}
              {agePicker}
              {languagePicker}
            </div>
          </>
        )}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="story">Story seed (optional)</Label>
        <Textarea id="story" placeholder="e.g. Last tram home after a share-house party" value={brief.story ?? ""} maxLength={280} rows={2} onChange={(e) => set("story", e.target.value)} />
      </div>

      <div>
        <Button type="submit" size="lg" disabled={busy || crowd.mode === "checking"}>
          {busy ? "Writing…" : "Write the song"}
        </Button>
      </div>
    </form>
  );
}
