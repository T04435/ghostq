"use client";

import { MessageCircleQuestion, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import { Spinner } from "@/components/ui/spinner";
import { AGE_BANDS, type AgeBand, type AskField, type Brief } from "@/lib/brief";
import { describePlace, type Place } from "@/lib/place";

type Answers = NonNullable<Brief["answers"]>;

const MAX_AGES = 3;

/**
 * The run's question when Qloo has no data, as shadcn's Questionnaire: one question per missing field (the sound, the
 * crowd's city, up to three age bands), with progress and Previous/Next; answering carries the run on.
 */
export function AskCard({ fields, message, busy, onAnswer }: { fields: AskField[]; message: string; busy: boolean; onAnswer: (answers: Answers) => void }) {
  // City search runs on Enter (or the button), against Qloo's locality search; its results are the question's choices.
  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<{ status: "idle" | "searching" | "done" | "error"; results: Place[]; message?: string }>({ status: "idle", results: [] });
  const [ages, setAges] = useState<AgeBand[]>([]);

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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const sound = String(data.get("sound") ?? "").trim();
    const place = cities.results[Number(data.get("place"))];
    onAnswer({
      ...(fields.includes("sound") && sound.length >= 2 ? { sound } : {}),
      ...(fields.includes("place") && place ? { place } : {}),
      ...(fields.includes("ages") && ages.length ? { ages } : {}),
    });
  }

  return (
    <div className="grid gap-4 rounded-lg border-2 border-primary/40 p-4" aria-label="GhostQ needs your answer" role="region">
      <p className="flex gap-2 text-sm font-medium">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
      <Questionnaire items={fields.map((name) => ({ name, required: true }))} onSubmit={submit}>
        {fields.length > 1 && <QuestionnaireProgress />}
        {fields.includes("sound") && (
          <QuestionnaireItem name="sound" required>
            <QuestionnaireTitle>Their sound, in a few words</QuestionnaireTitle>
            <QuestionnaireDescription>Qloo doesn&apos;t know this artist yet, so GhostQ turns your words into Qloo genres.</QuestionnaireDescription>
            <QuestionnaireInput aria-label="Their sound" placeholder="e.g. dreamy lo-fi bedroom pop" maxLength={160} />
          </QuestionnaireItem>
        )}
        {fields.includes("place") && (
          <QuestionnaireItem name="place" required>
            <QuestionnaireTitle>The crowd&apos;s city</QuestionnaireTitle>
            <QuestionnaireDescription>Search any city, then pick it.</QuestionnaireDescription>
            <div className="relative sm:w-96">
              <Input
                aria-label="Search cities"
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
                <Spinner /> Searching cities…
              </p>
            )}
            {cities.status === "error" && <p className="text-sm text-destructive">{cities.message}</p>}
            {cities.status === "done" && cities.results.length === 0 && <p className="text-sm text-muted-foreground">No city called &quot;{cityQuery}&quot;.</p>}
            {cities.results.length > 0 && (
              <QuestionnaireChoices>
                {cities.results.map((c, i) => (
                  <QuestionnaireChoice key={`${c.name}-${c.lat}-${c.lon}`} value={String(i)}>
                    {describePlace(c)}
                  </QuestionnaireChoice>
                ))}
              </QuestionnaireChoices>
            )}
          </QuestionnaireItem>
        )}
        {fields.includes("ages") && (
          <QuestionnaireItem name="ages" required multiple>
            <QuestionnaireTitle>The crowd&apos;s ages</QuestionnaireTitle>
            <QuestionnaireDescription>Pick up to {MAX_AGES}.</QuestionnaireDescription>
            <QuestionnaireChoices>
              {(Object.entries(AGE_BANDS) as [AgeBand, string][]).map(([id, label]) => {
                const on = ages.includes(id);
                return (
                  <QuestionnaireChoice
                    key={id}
                    value={id}
                    checked={on}
                    disabled={!on && ages.length >= MAX_AGES}
                    onChange={() => setAges((xs) => (on ? xs.filter((a) => a !== id) : [...xs, id]))}
                  >
                    {label}
                  </QuestionnaireChoice>
                );
              })}
            </QuestionnaireChoices>
          </QuestionnaireItem>
        )}
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireNext />
          <QuestionnaireSubmit disabled={busy}>Carry on</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}
