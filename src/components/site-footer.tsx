import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { VersionBadge } from "@/components/version-badge";
import { AGENT_NAME_INLINE } from "@/lib/agent-persona";

const SOURCES: { name: string; use: string; qloo?: boolean }[] = [
  { name: "Qloo", use: "taste, crowds, compare", qloo: true },
  { name: "Spotify", use: "artist search" },
  { name: "MusicBrainz", use: "voice match" },
  { name: "Wikipedia", use: "how they sing" },
  { name: "Google Lyria", use: "singing" },
];

/** The DS footer: the data sources, the compliance line, and the version Badge centred on its own last line. */
export function SiteFooter() {
  return (
    <footer className="border-t bg-background text-xs leading-normal text-muted-foreground">
      <div className="grid gap-3.5 px-(--page-x) py-7">
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
          <span className="font-mono text-[10px] tracking-[.08em]">DATA</span>
          {SOURCES.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {s.qloo && <span aria-hidden className="size-2 rounded-full border-[1.5px] border-foreground bg-signal" />}
              <span className="font-semibold text-foreground">{s.name}</span> {s.use}
            </span>
          ))}
        </div>
        <p className="inline-flex items-center gap-1.5 text-foreground">
          <GhostMark size={GHOST_SIZES.tag} decorative />
          Written by {AGENT_NAME_INLINE} from Qloo taste data
        </p>
        <p className="max-w-[680px] text-pretty">
          Taste data from Qloo. Place names © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>. Every song is an AI-generated GhostQ
          draft, not affiliated with the artist it&apos;s written for; GhostQ never names or imitates a real artist.
        </p>
        <div className="flex justify-center pt-1.5">
          <VersionBadge />
        </div>
      </div>
    </footer>
  );
}
