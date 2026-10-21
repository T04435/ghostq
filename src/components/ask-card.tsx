"use client";

import { Loader2, MessageCircleQuestion, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_BANDS, type AgeBand, type AskField, type Brief } from "@/lib/brief";
import { describePlace, type Place } from "@/lib/place";

type Answers = NonNullable<Brief["answers"]>;

/** The run's question when Qloo has no data. Only the fields the run asked for are shown; answering carries the run on. */
export function AskCard({ fields, message, busy, onAnswer }: { fields: AskField[]; message: string; busy: boolean; onAnswer: (answers: Answers) => void }) {
  const [sound, setSound] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  // City search runs on Enter (or the button), against Qloo's locality search.
  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<{ status: "idle" | "searching" | "done" | "error"; results: Place[]; message?: string }>({ status: "idle", results: [] });

  async function searchCities() {
    const q = cityQuery.trim();
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
  const [ages, setAges] = useState<AgeBand[]>([]);
  const ready = (!fields.includes("sound") || sound.trim().length >= 2) && (!fields.includes("place") || place) && (!fields.includes("ages") || ages.length > 0);

  function toggleAge(band: AgeBand) {
    setAges((xs) => (xs.includes(band) ? xs.filter((a) => a !== band) : xs.length < 3 ? [...xs, band] : xs));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    onAnswer({
      ...(fields.includes("sound") ? { sound: sound.trim() } : {}),
      ...(fields.includes("place") && place ? { place } : {}),
      ...(fields.includes("ages") ? { ages } : {}),
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border-2 border-primary/40 p-4" aria-label="GhostQ needs your answer">
      <p className="flex gap-2 text-sm font-medium">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
      {fields.includes("sound") && (
        <div className="grid gap-2">
          <Label htmlFor="ask-sound">Their sound, in a few words</Label>
          <Input id="ask-sound" placeholder="e.g. dreamy lo-fi bedroom pop" maxLength={160} value={sound} onChange={(e) => setSound(e.target.value)} />
        </div>
      )}
      {fields.includes("place") && (
        <div className="grid gap-2">
          <Label htmlFor="ask-place">City of the crowd</Label>
          {place ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{describePlace(place)}</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setPlace(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative sm:w-96">
                <Input
                  id="ask-place"
                  placeholder="Any city, then Enter"
                  value={cityQuery}
                  className="pr-9"
                  onChange={(e) => setCityQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchCities();
                    }
                  }}
                />
                <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" aria-label="Search cities" onClick={() => void searchCities()}>
                  <Search aria-hidden />
                </Button>
              </div>
              {cities.status === "searching" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Searching cities…
                </p>
              )}
              {cities.status === "error" && <p className="text-sm text-destructive">{cities.message}</p>}
              {cities.status === "done" && cities.results.length === 0 && <p className="text-sm text-muted-foreground">No city called &quot;{cityQuery}&quot;.</p>}
              {cities.results.length > 0 && (
                <div className="grid gap-1 rounded-md border p-1 sm:w-96" role="region" aria-label="Cities">
                  {cities.results.map((c) => (
                    <button
                      key={`${c.name}-${c.lat}-${c.lon}`}
                      type="button"
                      onClick={() => setPlace(c)}
                      className="rounded px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      {describePlace(c)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {fields.includes("ages") && (
        <div className="grid gap-2">
          <span className="text-sm font-medium" id="ask-ages">
            Ages (up to 3)
          </span>
          <div className="flex flex-wrap gap-1" role="group" aria-labelledby="ask-ages">
            {(Object.entries(AGE_BANDS) as [AgeBand, string][]).map(([id, label]) => {
              const on = ages.includes(id);
              return (
                <Button key={id} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} disabled={!on && ages.length >= 3} onClick={() => toggleAge(id)}>
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <Button type="submit" disabled={!ready || busy}>
          Carry on
        </Button>
      </div>
    </form>
  );
}
