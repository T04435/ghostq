import { ImageResponse } from "next/og";
import { describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { songArtist } from "@/lib/song-sheet";
import { getSong } from "@/server/store/songs";

export const alt = "A GhostQ song";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The brand's graphite, its light ink and the lime signal, in hex (the image renderer takes no oklch).
const GRAPHITE = "#1f2329";
const INK = "#eef0f2";
const MUTED = "#a3a9b2";
const LIME = "#dbec36";

/** The 3×3 crowd mark (logo.tsx), drawn for the image: lime centre and tail. */
function Mark({ size: s }: { size: number }) {
  const gap = Math.round(s * 0.11);
  const cell = (s - 2 * gap) / 3;
  const dot = (i: number) =>
    i === 8 ? (
      <div key={i} style={{ width: cell, height: cell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: cell, height: cell * 1.6, borderRadius: cell / 2, background: LIME, transform: "rotate(-45deg)" }} />
      </div>
    ) : (
      <div key={i} style={{ width: cell, height: cell, borderRadius: cell, background: i === 4 ? LIME : INK }} />
    );
  // Three explicit rows: the image renderer doesn't wrap a flex grid reliably.
  return (
    <div style={{ display: "flex", flexDirection: "column", width: s, height: s, gap }}>
      {[0, 1, 2].map((r) => (
        <div key={r} style={{ display: "flex", gap }}>
          {[0, 1, 2].map((c) => dot(r * 3 + c))}
        </div>
      ))}
    </div>
  );
}

/**
 * F4: the preview a pasted song link shows: the title, the credit, the crowd it was written for and the draft label
 * (required on every song), on the brand's graphite with the crowd mark.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const song = await getSong((await params).id);
  const sheet = song?.sheet;
  const crowd = sheet ? (sheet.featuring ? `For ${sheet.artist}'s and ${sheet.featuring.artist}'s crowds` : `For ${sheet.artist}'s crowd: ${describeCrowd(sheet.crowd)}`) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: GRAPHITE, color: INK, padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark size={56} />
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.04em" }}>GhostQ</div>
          {song?.audio && (
            <div style={{ marginLeft: "auto", display: "flex", padding: "8px 18px", borderRadius: 999, background: LIME, color: GRAPHITE, fontSize: 24, fontWeight: 600 }}>SUNG</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: sheet && sheet.title.length > 32 ? 64 : 80, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>{sheet?.title ?? "A song for the crowd"}</div>
          {sheet && <div style={{ fontSize: 36, fontWeight: 600 }}>{songArtist(sheet)}</div>}
          {crowd && <div style={{ fontSize: 28, color: MUTED }}>{crowd}</div>}
        </div>
        <div style={{ fontSize: 22, color: MUTED }}>{sheet ? draftLabel(sheet.artist, sheet.featuring?.artist) : "AI ghostwriting on Qloo taste data"}</div>
      </div>
    ),
    size,
  );
}
