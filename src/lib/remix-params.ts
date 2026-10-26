import type { Remix } from "@/lib/brief";

/** RemixQ picks as the query string /remix/<id> reads (and validates): ?place=<json>&ages=a,b. */
export function remixParams(r: Omit<Remix, "of">): string {
  const q = new URLSearchParams();
  if (r.place) q.set("place", JSON.stringify(r.place));
  if (r.ages) q.set("ages", r.ages.join(","));
  return q.toString();
}
