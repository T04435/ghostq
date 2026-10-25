import { Minus } from "lucide-react";
import { FromQloo, SideMark } from "@/components/brand/receipt";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AGE_BANDS, describeHome, normalizeCrowd, type Crowd } from "@/lib/brief";
import { describePlace } from "@/lib/place";
import type { Side } from "@/lib/signals";

type Shared = { ages?: string; themes: string[]; note?: string };

/**
 * The DS's CrowdCard: who the song is for (the crowd's city with its Qloo rank, the age skew bars, the language) and,
 * GhostQ's addition, as whom (the artist's home sets the voice). Lime only where the data came from Qloo. CollabQ: pass
 * `partner` for A and B side by side, and `shared` for what Qloo's compare found in both. `loading` shows skeletons.
 */
export function CrowdCard({
  artist,
  crowd,
  featured,
  partner,
  shared,
  loading,
  heading,
}: {
  artist: string;
  crowd?: Crowd;
  featured?: boolean;
  partner?: { artist: string; crowd: Crowd };
  shared?: Shared;
  loading?: boolean;
  heading?: string;
}) {
  const sides: { artist: string; crowd: Crowd; side?: Side }[] = crowd
    ? partner
      ? [
          { artist, crowd, side: "A" },
          { artist: partner.artist, crowd: partner.crowd, side: "B" },
        ]
      : [{ artist, crowd, side: featured ? "B" : undefined }]
    : [];
  const all = sides.map((s) => normalizeCrowd(s.crowd));
  const fromQloo = all.length > 0 && all.every((c) => c.from.place === "qloo" && c.from.ages === "qloo");
  const remixed = all.some((c) => c.from.place === "remix" || c.from.ages === "remix");
  return (
    <Card className="gap-3.5 p-[18px]" role="group" aria-label={`The crowd for ${artist}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{heading ?? (partner ? "Two crowds" : featured ? `Featuring ${artist}` : "The crowd")}</h3>
        {fromQloo ? (
          <FromQloo />
        ) : (
          <span className="font-mono text-[10px] tracking-[.04em] whitespace-nowrap text-muted-foreground">{remixed ? "REMIX · YOUR PICK AND QLOO" : "QLOO AND YOUR ANSWERS"}</span>
        )}
      </div>
      {loading || !crowd ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-7 w-[55%]" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-[70%]" />
        </div>
      ) : (
        <>
          <div className={partner ? "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5" : "grid gap-5"}>
            {sides.map((s, i) => (
              <CrowdSide key={s.artist} artist={s.artist} crowd={all[i]} side={s.side} labelled={Boolean(partner || featured)} />
            ))}
          </div>
          {partner && shared && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[.08em] text-muted-foreground">
                <SideMark side="shared" color="var(--foreground)" />
                WHAT THEY SHARE · QLOO COMPARE
              </span>
              <div className="flex flex-wrap gap-1.5">
                {shared.ages && <span className="rounded-full bg-signal px-2.5 py-1 pixel-circle text-sm text-signal-foreground">{shared.ages}</span>}
                {shared.themes.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                    {t}
                  </span>
                ))}
              </div>
              {shared.note && <p className="text-[13px] leading-[1.45] text-muted-foreground">{shared.note}</p>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function NoData({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[13px] leading-[1.45] text-muted-foreground">
      <Minus className="mt-0.5 size-3.5 flex-none" aria-hidden />
      <span>
        <span className="font-semibold text-foreground">{title}</span> {children}
      </span>
    </div>
  );
}

function Row({ label, value, note, muted }: { label: string; value: string; note?: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-t pt-2.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className={muted ? "text-muted-foreground" : "font-medium"}>{value}</span>
        {note && <span className="text-muted-foreground"> · {note}</span>}
      </span>
    </div>
  );
}

function CrowdSide({ artist, crowd, side, labelled }: { artist: string; crowd: Crowd; side?: Side; labelled: boolean }) {
  const qlooPlace = crowd.from.place === "qloo";
  const qlooAges = crowd.from.ages === "qloo";
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {labelled && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[.08em] text-muted-foreground">
          {side && <SideMark side={side} color="var(--foreground)" />}
          {side ? `${side} · ` : ""}
          {artist.toUpperCase()}
        </span>
      )}
      {crowd.place ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[26px] leading-none font-semibold tracking-[-0.03em]">{crowd.place.name}</span>
            {qlooPlace && crowd.placeRank && (
              <span className="pixel-circle text-sm whitespace-nowrap text-muted-foreground">
                #{crowd.placeRank.rank.toLocaleString("en-US")} of {crowd.placeRank.of.toLocaleString("en-US")} areas
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {describePlace(crowd.place)} · {crowd.from.place === "remix" ? "your pick for this remix" : crowd.from.place === "you" ? "your answer: Qloo had no location data" : "the fans' strongest area on Qloo"}
          </span>
        </div>
      ) : (
        <NoData title="Worldwide.">Qloo has no location data for these fans.</NoData>
      )}
      {crowd.ages.length > 0 ? (
        <div className="flex flex-col gap-1.5 text-xs">
          {crowd.ages.map((a) => {
            const v = Math.abs(a.skew ?? 0);
            return (
              <div key={a.age} className="grid grid-cols-[52px_1fr_54px] items-center gap-2">
                <span className="pixel-circle text-sm whitespace-nowrap">{AGE_BANDS[a.age]}</span>
                <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-muted">
                  {qlooAges && a.skew !== null && <span className="absolute inset-y-0 left-0 rounded-[3px] bg-signal" style={{ width: `${Math.min(100, Math.round((v / 0.35) * 100))}%` }} />}
                </span>
                <span className="text-right pixel-circle text-sm">{qlooAges && a.skew !== null ? `${a.skew >= 0 ? "+" : ""}${a.skew}` : ""}</span>
              </div>
            );
          })}
          {!qlooAges && <span className="text-muted-foreground">{crowd.from.ages === "remix" ? "Your pick for this remix" : "Your answer: Qloo had no age data"}</span>}
        </div>
      ) : (
        <NoData title="All ages.">Qloo has no age data for these fans.</NoData>
      )}
      <div className="flex flex-col gap-2.5">
        <Row label="Language" value={crowd.language} note={crowd.languageFrom === "home" ? "the artist's own" : "from the city"} />
        {/* GhostQ's addition (not in the DS): where the artist is from, which sets the voice. */}
        <Row
          label="Home (the voice)"
          value={crowd.home ? describeHome(crowd.home) : "no data"}
          muted={!crowd.home}
          note={crowd.home ? { qloo: "Qloo", "qloo+musicbrainz": "Qloo and MusicBrainz", musicbrainz: "MusicBrainz" }[crowd.home.source] : "neither Qloo nor MusicBrainz says"}
        />
      </div>
    </div>
  );
}
