import { Badge } from "@/components/ui/badge";
import { AGE_BANDS, describeHome, normalizeCrowd, type Crowd } from "@/lib/brief";
import { describePlace } from "@/lib/place";

/** As whom (the artist's home sets the voice) and for whom (the crowd sets the themes). Read-only: it isn't an input. */
export function CrowdCard({ artist, crowd: raw }: { artist: string; crowd: Crowd }) {
  const crowd = normalizeCrowd(raw);
  const fromQloo = crowd.from.place === "qloo" && crowd.from.ages === "qloo";
  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">
          Writing as {artist}
          {crowd.home ? ` (from ${describeHome(crowd.home)})` : ""} for their fans{crowd.place ? ` around ${crowd.place.name}` : ""}
        </h3>
        <Badge variant="secondary">{fromQloo ? "From Qloo" : "Qloo and your answers"}</Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Home (the voice)</dt>
          <dd className="font-medium">{crowd.home ? describeHome(crowd.home) : "Unknown"}</dd>
          <dd className="text-xs text-muted-foreground">{crowd.home ? (crowd.home.source === "musicbrainz" ? "MusicBrainz" : "Qloo's tags for the artist") : "Neither MusicBrainz nor Qloo says"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Crowd city</dt>
          <dd className="font-medium">{crowd.place ? describePlace(crowd.place) : "Worldwide"}</dd>
          <dd className="text-xs text-muted-foreground">
            {crowd.from.place === "you"
              ? "Your answer: Qloo had no location data"
              : `Fans' strongest area on Qloo${crowd.placeRank ? ` (#${crowd.placeRank.rank.toLocaleString()} of ${crowd.placeRank.of.toLocaleString()})` : ""}`}
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
          <dd className="text-xs text-muted-foreground">{crowd.languageFrom === "home" ? "The artist's own" : "From the city"}</dd>
        </div>
      </dl>
    </div>
  );
}
