import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedSong } from "@/components/saved-song";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { getSong, publicSong } from "@/server/store/songs";

export async function generateMetadata({ params }: PageProps<"/song/[id]">): Promise<Metadata> {
  const song = await getSong((await params).id);
  if (!song) return { title: "GhostQ" };
  const title = `${song.sheet.title} · GhostQ`;
  const description = `${draftLabel(song.sheet.artist)}. Written for ${song.sheet.artist}'s crowd: ${describeCrowd(song.sheet.crowd)}.`;
  return { title, description, openGraph: { title, description, type: "music.song", siteName: "GhostQ" }, twitter: { card: "summary", title, description } };
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
  const saved = await getSong(id);
  if (!saved) notFound();
  // Only what the page shows reaches the browser: no raw Qloo responses in the page payload.
  const song = publicSong(saved);
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
