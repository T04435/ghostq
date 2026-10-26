import { ArrowRight, Blend, GitFork, MicAudioLines, Pause } from "lucide-react";
import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { ReceiptChip, SideMark } from "@/components/brand/receipt";
import { PlaySongButton } from "@/components/play-song-button";
import { HowItWorks } from "@/components/how-it-works";
import { RecentSongs, RecentSongsSkeleton } from "@/components/recent-songs";
import { SongCount } from "@/components/song-count";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AGE_BANDS } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { changedLines } from "@/lib/remix";
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

/** The Landing: hero, CollabQ, RemixQ, the QPlayer and Sing Along, the Songbook preview, the closing CTA and How it works (#how) last. */
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
            {/* Plays the example song in the QPlayer (no page change); the Songbook link is in the nav. */}
            <Suspense fallback={null}>
              <HearOne />
            </Suspense>
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

      {/* The three things a finished song can do next, each shown on a real song from the Library (the user, 26 Oct). */}
      <Feature
        label="CollabQ"
        icon={<Blend aria-hidden />}
        title="Artist A feat. Artist B. One song, two crowds."
        body="Verse 1 is written for A’s crowd and verse 2 for B’s, each in its artist’s language. The chorus is built on what both crowds share, from Qloo’s compare, and sung by both leads."
        cta={{ href: "/write", label: "Write a feat." }}
      >
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <CollabExample />
        </Suspense>
      </Feature>
      <Feature
        label="RemixQ"
        icon={<GitFork aria-hidden />}
        title="The same song, for another crowd."
        body="Pick a new city, new ages, or both. GhostQ reads the new crowd from Qloo and rewrites the verses and bridge for it. The title, key, tempo, sections and hook stay, and every changed line is marked."
        cta={{ href: "/library", label: "Pick a song to remix" }}
        flip
      >
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <RemixExample />
        </Suspense>
      </Feature>
      <Feature
        label="QPlayer · Sing Along"
        icon={<MicAudioLines aria-hidden />}
        title="Press play. Follow every word."
        body="Sung songs play in the QPlayer across the whole site. The sheet follows the recording word by word, with the chord being played, and the receipts behind the line you hear. Open it full screen and sing along."
      >
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <SingAlongExample />
        </Suspense>
      </Feature>

      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-(--page-x) py-18">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[clamp(26px,3vw,36px)] leading-[1.05] font-semibold tracking-[-0.035em]">Open a finished one first</h2>
          <Link href="/library" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Whole Songbook
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

      <HowItWorks />
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



/** A feature band: its name, a heading and a line on the left; a live example from the Library on the right. */
function Feature({ label, icon, title, body, cta, flip = false, children }: { label: string; icon: React.ReactNode; title: string; body: string; cta?: { href: string; label: string }; flip?: boolean; children: React.ReactNode }) {
  return (
    <section className="mx-auto grid w-full max-w-[1200px] items-center gap-8 border-t px-(--page-x) py-14 desk:grid-cols-2 desk:gap-14 sm:py-18">
      <div className={cn("flex max-w-[520px] flex-col gap-3.5", flip && "desk:order-2")}>
        <FeatureLabel icon={icon}>{label}</FeatureLabel>
        <h2 className="text-[clamp(28px,3.4vw,44px)] leading-none font-semibold tracking-[-0.04em] text-pretty">{title}</h2>
        <p className="text-base leading-normal text-pretty text-muted-foreground">{body}</p>
        {cta && (
          <Button variant="secondary" asChild className="self-start">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </section>
  );
}

const crowdText = (c: { place?: { name: string } | null; ages: { age: keyof typeof AGE_BANDS }[] }) => `${c.place?.name ?? "Worldwide"} ${c.ages[0] ? AGE_BANDS[c.ages[0].age] : "all ages"}`;

/** CollabQ on a real feat. song: which crowd each part is written for, and receipts both crowds share. */
async function CollabExample() {
  const summary = (await allSongs()).find((s) => s.featuring && !s.remixOf);
  const song = summary ? await getSong(summary.id) : null;
  const sheet = song?.sheet;
  if (!sheet?.featuring) return <p className="text-sm text-muted-foreground">The first CollabQ song will show here.</p>;
  const shared = sheet.signals.filter((s) => s.side === "shared").slice(0, 3);
  const rows: { side: "A" | "B" | "shared"; part: string; who: string }[] = [
    { side: "A", part: "Verse 1", who: `${sheet.artist}’s crowd · ${crowdText(sheet.crowd)}` },
    { side: "B", part: "Verse 2", who: `${sheet.featuring.artist}’s crowd · ${crowdText(sheet.featuring.crowd)}` },
    { side: "shared", part: "Chorus", who: "what both crowds share" },
  ];
  return (
    <Link href={`/song/${song!.id}`} className={cn(card, "gap-4 hover:border-foreground")}>
      <SongTitle title={sheet.title} artist={`${sheet.artist} feat. ${sheet.featuring.artist}`} />
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.part} className="grid grid-cols-[14px_72px_minmax(0,1fr)] items-center gap-2.5 border-t py-2.5 text-sm">
            <SideMark side={r.side} color="var(--foreground)" />
            <span className="font-semibold">{r.part}</span>
            <span className="truncate text-muted-foreground">{r.who}</span>
          </div>
        ))}
      </div>
      {shared.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shared.map((s) => (
            <ReceiptChip key={s.id} signal={s} showLabel />
          ))}
        </div>
      )}
      <span className="text-[11px] leading-[1.4] text-muted-foreground">{draftLabel(sheet.artist, sheet.featuring.artist)}</span>
    </Link>
  );
}

/** RemixQ on a real remix: the crowd it moved from and to, one line before and after, and how much changed. */
async function RemixExample() {
  const summary = (await allSongs()).find((s) => s.remixOf);
  const remix = summary ? await getSong(summary.id) : null;
  const original = remix?.sheet.remixOf ? await getSong(remix.sheet.remixOf.id) : null;
  if (!remix || !original) return <p className="text-sm text-muted-foreground">The first remix will show here.</p>;
  const changed = changedLines(original.sheet, remix.sheet);
  const total = remix.sheet.sections.reduce((n, s) => n + s.lines.length, 0);
  const first = [...changed][0]?.split(":").map(Number);
  const before = first ? original.sheet.sections[first[0]]?.lines[first[1]]?.text : undefined;
  const after = first ? remix.sheet.sections[first[0]]?.lines[first[1]]?.text : undefined;
  return (
    <Link href={`/song/${remix.id}`} className={cn(card, "gap-4 hover:border-foreground")}>
      <SongTitle title={remix.sheet.title} artist={remix.sheet.artist} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-baseline gap-[5px] rounded-full bg-muted px-[9px] py-[3px] whitespace-nowrap">{crowdText(original.sheet.crowd)}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="inline-flex items-baseline gap-[5px] rounded-full bg-foreground px-[9px] py-[3px] whitespace-nowrap text-background">{crowdText(remix.sheet.crowd)}</span>
      </div>
      {before && after && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <span className="text-[15px] leading-[1.35] text-muted-foreground line-through decoration-1">{before}</span>
          <span className="flex flex-wrap items-baseline gap-2 text-[17px] leading-[1.35] font-medium">
            {after}
            <span className="rounded-full border border-foreground px-1.5 py-0.5 font-mono text-[9px] tracking-[.06em]">CHANGED</span>
          </span>
        </div>
      )}
      <span className="inline-flex items-baseline gap-[5px] text-xs text-muted-foreground">
        <span className="pixel-square text-sm text-foreground">{changed.size}</span> of <span className="pixel-square text-sm text-foreground">{total}</span> lines rewritten for the new crowd
      </span>
    </Link>
  );
}

/** The QPlayer and Sing Along on the example song: the bar, a line lighting up word by word, and a real Play. */
async function SingAlongExample() {
  const song = await exampleSong();
  if (!song?.audio) return null;
  const { sheet } = song;
  const section = sheet.sections.find((s) => /chorus|coro|estribillo|refr/i.test(s.name)) ?? sheet.sections[0];
  const words = (section.lines[0]?.text ?? "").split(/\s+/).filter(Boolean);
  const lit = Math.max(1, Math.ceil(words.length * 0.4));
  return (
    <div className={cn(card, "gap-5 overflow-hidden p-0")}>
      <div className="flex h-12 items-center gap-3 bg-[oklch(0.2_0.012_250)] px-4 text-[oklch(0.96_0.003_250)]" aria-hidden>
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-signal text-[oklch(0.18_0.03_115)]">
          <Pause className="size-[13px] fill-current" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 leading-[1.15]">
          <SongTitle size="sm" title={sheet.title} artist={sheet.artist} truncate className="[&>span:last-child]:text-current [&>span:last-child]:opacity-75" />
          <span className="truncate text-xs">
            <span className="rounded-[3px] bg-signal text-signal-foreground shadow-[0_0_0_2px_var(--signal)]">{words.slice(0, lit).join(" ")}</span> {words.slice(lit).join(" ")}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-3 px-5">
        <span className="pixel-grid text-xl tracking-[.02em] uppercase">{section.name}</span>
        <p className="flex flex-wrap gap-x-[.28em] gap-y-1 pixel-circle text-[clamp(22px,2.4vw,30px)] leading-[1.25]">
          {words.map((w, i) => (
            <span key={i} className={cn("rounded-[4px]", i < lit && "bg-signal text-signal-foreground shadow-[0_0_0_3px_var(--signal)]")}>
              {w}
            </span>
          ))}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <span className="text-xs text-muted-foreground">{draftLabel(sheet.artist)}</span>
        <PlaySongButton song={{ id: song.id, title: sheet.title, artist: sheet.artist, audioVersion: song.audio.createdAt }} />
      </div>
    </div>
  );
}

/** "Hear one from the Songbook": the example song in the QPlayer, right here. */
async function HearOne() {
  const song = await exampleSong();
  if (!song?.audio) return null;
  return <PlaySongButton variant="secondary" label="Hear one from the Songbook" song={{ id: song.id, title: song.sheet.title, artist: song.sheet.artist, audioVersion: song.audio.createdAt }} />;
}

/** A feature's name as a graphite pill with its icon, readable at a glance (the user, 26 Oct). */
function FeatureLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 self-start rounded-full bg-foreground py-1.5 pr-3.5 pl-2.5 text-[13px] font-semibold text-background [&_svg]:size-4">
      {icon}
      {children}
    </span>
  );
}
