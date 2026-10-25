import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryList } from "@/components/library-list";
import { Skeleton } from "@/components/ui/skeleton";
import { listSongs } from "@/server/store/songs";

export const metadata: Metadata = { title: "Library · GhostQ", description: "Every song written with GhostQ, each with the Qloo research behind it." };

/** The Library: every song, newest first, with search and filters. The songs are read per request and stream in. */
export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-(--page-x) pt-10 pb-18">
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(30px,4vw,44px)] leading-none font-semibold tracking-[-0.04em]">Library</h1>
        <p className="max-w-[600px] text-[15px] leading-normal text-muted-foreground">
          Every song written with GhostQ, by everyone, newest first. Each is an AI-generated draft for an artist’s crowd and opens with the research behind it. Remixes and
          CollabQ songs sit alongside.
        </p>
      </div>
      <Suspense fallback={<LibrarySkeleton />}>
        <Songs />
      </Suspense>
    </div>
  );
}

/** The DS's loading state: the search pill and three song cards. */
function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the Library">
      <Skeleton className="h-11 rounded-full" />
      <Skeleton className="h-[88px] rounded-lg" />
      <Skeleton className="h-[88px] rounded-lg" />
      <Skeleton className="h-[88px] rounded-lg" />
    </div>
  );
}

async function Songs() {
  return <LibraryList songs={await listSongs()} />;
}
