import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedSong } from "@/components/saved-song";
import { describeCrowd } from "@/lib/brief";
import { getSong } from "@/server/store/songs";

export async function generateMetadata({ params }: PageProps<"/song/[id]">): Promise<Metadata> {
  const song = await getSong((await params).id);
  return song ? { title: `${song.sheet.title} · GhostQ`, description: `An original song for ${song.sheet.artist}'s crowd: ${describeCrowd(song.sheet.crowd)}.` } : { title: "GhostQ" };
}

/** A shared song: read-only, no login. The song is read per request, so it streams in behind a placeholder. */
export default function SongPage({ params }: PageProps<"/song/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Song params={params} />
    </Suspense>
  );
}

async function Song({ params }: { params: PageProps<"/song/[id]">["params"] }) {
  const { id } = await params;
  const song = await getSong(id);
  if (!song) notFound();
  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Written by GhostQ for {song.sheet.artist}&apos;s crowd{song.brief.story ? `, about "${song.brief.story}"` : ""}.{" "}
        <Link href="/" className="underline">
          Write your own
        </Link>
      </p>
      <SavedSong sheet={song.sheet} research={song.research} audioUrl={song.audio ? `/api/songs/${id}/audio?v=${encodeURIComponent(song.audio.createdAt)}` : undefined} />
    </div>
  );
}
