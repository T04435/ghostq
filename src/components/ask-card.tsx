"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGE_BANDS, PLACES, type AgeBand, type AskField, type Brief, type PlaceId } from "@/lib/brief";

type Answers = NonNullable<Brief["answers"]>;

/** The run's question when Qloo has no data. Only the fields the run asked for are shown; answering carries the run on. */
export function AskCard({ fields, message, busy, onAnswer }: { fields: AskField[]; message: string; busy: boolean; onAnswer: (answers: Answers) => void }) {
  const [sound, setSound] = useState("");
  const [place, setPlace] = useState<PlaceId | "">("");
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
          <Select value={place || undefined} onValueChange={(v) => setPlace(v as PlaceId)}>
            <SelectTrigger id="ask-place" className="w-full sm:w-72">
              <SelectValue placeholder="Choose a city" />
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
