import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CrowdCard } from "@/components/crowd-card";
import { GhostQApp } from "@/components/ghostq-app";
import { RecentSongs, RecentSongsSkeleton } from "@/components/recent-songs";
import { RemixList } from "@/components/remix-links";
import { SongCard } from "@/components/song-card";
import { Skeleton } from "@/components/ui/skeleton";
import { remixSchema, type Remix as RemixPicks } from "@/lib/brief";
import { getSong, remixesOf, topReceipts } from "@/server/store/songs";

export const metadata: Metadata = { title: "RemixQ · GhostQ", description: "Rewrite a GhostQ song for another crowd: a new city, new ages, or both." };

/** RemixQ: the same song for another crowd. The original is read per request, so it streams in behind a placeholder. */
export default function RemixPage({ params, searchParams }: PageProps<"/remix/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1200px] px-(--page-x) pt-7 pb-18">
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <Remix params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Picks made on the song page (?place=<json>&ages=a,b): validated here, then the remix starts on its own. */
function picksFrom(q: Record<string, string | string[] | undefined>): Omit<RemixPicks, "of"> | undefined {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  let place: unknown;
  try {
    place = one(q.place) ? JSON.parse(one(q.place)!) : undefined;
  } catch {
    return undefined;
  }
  const ages = one(q.ages)?.split(",").filter(Boolean);
  const parsed = remixSchema.safeParse({ of: "placeholder", ...(place ? { place } : {}), ...(ages?.length ? { ages } : {}) });
  if (!parsed.success) return undefined;
  const { place: p, ages: a } = parsed.data;
  return { ...(p ? { place: p } : {}), ...(a ? { ages: a } : {}) };
}

async function Remix({ params, searchParams }: { params: PageProps<"/remix/[id]">["params"]; searchParams: PageProps<"/remix/[id]">["searchParams"] }) {
  const [saved, start] = await Promise.all([params.then((p) => getSong(p.id)), searchParams.then(picksFrom)]);
  if (!saved) notFound();
  if (saved.sheet.featuring) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-(--page-x) pt-7 pb-18">
        <p className="text-sm text-muted-foreground">
          CollabQ songs can&apos;t be remixed yet.{" "}
          <Link href={`/song/${saved.id}`} className="underline">
            Back to the song
          </Link>
        </p>
      </div>
    );
  }
  const { sheet } = saved;
  const remixes = await remixesOf(saved.id);
  // Only the sheet reaches the browser (no brief answers, no raw Qloo data); the server reads the rest by id.
  return (
    <GhostQApp
      remixOf={{ ...sheet, id: saved.id }}
      start={start}
      original={
        <>
          <SongCard
            song={{ id: saved.id, title: sheet.title, artist: sheet.artist, featuring: null, remixOf: sheet.remixOf?.title ?? null, crowd: sheet.crowd, language: sheet.language, sung: Boolean(saved.audio), audioVersion: saved.audio?.createdAt ?? null, key: sheet.key, tempo: sheet.tempo, receiptCount: sheet.signals.length, receipts: topReceipts(sheet) }}
          />
          <CrowdCard artist={sheet.artist} crowd={sheet.crowd} />
          <RemixList remixes={remixes} />
        </>
      }
      examples={
        <Suspense fallback={<RecentSongsSkeleton count={3} />}>
          <RecentSongs limit={3} />
        </Suspense>
      }
    />
  );
}
