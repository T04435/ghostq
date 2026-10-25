"use client";

import { Check, MapPin, Search } from "lucide-react";
import { cn } from "cn";
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
import { AGE_BANDS, type AgeBand, type AskField, type Brief, type QlooOption, type Language } from "@/lib/brief";
import { describePlace, type Place } from "@/lib/place";

type Answers = NonNullable<Brief["answers"]>;

const MAX_AGES = 3;

/**
 * The run's question when Qloo has no data, as shadcn's Questionnaire: one question per missing field (the sound, the
 * crowd's city, up to three age bands), with progress and Previous/Next; answering carries the run on.
 */
const choiceRow =
  "min-h-0 items-center gap-2.5 rounded-none border-0 border-b bg-transparent px-3.5 py-2.5 last:border-b-0 hover:bg-muted data-checked:bg-muted dark:bg-transparent dark:data-checked:bg-muted [&>[data-slot=questionnaire-choice-indicator]]:hidden";
const choiceBand =
  "h-[34px] min-h-0 flex-row items-center gap-[5px] rounded-full border-border bg-card px-3 py-0 pixel-circle text-[13px] hover:border-foreground hover:bg-card data-checked:border-foreground data-checked:bg-foreground data-checked:text-background data-disabled:border-dashed data-disabled:text-muted-foreground data-disabled:opacity-100 dark:bg-card dark:data-checked:bg-foreground [&>[data-slot=questionnaire-choice-indicator]]:hidden";

/** The language question's choices: each candidate, then a mix of the first with each of the others. */
function languageChoices(langs: Language[]): { value: string; label: string }[] {
  const [first, ...rest] = langs;
  if (!first) return [];
  return [...langs.map((l) => ({ value: l, label: l })), ...rest.map((l) => ({ value: `${first}+${l}`, label: `A mix of ${first} and ${l}` }))];
}

function languageAnswer(value: string): { primary: Language; mix?: Language } {
  const [primary, mix] = value.split("+") as Language[];
  return mix ? { primary, mix } : { primary };
}

/** The "none of these" choice when Qloo's candidates don't include the artist. */
const NONE = "__none__";

export function AskCard({
  fields,
  message,
  busy,
  onAnswer,
  artist,
  options,
  languages,
}: {
  fields: AskField[];
  message: string;
  busy: boolean;
  onAnswer: (answers: Answers) => void;
  artist?: string;
  options?: QlooOption[];
  languages?: Language[];
}) {
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
    const qloo = String(data.get("qlooArtist") ?? "");
    const lang = String(data.get("language") ?? "");
    const place = cities.results[Number(data.get("place"))];
    onAnswer({
      ...(fields.includes("language") && lang ? { language: languageAnswer(lang) } : {}),
      ...(fields.includes("qlooArtist") && qloo ? (qloo === NONE ? { noQloo: true as const } : { qlooId: qloo }) : {}),
      ...(fields.includes("sound") && sound.length >= 2 ? { sound } : {}),
      ...(fields.includes("place") && place ? { place } : {}),
      ...(fields.includes("ages") && ages.length ? { ages } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-foreground bg-card px-[18px] py-4 text-foreground" aria-label="GhostQ needs your answer" role="region">
      <Questionnaire items={fields.map((name) => ({ name, required: true }))} onSubmit={submit} className="gap-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">{message}</span>
            <span className="text-[13px] leading-[1.45] text-muted-foreground">The run has stopped. {fields.length > 1 ? "A few quick answers stand in" : "A quick answer stands in"} for Qloo, then it carries on.</span>
          </div>
          {fields.length > 1 && (
            <QuestionnaireProgress
              className="min-w-0 flex-none"
              render={(props, { current, total }) => (
                <div {...props}>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="inline-flex items-baseline gap-1 text-xs font-normal text-muted-foreground">
                      Question <span className="pixel-square text-[15px] text-foreground">{current}</span> of {total}
                    </span>
                    <span className="flex gap-1" aria-hidden>
                      {Array.from({ length: total }, (_, i) => (
                        <span key={i} className={cn("h-1.5 w-7 rounded-[3px] border-[1.5px]", i + 1 < current ? "border-foreground bg-foreground" : i + 1 === current ? "border-foreground" : "border-border")} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            />
          )}
        </div>
        {fields.includes("qlooArtist") && (
          <QuestionnaireItem name="qlooArtist" required className="gap-2.5 border-t pt-3.5">
            <QuestionnaireTitle className="text-base font-semibold tracking-[-0.01em]">Which artist on Qloo?</QuestionnaireTitle>
            <QuestionnaireDescription className="text-xs">Qloo&apos;s taste data is per artist, so pick the one you mean. If none is, GhostQ goes on with the Spotify artist and asks for their sound.</QuestionnaireDescription>
            <QuestionnaireChoices className="gap-0 overflow-hidden rounded-xl border bg-popover">
              {(options ?? []).map((o) => (
                <QuestionnaireChoice key={o.id} value={o.id} className={choiceRow}>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{o.name}</span>
                    {o.description && <span className="line-clamp-2 text-xs text-muted-foreground">{o.description}</span>}
                  </span>
                </QuestionnaireChoice>
              ))}
              <QuestionnaireChoice value={NONE} className={choiceRow}>
                <span className="text-sm font-semibold">None of these: carry on with {artist} from Spotify</span>
              </QuestionnaireChoice>
            </QuestionnaireChoices>
          </QuestionnaireItem>
        )}
        {fields.includes("language") && (
          <QuestionnaireItem name="language" required className="gap-2.5 border-t pt-3.5">
            <QuestionnaireTitle className="text-base font-semibold tracking-[-0.01em]">Which language?</QuestionnaireTitle>
            <QuestionnaireDescription className="text-xs">The artist&apos;s home and Qloo tags point to one language and the crowd&apos;s city to another. Pick one, or a mix of two.</QuestionnaireDescription>
            <QuestionnaireChoices className="gap-0 overflow-hidden rounded-xl border bg-popover">
              {languageChoices(languages ?? []).map((c) => (
                <QuestionnaireChoice key={c.value} value={c.value} className={choiceRow}>
                  <span className="text-sm font-semibold">{c.label}</span>
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>
          </QuestionnaireItem>
        )}
        {fields.includes("sound") && (
          <QuestionnaireItem name="sound" required className="gap-2.5 border-t pt-3.5">
            <QuestionnaireTitle className="text-base font-semibold tracking-[-0.01em]">Their sound, in a few words</QuestionnaireTitle>
            <QuestionnaireDescription className="text-xs">Qloo doesn&apos;t know this artist yet, so GhostQ turns your words into Qloo genres.</QuestionnaireDescription>
            <QuestionnaireInput aria-label="Their sound" placeholder="e.g. dreamy lo-fi bedroom pop" maxLength={160} className="h-12 min-h-12 rounded-full bg-card px-4 text-[15px] focus-visible:border-foreground focus-visible:ring-ring md:text-[15px] dark:bg-card" />
          </QuestionnaireItem>
        )}
        {fields.includes("place") && (
          <QuestionnaireItem name="place" required className="gap-2.5 border-t pt-3.5">
            <QuestionnaireTitle className="text-base font-semibold tracking-[-0.01em]">The crowd&apos;s city</QuestionnaireTitle>
            <QuestionnaireDescription className="text-xs">Search any city, then pick it.</QuestionnaireDescription>
            <div className="relative sm:w-96">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search cities"
                placeholder="Any city, then Enter"
                value={cityQuery}
                className="pr-12 pl-10"
                onChange={(e) => setCityQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchCities();
                  }
                }}
              />
              <Button type="button" variant="ghost" size="xs" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border font-mono text-[10px] font-normal" aria-label="Search cities" onClick={() => void searchCities()}>
                Enter
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
              <QuestionnaireChoices className="gap-0 overflow-hidden rounded-xl border bg-popover sm:w-96">
                {cities.results.map((c, i) => (
                  <QuestionnaireChoice key={`${c.name}-${c.lat}-${c.lon}`} value={String(i)} className={choiceRow}>
                    <span className="flex items-center gap-2.5">
                      <MapPin className="size-3.5 flex-none" aria-hidden />
                      <span className="text-sm font-semibold">{describePlace(c)}</span>
                    </span>
                  </QuestionnaireChoice>
                ))}
                <span className="flex items-center gap-1.5 px-3.5 py-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-signal px-[7px] py-0.5 font-mono text-[10px] text-signal-foreground">QLOO</span>
                  city search
                </span>
              </QuestionnaireChoices>
            )}
          </QuestionnaireItem>
        )}
        {fields.includes("ages") && (
          <QuestionnaireItem name="ages" required multiple className="gap-2.5 border-t pt-3.5">
            <QuestionnaireTitle className="text-base font-semibold tracking-[-0.01em]">The crowd&apos;s ages</QuestionnaireTitle>
            <QuestionnaireDescription className="text-xs">Pick up to {MAX_AGES}.</QuestionnaireDescription>
            <QuestionnaireChoices className="flex flex-wrap gap-1.5">
              {(Object.entries(AGE_BANDS) as [AgeBand, string][]).map(([id, label]) => {
                const on = ages.includes(id);
                return (
                  <QuestionnaireChoice
                    key={id}
                    value={id}
                    checked={on}
                    disabled={!on && ages.length >= MAX_AGES}
                    onChange={() => setAges((xs) => (on ? xs.filter((a) => a !== id) : [...xs, id]))}
                    className={choiceBand}
                  >
                    <span className="inline-flex items-center gap-[5px]">
                      {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
                      {label}
                    </span>
                  </QuestionnaireChoice>
                );
              })}
            </QuestionnaireChoices>
            <span className="text-xs text-muted-foreground">
              {ages.length} of {MAX_AGES} picked{ages.length >= MAX_AGES ? " · that’s the limit" : ""}
            </span>
          </QuestionnaireItem>
        )}
        <QuestionnaireActions className="border-t pt-3">
          <QuestionnairePrevious size="sm" />
          <QuestionnaireNext size="sm" />
          <QuestionnaireSubmit size="sm" disabled={busy}>Carry on</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}
