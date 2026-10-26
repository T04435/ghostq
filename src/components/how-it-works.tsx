import { Logo } from "@/components/brand/logo";
import { MeetTheGhost } from "@/components/brand/meet-the-ghost";
import { CompareView } from "@/components/compare-view";
import { cn } from "cn";

/** The five steps, each with where its data comes from (lime only for Qloo). */
const STEPS = [
  { title: "Your sound", body: "You name an artist and pick them from Spotify’s results. A story seed and a “feat.” artist are optional; nothing else is asked.", src: "Spotify" },
  { title: "Your crowd", body: "Qloo tells us where their fans’ taste is strongest and which ages they skew to. The language is the artist’s own, else the city’s.", src: "Qloo" },
  { title: "Their world", body: "What that crowd loves across music, film, books and lifestyle, each with its affinity score.", src: "Qloo" },
  { title: "The Ghost chooses", body: "It decides which Qloo call to make next from what it has found, then picks the signals the song rests on and says why as it goes.", src: "Agent" },
  {
    title: "The song, with receipts",
    body: "Title, key, tempo, chords, lyrics, melody and brief. Every line cites the signal behind it; code checks each citation is real and no real artist is named.",
    src: "GhostQ",
  },
];

const SOURCES: { name: string; use: string }[] = [
  { name: "Qloo", use: "the crowd’s city and age bands, what it loves across music, film, books and lifestyle, and what two crowds share" },
  { name: "Spotify", use: "artist search only; your pick pins the artist on Qloo" },
  { name: "MusicBrainz", use: "the artist’s listed gender, members and home town, to set the lead voices and the language" },
  { name: "Wikipedia", use: "“How they sing”: a few words on the artist’s singing from their article (CC BY-SA, linked on the receipt)" },
  { name: "OpenStreetMap", use: "the name of the fans’ strongest area (Nominatim; © OpenStreetMap contributors)" },
  { name: "Google Lyria", use: "sings and produces a track of about 3 minutes, with an inaudible SynthID watermark" },
];

const LIMITS = [
  "Qloo has no language filter. The language follows the artist’s home when it’s known, else the crowd’s city, and the crowd card says which.",
  "Taste data describes a crowd, never a person. GhostQ never profiles an individual.",
  "When Qloo doesn’t know the artist, where their fans are or how old they are, the run stops and asks up to three short questions inline, then carries on with your answers. The crowd card says which parts came from you.",
  "Steps show a summary, the source and the receipts. Raw Qloo responses are not shown.",
  "When the daily Qloo or singing budget runs out, or a browser reaches its hourly limit, GhostQ says so and the Songbook’s songs keep playing.",
  "Songs are written for a named artist’s crowd, never as the artist. Every song is labelled as an AI-generated GhostQ draft, not affiliated with that artist, and the voice never imitates them.",
];

/**
 * How it works, as a Landing section (#how; the user, 26 Oct: no separate page, /how redirects here): the five steps,
 * Meet the Ghost, the live "same brief, two writers" compare, then the data sources and the limits.
 */
export function HowItWorks() {
  return (
    <section id="how" className="mx-auto flex w-full max-w-[1200px] scroll-mt-20 flex-col gap-14 border-t px-(--page-x) py-14 sm:py-18">
      <div className="flex max-w-[720px] flex-col gap-3">
        <h2 className="flex items-center gap-4">
          <Logo size={40} ink="var(--glyph-ink)" />
          <span data-text="How it works" className="pixel-echo pixel-grid text-[clamp(36px,4.4vw,56px)] leading-none tracking-[.01em]">
            How it works
          </span>
        </h2>
        <p className="text-[clamp(22px,2.2vw,30px)] leading-[1.1] font-semibold tracking-[-0.03em] text-pretty">How a crowd becomes a song</p>
        <p className="text-[17px] leading-normal text-pretty text-muted-foreground">Five steps, each one visible while it runs. Nothing is required of you except an artist’s name.</p>
      </div>

      <ol className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-[18px]">
            <span className="pixel-square text-[22px] leading-none">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-lg leading-[1.15] font-semibold tracking-[-0.02em]">{s.title}</span>
            <p className="text-[13px] leading-normal text-pretty text-muted-foreground">{s.body}</p>
            <span
              className={cn(
                "self-start rounded-full px-[7px] py-0.5 font-mono text-[10px] tracking-[.04em] uppercase",
                s.src === "Qloo" ? "bg-signal text-signal-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {s.src}
            </span>
          </li>
        ))}
      </ol>

      <MeetTheGhost />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[26px] font-semibold tracking-[-0.03em]">Same brief, two writers</h3>
          <p className="max-w-[640px] text-[15px] leading-normal text-muted-foreground">Your last song next to the same brief written by a plain AI model with no crowd data.</p>
        </div>
        <CompareView />
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 border-t pt-8">
        <div className="flex flex-col gap-2.5">
          <h4 className="text-base font-semibold">Data sources</h4>
          <ul className="flex flex-col gap-1.5 text-sm leading-normal text-muted-foreground">
            {SOURCES.map((s) => (
              <li key={s.name}>
                <strong className="text-foreground">{s.name}</strong> · {s.use}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-base font-semibold">Limits</h4>
          <ul className="flex flex-col gap-1.5 text-sm leading-normal text-muted-foreground">
            {LIMITS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}
