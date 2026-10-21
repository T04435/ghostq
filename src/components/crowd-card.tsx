import { Badge } from "@/components/ui/badge";
import { AGE_BANDS, PLACES, type Crowd } from "@/lib/brief";

/** The crowd the run is writing for: read from Qloo's data on the artist's fans, or the user's answer where Qloo had none. */
export function CrowdCard({ artist, crowd }: { artist: string; crowd: Crowd }) {
  const fromQloo = crowd.from.place === "qloo" && crowd.from.ages === "qloo";
  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">The crowd GhostQ is writing for</h3>
        <Badge variant="secondary">{fromQloo ? `From Qloo: ${artist}'s fans` : `${artist}: Qloo and your answers`}</Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">City</dt>
          <dd className="font-medium">{crowd.place ? `${PLACES[crowd.place].name}, ${PLACES[crowd.place].country}` : "Worldwide"}</dd>
          <dd className="text-xs text-muted-foreground">
            {crowd.from.place === "you"
              ? "Your answer: Qloo had no location data"
              : `Fans' strongest area${crowd.placeRank ? ` (#${crowd.placeRank.rank.toLocaleString()} of ${crowd.placeRank.of.toLocaleString()})` : ""}`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Age</dt>
          <dd className="font-medium">{crowd.ages.map((a) => AGE_BANDS[a.age]).join(", ")}</dd>
          <dd className="text-xs text-muted-foreground">
            {crowd.from.ages === "you" ? "Your answer: Qloo had no age data" : `Fans skew ${crowd.ages.map((a) => (a.skew === null ? "" : `+${a.skew}`)).join(", ")}`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Language</dt>
          <dd className="font-medium">{crowd.language}</dd>
          <dd className="text-xs text-muted-foreground">From the city</dd>
        </div>
      </dl>
    </div>
  );
}
