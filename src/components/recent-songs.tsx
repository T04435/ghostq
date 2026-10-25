import { cn } from "cn";
import { EmptyState } from "@/components/empty-state";
import { SongCard } from "@/components/song-card";
import { Skeleton } from "@/components/ui/skeleton";
import { listSongs } from "@/server/store/songs";

/**
 * The newest songs from the Library as compact song cards: the Landing's preview, Write's "Recent from the Library"
 * strip and the budget notice's examples. Read per request, so it sits behind a Suspense with RecentSongsSkeleton.
 */
export async function RecentSongs({ limit, className }: { limit: number; className?: string }) {
  const songs = await listSongs(limit);
  if (!songs.length) return <EmptyState title="No songs yet" body="The first song written here will show up for everyone. Name an artist to write it." />;
  return (
    <div className={cn("grid gap-2.5", className)}>
      {songs.map((s) => (
        <SongCard key={s.id} song={s} compact />
      ))}
    </div>
  );
}

export function RecentSongsSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid gap-2.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[110px] rounded-lg" />
      ))}
    </div>
  );
}
