"use client";

import { Check, GitFork, MapPin, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AGE_BANDS, describeAges, describeCrowd, type AgeBand, type Remix } from "@/lib/brief";
import { describePlace, type Place } from "@/lib/place";
import type { SongSheet } from "@/lib/song-sheet";
import { possessive } from "@/lib/possessive";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { SongTitle } from "@/components/song-title";

const MAX_AGES = 3;

/**
 * RemixQ's only input: the new crowd for a finished song. A city (Qloo's locality search), up to three age bands, or
 * both; whatever is left out stays as Qloo reads it for the artist.
 */
export function RemixForm({
  original,
  busy,
  initial,
  onSubmit,
}: {
  original: SongSheet;
  busy: boolean;
  /** Picks to fill in without running (a Ghost suggestion from Write): the run waits for Remix. */
  initial?: Omit<Remix, "of">;
  onSubmit: (remix: Omit<Remix, "of">) => void;
}) {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<{ status: "idle" | "searching" | "done" | "error"; results: Place[]; message?: string }>({ status: "idle", results: [] });
  const [place, setPlace] = useState<Place | null>(initial?.place ?? null);
  const [ages, setAges] = useState<AgeBand[]>(initial?.ages ?? []);
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

  // A typed city that wasn't picked from the results would be dropped without a word: ask for the pick instead.
  const unpicked = !place && query.trim().length > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (unpicked || (!place && !ages.length)) return;
    onSubmit({ ...(place ? { place } : {}), ...(ages.length ? { ages } : {}) });
  }

  const ready = !unpicked && (Boolean(place) || ages.length > 0);
  return (
    <Card className="gap-4 p-[18px]">
      <div className="flex flex-col gap-1">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-[-0.01em]">
          <GitFork className="size-4 flex-none" aria-hidden />
          Remix <SongTitle size="sm" title={original.title} className="inline-flex" /> for another crowd
        </h2>
        <p className="text-[13px] leading-[1.45] text-muted-foreground">
          Written for {possessive(original.artist)} crowd: {describeCrowd(original.crowd)}. Pick a new city, new ages, or both. What you leave stays as Qloo reads it; the song
          keeps its structure and hook, and changes the lines the new crowd calls for.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {quick.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {possessive(original.artist)} next-strongest fan areas
              <span className="rounded-full bg-signal px-[7px] py-0.5 font-mono text-[10px] font-normal text-signal-foreground">QLOO</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quick.map((p, i) => (
                <Button
                  key={`${p.name}-${p.lat}-${p.lon}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 hover:border-foreground"
                  disabled={busy}
                  aria-label={`Remix for the fans around ${p.name}`}
                  onClick={() => onSubmit({ place: p })}
                >
                  <span>{p.name}</span>
                  <span className="pixel-circle text-[13px] font-normal">#{i + 2}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">One click remixes for that area. Or pick any city and ages:</p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="remix-city" className="text-xs">
            City <span className="font-normal text-muted-foreground">· Qloo city search</span>
          </Label>
          {place ? (
            <div className="flex h-[46px] items-center gap-2.5 rounded-full border border-foreground bg-card pr-2 pl-4 w-full max-w-96">
              <MapPin className="size-4 flex-none text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[15px]">{describePlace(place)}</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear the city" onClick={() => setPlace(null)}>
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative w-full max-w-96">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="remix-city"
                  placeholder="Any city, then Enter"
                  value={query}
                  className="h-[46px] pr-20 pl-10"
                  onChange={(e) => setQuery(e.target.value)}
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
                  className="absolute top-1/2 right-3 h-6 -translate-y-1/2 rounded-sm border px-[7px] font-mono text-[10px] font-normal"
                  aria-label="Search cities"
                  onClick={() => void search()}
                >
                  Enter
                </Button>
              </div>
              {cities.status === "searching" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GhostMark size={GHOST_SIZES.tag} state="working" decorative /> Searching cities…
                </p>
              )}
              {cities.status === "error" && <p className="text-sm text-destructive">{cities.message}</p>}
              {cities.status === "done" && cities.results.length === 0 && <p className="text-sm text-muted-foreground">No city called &quot;{query}&quot;.</p>}
              {cities.results.length > 0 && (
                <div className="flex flex-col overflow-hidden rounded-xl border bg-popover w-full max-w-96" role="region" aria-label="City results">
                  {cities.results.map((c) => (
                    <Item key={`${c.name}-${c.lat}-${c.lon}`} asChild size="sm" className="cursor-pointer gap-2.5 rounded-none border-0 border-b px-3.5 py-[9px] text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted">
                      <button type="button" onClick={() => setPlace(c)}>
                        <MapPin className="size-3.5 flex-none" aria-hidden />
                        <ItemContent>
                          <ItemTitle className="text-sm font-semibold">{describePlace(c)}</ItemTitle>
                        </ItemContent>
                      </button>
                    </Item>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <Label id="remix-ages" className="text-xs">
              Ages <span className="font-normal text-muted-foreground">· up to {MAX_AGES}</span>
            </Label>
            <span className="inline-flex items-baseline gap-[3px] text-muted-foreground">
              <span className="pixel-square text-[13px] text-foreground">{ages.length}</span>/{MAX_AGES}
            </span>
          </div>
          <ToggleGroup
            type="multiple"
            variant="band"
            size="band"
            spacing={1.5}
            aria-labelledby="remix-ages"
            className="flex-wrap"
            value={ages}
            onValueChange={(v) => setAges((v as AgeBand[]).slice(0, MAX_AGES))}
          >
            {(Object.entries(AGE_BANDS) as [AgeBand, string][]).map(([id, label]) => (
              <ToggleGroupItem key={id} value={id} disabled={!ages.includes(id) && ages.length >= MAX_AGES}>
                {ages.includes(id) && <Check strokeWidth={3} aria-hidden />}
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-3.5">
          <Button type="submit" disabled={busy || !ready}>
            {busy ? <GhostMark size={GHOST_SIZES.tag} state="working" decorative /> : <GitFork aria-hidden />}
            {busy ? "Remixing…" : "Remix it"}
          </Button>
          <span className={unpicked ? "min-w-40 flex-1 text-xs leading-[1.45] text-destructive" : "min-w-40 flex-1 text-xs leading-[1.45] text-muted-foreground"}>
            {unpicked
              ? `Pick "${query.trim()}" from the city results (press Enter to search), or clear the field.`
              : ready
                ? `For ${place ? place.name : "the original city"}${ages.length ? `, ${describeAges(ages)}` : ", the original ages"}. About a minute, with live steps.`
                : "Pick a city, up to three age bands, or both."}
          </span>
        </div>
      </form>
    </Card>
  );
}
