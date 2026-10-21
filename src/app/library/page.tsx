import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryList } from "@/components/library-list";
import { Skeleton } from "@/components/ui/skeleton";
import { listSongs } from "@/server/store/songs";

export const metadata: Metadata = { title: "Library · GhostQ", description: "Every song written with GhostQ, each with the Qloo research behind it." };

export default function LibraryPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
        <p className="max-w-2xl text-muted-foreground">Every song written with GhostQ, newest first. Open one to see its crowd and the Qloo research behind every line.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Songs />
      </Suspense>
    </div>
  );
}

async function Songs() {
  return <LibraryList songs={await listSongs()} />;
}
