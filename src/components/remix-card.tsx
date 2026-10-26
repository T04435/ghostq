"use client";

import { useRouter } from "next/navigation";
import { RemixForm } from "@/components/remix-form";
import { remixParams } from "@/lib/remix-params";
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
