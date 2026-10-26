import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedSong } from "@/components/saved-song";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { songArtist } from "@/lib/song-sheet";
import { getSong, publicSong, remixesOf } from "@/server/store/songs";
import { possessive } from "@/lib/possessive";

export async function generateMetadata({ params }: PageProps<"/song/[id]">): Promise<Metadata> {
  const song = await getSong((await params).id);
  if (!song) return { title: "GhostQ" };
  const title = `${song.sheet.title} (${songArtist(song.sheet)}) · GhostQ`;
  const { sheet } = song;
  const crowds = sheet.featuring ? `${possessive(sheet.artist)} and ${possessive(sheet.featuring.artist)} crowds` : `${possessive(sheet.artist)} crowd: ${describeCrowd(sheet.crowd)}`;
  const description = `${draftLabel(sheet.artist, sheet.featuring?.artist)}. ${sheet.remixOf ? `A RemixQ of "${sheet.remixOf.title}" for` : "Written for"} ${crowds}.`;
  return { title, description, openGraph: { title, description, type: "music.song", siteName: "GhostQ" }, twitter: { card: "summary_large_image", title, description } };
}

/** A shared song: read-only, no login. The song is read per request, so it streams in behind a placeholder. */
export default function SongPage({ params }: PageProps<"/song/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1200px] px-(--page-x) pt-7 pb-18">
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
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
  // RemixQ: a remix shows next to its original; any song lists its remixes.
  const [original, remixes] = await Promise.all([song.sheet.remixOf ? getSong(song.sheet.remixOf.id) : null, remixesOf(id)]);
  return (
    <SavedSong
      sheet={{ ...song.sheet, id }}
      original={original ? { ...original.sheet, id: original.id } : undefined}
      remixes={remixes}
      research={song.research}
      audioUrl={song.audio ? `/api/songs/${id}/audio?v=${encodeURIComponent(song.audio.createdAt)}` : undefined}
      timing={song.audio?.timing ?? null}
    />
  );
}
