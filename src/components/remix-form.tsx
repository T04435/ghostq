"use client";

import { MapPin, Search, Shuffle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AGE_BANDS, describeCrowd, type AgeBand, type Remix } from "@/lib/brief";
import { describePlace, type Place } from "@/lib/place";
import type { SongSheet } from "@/lib/song-sheet";
import { possessive } from "@/lib/possessive";

const MAX_AGES = 3;

/**
 * RemixQ's only input: the new crowd for a finished song. A city (Qloo's locality search), up to three age bands, or
 * both; whatever is left out stays as Qloo reads it for the artist.
 */
export function RemixForm({ original, busy, onSubmit }: { original: SongSheet; busy: boolean; onSubmit: (remix: Omit<Remix, "of">) => void }) {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<{ status: "idle" | "searching" | "done" | "error"; results: Place[]; message?: string }>({ status: "idle", results: [] });
  const [place, setPlace] = useState<Place | null>(null);
  const [ages, setAges] = useState<AgeBand[]>([]);
  // Qloo's heatmap: where else this artist's fans are strongest (saved with songs written from 23 Oct).
  const quick = original.crowd.otherAreas ?? [];

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setCities({ status: "searching", results: [] });
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as Place[] | { error: string };
      if (!res.ok || !Array.isArray(body)) throw new Error("error" in body ? body.error : `City search returned ${res.status}`);
      setCities({ status: "done", results: body });
    } catch (e) {
      setCities({ status: "error", results: [], message: e instanceof Error ? e.message : "City search failed" });
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!place && !ages.length) return;
    onSubmit({ ...(place ? { place } : {}), ...(ages.length ? { ages } : {}) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remix &quot;{original.title}&quot; for another crowd</CardTitle>
        <CardDescription>
          Written for {possessive(original.artist)} crowd: {describeCrowd(original.crowd)}. Pick a new city, new ages, or both. What you leave stays as Qloo reads it; the
          song keeps its structure and hook, and changes the lines the new crowd calls for.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-6">
          {quick.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">One click: the fans&apos; next-strongest areas on Qloo</p>
              <div className="flex flex-wrap gap-2">
                {quick.map((p) => (
                  <Button key={`${p.name}-${p.lat}-${p.lon}`} type="button" variant="secondary" disabled={busy} onClick={() => onSubmit({ place: p })}>
                    <MapPin aria-hidden />
                    Remix for the fans around {p.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Or pick any city and ages:</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="remix-city">City</Label>
            {place ? (
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{describePlace(place)}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button type="button" variant="ghost" size="icon" aria-label="Clear the city" onClick={() => setPlace(null)}>
                    <X aria-hidden />
                  </Button>
                </ItemActions>
              </Item>
            ) : (
              <>
                <div className="relative sm:w-96">
                  <Input
                    id="remix-city"
                    placeholder="Any city, then Enter"
                    value={query}
                    className="pr-9"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void search();
                      }
                    }}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" aria-label="Search cities" onClick={() => void search()}>
                    <Search aria-hidden />
                  </Button>
                </div>
                {cities.status === "searching" && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner /> Searching cities…
                  </p>
                )}
                {cities.status === "error" && <p className="text-sm text-destructive">{cities.message}</p>}
                {cities.status === "done" && cities.results.length === 0 && <p className="text-sm text-muted-foreground">No city called &quot;{query}&quot;.</p>}
                {cities.results.length > 0 && (
                  <div className="grid gap-1 rounded-md border p-2 sm:w-96" role="region" aria-label="City results">
                    {cities.results.map((c) => (
                      <Item key={`${c.name}-${c.lat}-${c.lon}`} asChild size="sm" className="cursor-pointer text-left hover:bg-accent focus-visible:bg-accent">
                        <button type="button" onClick={() => setPlace(c)}>
                          <ItemContent>
                            <ItemTitle>{describePlace(c)}</ItemTitle>
                          </ItemContent>
                        </button>
                      </Item>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid gap-2">
            <Label id="remix-ages">Ages (up to {MAX_AGES})</Label>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              aria-labelledby="remix-ages"
              className="flex-wrap"
              value={ages}
              onValueChange={(v) => setAges((v as AgeBand[]).slice(0, MAX_AGES))}
            >
              {(Object.entries(AGE_BANDS) as [AgeBand, string][]).map(([id, label]) => (
                <ToggleGroupItem key={id} value={id} disabled={!ages.includes(id) && ages.length >= MAX_AGES}>
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div>
            <Button type="submit" size="lg" disabled={busy || (!place && !ages.length)}>
              {busy ? <Spinner /> : <Shuffle aria-hidden />}
              {busy ? "Remixing…" : "Remix it"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
