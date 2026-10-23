import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GhostQApp } from "@/components/ghostq-app";
import { Skeleton } from "@/components/ui/skeleton";
import { remixSchema, type Remix as RemixPicks } from "@/lib/brief";
import { getSong } from "@/server/store/songs";

export const metadata: Metadata = { title: "RemixQ · GhostQ", description: "Rewrite a GhostQ song for another crowd: a new city, new ages, or both." };

/** RemixQ: the same song for another crowd. The original is read per request, so it streams in behind a placeholder. */
export default function RemixPage({ params, searchParams }: PageProps<"/remix/[id]">) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">RemixQ: the same song for another crowd</h1>
        <p className="max-w-2xl text-muted-foreground">
          Pick a new city or new ages. GhostQ reads that crowd from Qloo and rewrites the lines it calls for, keeping the song&apos;s structure and hook. Both versions are
          saved and linked.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Remix params={params} searchParams={searchParams} />
      </Suspense>
    </div>
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
      <p className="text-sm text-muted-foreground">
        CollabQ songs can&apos;t be remixed yet.{" "}
        <Link href={`/song/${saved.id}`} className="underline">
          Back to the song
        </Link>
      </p>
    );
  }
  // Only the sheet reaches the browser (no brief answers, no raw Qloo data); the server reads the rest by id.
  return <GhostQApp remixOf={{ ...saved.sheet, id: saved.id }} start={start} />;
}
