import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryList } from "@/components/library-list";
import { Skeleton } from "@/components/ui/skeleton";
import { cookies } from "next/headers";
import { DEVICE_COOKIE } from "@/lib/device";
import { deviceFromCookie } from "@/server/limits";
import { listSongs } from "@/server/store/songs";

export const metadata: Metadata = { title: "Songbook · GhostQ", description: "Every song written with GhostQ, each with the Qloo research behind it." };

/** The Library: every song, newest first, with search and filters. The songs are read per request and stream in. */
export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-(--page-x) pt-10 pb-18">
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(30px,4vw,44px)] leading-none font-semibold tracking-[-0.04em]">Songbook</h1>
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
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the Songbook">
      <Skeleton className="h-11 rounded-full" />
      <Skeleton className="h-[88px] rounded-lg" />
      <Skeleton className="h-[88px] rounded-lg" />
      <Skeleton className="h-[88px] rounded-lg" />
    </div>
  );
}

async function Songs() {
  // The songs this browser wrote are marked as yours (its device cookie, hashed, against each song's owner).
  const viewer = deviceFromCookie((await cookies()).get(DEVICE_COOKIE)?.value);
  return <LibraryList songs={await listSongs(200, viewer)} />;
}
