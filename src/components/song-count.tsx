import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

/** The DS's SongCount: a live count of songs as an outline pill linking to the Library. `n` undefined = loading. */
export function SongCount({ n }: { n?: number }) {
  return (
    <Link
      href="/library"
      className="inline-flex items-center gap-2.5 self-start rounded-full border bg-card py-2 pr-3.5 pl-3 text-sm text-foreground hover:border-foreground"
    >
      <span className="inline-flex items-center gap-[5px] font-mono text-[10px] tracking-[.06em] text-muted-foreground">
        <span aria-hidden className="size-[7px] rounded-full bg-foreground" />
        LIVE
      </span>
      {n === undefined ? <Skeleton className="h-4 w-11" /> : <span className="pixel-square text-lg leading-none">{n.toLocaleString("en-US")}</span>}
      <span className="font-medium">songs written by GhostQ</span>
      <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
