import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { KIND_ORDER, ReceiptChip } from "@/components/brand/receipt";
import { RecentSongs, RecentSongsSkeleton } from "@/components/recent-songs";
import { SongCount } from "@/components/song-count";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AGE_BANDS } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { getSong, listSongs } from "@/server/store/songs";
import { SongTitle } from "@/components/song-title";

export const metadata: Metadata = {
  title: "GhostQ · write the song a crowd is already waiting for",
  description: "Name an artist. GhostQ reads their crowd from Qloo, learns what it loves, and writes an original song with a receipt on every line. Then it sings it.",
};

/** Every song the Library lists, read once per request. */
const allSongs = cache(() => listSongs());

/**
 * The Landing's real example: a pinned, sung song (Lorde's "Last Light on the Shore Road", the one the demos use; the
 * user, 22 Oct: no Cuban act on demo screens), else the newest sung solo song in the Library.
 */
const EXAMPLE_SONG_ID = "angrczhmel";
const exampleSong = cache(async () => {
  const pinned = await getSong(EXAMPLE_SONG_ID);
  if (pinned?.audio) return pinned;
  const songs = await allSongs();
  const pick = songs.find((s) => s.sung && !s.featuring && !s.remixOf) ?? songs.find((s) => !s.featuring) ?? songs[0];
  return pick ? getSong(pick.id) : null;
});

const card = "flex flex-col gap-3 rounded-lg border bg-card p-5";

/** The Landing: hero, the three steps, CollabQ, the Library preview and the closing CTA. */
export default function LandingPage() {
  return (
    <>
      <section className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-(--page-x) pt-12 pb-14 sm:py-24 desk:grid-cols-[1.1fr_1fr] desk:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-signal px-2.5 py-[5px] font-mono text-[11px] tracking-[.06em] text-signal-foreground">
            <span aria-hidden className="size-[7px] rounded-full bg-signal-foreground" />
            BUILT ON QLOO TASTE DATA
          </span>
          <h1 className="text-[clamp(40px,6.5vw,88px)] leading-[0.95] font-semibold tracking-[-0.05em] text-pretty">Write the song a crowd is already waiting for.</h1>
          <p className="max-w-[520px] text-[clamp(16px,1.4vw,20px)] leading-[1.45] text-pretty text-muted-foreground">
            Name an artist. GhostQ reads their crowd, learns what it loves, and writes an original song with a receipt on every line. Then it sings it.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="lg" asChild>
              <Link href="/write">Write a song</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/library">
                <Play className="fill-current" aria-hidden />
                Hear one from the Library
              </Link>
            </Button>
          </div>
          <span className="text-[13px] text-muted-foreground">No sign-up. About a minute. Every song is public, with its research.</span>
          <Suspense fallback={<SongCount />}>
            <LiveCount />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Suspense fallback={<Skeleton className="h-[260px] rounded-lg" />}>
            <HeroSong />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-(--page-x) pb-18">
        <h2 className="max-w-[600px] text-[clamp(26px,3vw,36px)] leading-[1.05] font-semibold tracking-[-0.035em]">One name in. A crowd, a song and the reasons out.</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          <Suspense fallback={<Skeleton className="h-44 rounded-lg" />}>
            <CrowdStep />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-44 rounded-lg" />}>
            <WorldStep />
          </Suspense>
          <div className={card}>
            <span className="font-mono text-[11px] text-muted-foreground">03 · THE SONG</span>
            <div className="flex items-center gap-2.5" aria-hidden>
              <span className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-foreground text-card">
                <Play className="size-3.5 fill-current" />
              </span>
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-[3px] bg-muted">
                <span className="absolute inset-y-0 left-0 w-[35%] rounded-[3px] bg-foreground" />
              </span>
              <span className="pixel-square text-sm">2:00</span>
            </div>
            <p className="text-[13px] leading-normal text-muted-foreground">
              A full song sheet with chords, melody and a production brief. Optionally sung and produced by Google Lyria, labelled and watermarked.
            </p>
          </div>
        </div>
      </section>

      {/* CollabQ: a fixed graphite band in both themes, as the DS draws it. */}
      <section className="bg-[oklch(0.15_0.01_250)] px-(--page-x) py-12 text-[oklch(0.95_0.004_250)] sm:py-18">
        <div className="mx-auto grid max-w-[calc(1200px-2*var(--page-x))] items-center gap-8 desk:grid-cols-2">
          <div className="flex max-w-[520px] flex-col gap-3.5">
            <span className="font-mono text-[11px] tracking-[.06em] text-signal">COLLABQ</span>
            <h2 className="text-[clamp(28px,3.4vw,44px)] leading-none font-semibold tracking-[-0.04em]">Artist A feat. Artist B. One song, two crowds.</h2>
            <p className="text-base leading-normal opacity-75">
              Verse 1 is written for A’s crowd and verse 2 for B’s, each in its artist’s language. The chorus is built on what both crowds share, from Qloo’s compare, and sung by
              both leads.
            </p>
          </div>
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="flex flex-col items-center gap-2.5">
              <svg width="224" height="144" viewBox="-2 -2 224 144" fill="none" aria-hidden>
                <path d="M110 12.6 A70 70 0 0 0 110 127.4 A70 70 0 0 0 110 12.6 Z" fill="var(--signal)" />
                <circle cx="70" cy="70" r="70" stroke="currentColor" strokeWidth="2" opacity=".6" />
                <circle cx="150" cy="70" r="70" stroke="currentColor" strokeWidth="2" opacity=".6" />
              </svg>
              <span className="font-mono text-[11px] opacity-70">A’s crowd · what both share · B’s crowd</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-(--page-x) py-18">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[clamp(26px,3vw,36px)] leading-[1.05] font-semibold tracking-[-0.035em]">Open a finished one first</h2>
          <Link href="/library" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Whole Library
          </Link>
        </div>
        <Suspense fallback={<RecentSongsSkeleton count={4} className={PREVIEW} />}>
          <RecentSongs limit={4} className={PREVIEW} />
        </Suspense>
        <p className="max-w-[560px] text-[13px] leading-normal text-muted-foreground">
          Every song anyone writes is public, with its crowd and research. Each is labelled as an AI-generated GhostQ draft, not affiliated with the artist it was written for.
        </p>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-(--page-x) pb-22">
        <div className="flex flex-col items-start gap-5 border-t pt-14">
          <Logo size={56} />
          <h2 className="max-w-[700px] text-[clamp(30px,4vw,56px)] leading-none font-semibold tracking-[-0.045em] text-pretty">Who is this song for? Now you can answer.</h2>
          <Button size="lg" asChild>
            <Link href="/write">Write a song</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

const PREVIEW = "sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]";

/** The live count: every song the Library lists. */
async function LiveCount() {
  return <SongCount n={(await allSongs()).length} />;
}

/** The hero card: two chorus lines of a real song, chords over lyrics, with their receipts. */
async function HeroSong() {
  const song = await exampleSong();
  if (!song) return null;
  const { sheet } = song;
  const section = sheet.sections.find((s) => /chorus|coro|estribillo|refr|후렴|サビ/i.test(s.name)) ?? sheet.sections[0];
  const byId = new Map(sheet.signals.map((s) => [s.id, s]));
  return (
    <>
      <Link href={`/song/${song.id}`} className="flex flex-col gap-3.5 rounded-lg border bg-card p-5 text-foreground shadow-[0_24px_60px_rgba(0,0,0,.08)] hover:border-foreground">
        <SongTitle title={sheet.title} artist={sheet.featuring ? `${sheet.artist} feat. ${sheet.featuring.artist}` : sheet.artist} />
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold tracking-[.05em] text-card uppercase">{section.name}</span>
          <span className="pixel-grid text-base whitespace-nowrap">
            {sheet.key} · {sheet.tempo}
          </span>
        </div>
        {section.lines.slice(0, 2).map((line, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="grid grid-cols-4 gap-1 font-mono text-xs font-medium">
              {line.chords
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 4)
                .map((c, j) => (
                  <span key={j}>
                    <span className="rounded-md bg-muted px-1.5 py-0.5">{c}</span>
                  </span>
                ))}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2.5">
              <span className="text-lg leading-[1.35] font-medium">{line.text}</span>
              <span className="flex flex-wrap gap-1">
                {line.signalIds.slice(0, 2).map((id) => {
                  const s = byId.get(id);
                  return s ? <ReceiptChip key={id} signal={s} showLabel /> : null;
                })}
              </span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2.5 border-t pt-3 text-xs text-muted-foreground">
          <span aria-hidden className="size-2 flex-none rounded-full border-[1.5px] border-foreground bg-signal" />
          Crowd: {sheet.crowd.place?.name ?? "worldwide"}
          {sheet.crowd.ages[0] ? `, ${AGE_BANDS[sheet.crowd.ages[0].age]}` : ""} · from Qloo · {sheet.signals.length} signals
        </div>
      </Link>
      <span className="px-1 text-xs text-muted-foreground">
        A {draftLabel(sheet.artist)}. Lyrics are original.
      </span>
    </>
  );
}

/** 01 · The crowd, from the example song: its city with Qloo's rank, and its strongest age band. */
async function CrowdStep() {
  const song = await exampleSong();
  const crowd = song?.sheet.crowd;
  const age = crowd?.ages[0];
  return (
    <div className={card}>
      <span className="font-mono text-[11px] text-muted-foreground">01 · THE CROWD</span>
      {crowd?.place && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">{crowd.place.name}</span>
          {crowd.placeRank && (
            <span className="pixel-circle text-[15px] text-muted-foreground">
              #{crowd.placeRank.rank.toLocaleString("en-US")} of {crowd.placeRank.of.toLocaleString("en-US")} areas
            </span>
          )}
        </div>
      )}
      {age && age.skew !== null && (
        <div className="grid grid-cols-[minmax(52px,max-content)_1fr_54px] items-center gap-2 text-xs">
          <span className="pixel-circle text-sm whitespace-nowrap">{AGE_BANDS[age.age]}</span>
          <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-muted">
            <span className="absolute inset-y-0 left-0 rounded-[3px] bg-signal" style={{ width: `${Math.min(100, Math.round((Math.abs(age.skew) / 0.35) * 100))}%` }} />
          </span>
          <span className="text-right pixel-circle text-sm">
            {age.skew >= 0 ? "+" : ""}
            {age.skew}
          </span>
        </div>
      )}
      <p className="text-[13px] leading-normal text-muted-foreground">Qloo tells us where an artist’s fans’ taste is strongest, and how old they skew. Shown as a result, never asked as a form.</p>
    </div>
  );
}

/** 02 · Their world: four of the example song's receipts, one per kind where it can. */
async function WorldStep() {
  const song = await exampleSong();
  const signals = song?.sheet.signals ?? [];
  const picks = KIND_ORDER.filter((k) => k !== "crowd" && k !== "home" && k !== "voice")
    .map((k) => signals.find((s) => s.kind === k))
    .filter((s) => s !== undefined)
    .slice(0, 4);
  return (
    <div className={card}>
      <span className="font-mono text-[11px] text-muted-foreground">02 · THEIR WORLD</span>
      <div className="flex flex-wrap gap-1">
        {picks.map((s) => (
          <ReceiptChip key={s.id} signal={s} showLabel />
        ))}
      </div>
      <p className="text-[13px] leading-normal text-muted-foreground">An agent reads what the crowd loves across music, film, books and lifestyle. Each step shows live, with its source.</p>
    </div>
  );
}
