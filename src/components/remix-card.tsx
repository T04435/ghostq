"use client";

import { useRouter } from "next/navigation";
import { RemixForm } from "@/components/remix-form";
import type { Remix } from "@/lib/brief";
import type { SongSheet } from "@/lib/song-sheet";

/** RemixQ on a song's page: pick the new crowd here, and the remix runs on /remix/<id> with those picks. */
export function RemixCard({ sheet }: { sheet: SongSheet }) {
  const router = useRouter();
  if (!sheet.id || sheet.featuring) return null;
  return (
    <RemixForm
      original={sheet}
      busy={false}
      onSubmit={(r) => router.push(`/remix/${sheet.id}?${remixParams(r)}`)}
    />
  );
}

/** The picks as a query string the remix page reads (and validates) to start the run. */
export function remixParams(r: Omit<Remix, "of">): string {
  const q = new URLSearchParams();
  if (r.place) q.set("place", JSON.stringify(r.place));
  if (r.ages) q.set("ages", r.ages.join(","));
  return q.toString();
}
