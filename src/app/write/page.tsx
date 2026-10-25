import type { Metadata } from "next";
import { Suspense } from "react";
import { GhostQApp } from "@/components/ghostq-app";
import { RecentSongs, RecentSongsSkeleton } from "@/components/recent-songs";

export const metadata: Metadata = {
  title: "Write · GhostQ",
  description: "Name an artist. GhostQ reads their crowd from Qloo and writes an original song for it, with a receipt on every line.",
};

// The DS strip: one column on a phone, else as many 280 px columns as fit.
const STRIP = "sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]";

/** Write: the brief, the live run and the finished song. The Library strip and the budget examples stream in. */
export default function WritePage() {
  return (
    <GhostQApp
      recent={
        <Suspense fallback={<RecentSongsSkeleton count={3} className={STRIP} />}>
          <RecentSongs limit={6} className={STRIP} />
        </Suspense>
      }
      examples={
        <Suspense fallback={<RecentSongsSkeleton count={3} />}>
          <RecentSongs limit={3} />
        </Suspense>
      }
    />
  );
}
