import type { Metadata } from "next";
import { CompareView } from "@/components/compare-view";

export const metadata: Metadata = { title: "How it works · GhostQ" };

const STEPS = [
  { title: "Your sound", body: "Qloo finds the artist and their genres. A small act Qloo doesn't know yet goes through your own words instead, matched to genres by semantic search." },
  { title: "Your crowd", body: "The city and age band set the crowd. Qloo returns the themes that crowd over-indexes on (Love, Heartbreak, Self Discovery…), its styles and its local scene." },
  { title: "Their world", body: "The films and books that crowd loves, and your fans' lifestyles, give the lyrics concrete images." },
  { title: "The agent chooses", body: "Claude decides which Qloo call to make next from what it has found, then picks the signals the song will rest on." },
  { title: "The song, with receipts", body: "The writer cites a signal on every line. Code checks every citation is real and no real artist is named, and sends a draft back once if it breaks a rule." },
];

export default function HowPage() {
  return (
    <div className="grid gap-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">How GhostQ works</h1>
        <p className="max-w-2xl text-muted-foreground">
          A plain AI writes for an average listener. GhostQ writes for the crowd you&apos;re actually playing to, from Qloo taste data, and shows its working.
        </p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-lg border p-4">
            <p className="font-semibold">
              {i + 1}. {s.title}
            </p>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">Qloo has no language filter, so the language comes from your brief. Taste data describes a crowd, never a person.</p>
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">Your last song vs plain AI</h2>
        <CompareView />
      </section>
    </div>
  );
}
