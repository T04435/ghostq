import { GitFork } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { describeAges, type Crowd } from "@/lib/brief";

type Remix = { id: string; title: string; crowd: Crowd; sung?: boolean; changed?: number; total?: number };

/** The DS's RemixLinks, "of" mode: the card linking a remix back to its original. */
export function RemixOfLink({ of }: { of: { id: string; title: string; crowdText: string } }) {
  return (
    <Link href={`/song/${of.id}`} className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-foreground hover:border-foreground">
      <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-muted">
        <GitFork className="size-[15px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">Remix of</span>
        <span className="text-sm font-semibold">
          {of.title} <span className="font-normal text-muted-foreground">· {of.crowdText}</span>
        </span>
      </span>
      <span className="text-xs font-semibold whitespace-nowrap">Open original</span>
    </Link>
  );
}

/** The DS's RemixLinks, list mode: "Remixes N", one row per remix (city, ages, SUNG/SHEET, lines changed), or none. */
export function RemixList({ remixes }: { remixes: Remix[] }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Remixes of this song">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="inline-flex items-baseline gap-1.5 text-[15px] font-semibold">
          Remixes <span className="pixel-square text-[15px]">{remixes.length}</span>
        </h2>
        <span className="text-xs text-muted-foreground">same song, other crowds</span>
      </div>
      {remixes.length ? (
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
          {remixes.map((r) => (
            <Link key={r.id} href={`/song/${r.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 border-b px-3.5 py-2.5 text-foreground last:border-b-0 hover:bg-muted">
              <span className="flex min-w-0 flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-semibold">{r.crowd.place?.name ?? "Worldwide"}</span>
                <span className="pixel-circle text-[13px]">{r.crowd.ages.length ? describeAges(r.crowd.ages.map((a) => a.age)) : "all ages"}</span>
              </span>
              {r.sung !== undefined ? <Badge variant={r.sung ? "signal" : "outline"}>{r.sung ? "SUNG" : "SHEET"}</Badge> : <span />}
              <span className="text-xs text-muted-foreground">
                {r.changed !== undefined && r.total !== undefined ? (
                  <span className="inline-flex items-baseline gap-1">
                    <span className="pixel-square text-[13px] text-foreground">{r.changed}</span> of {r.total} lines changed
                  </span>
                ) : (
                  r.title
                )}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-3.5 text-[13px] text-muted-foreground">No remixes yet. Remix it for another city or age below.</div>
      )}
    </section>
  );
}
