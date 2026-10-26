import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { GLYPHS, isQloo } from "@/components/brand/receipt";
import { AGE_BANDS, describeCrowd } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import type { Signal } from "@/lib/signals";
import { getSong, topReceipts } from "@/server/store/songs";

export const alt = "A GhostQ song";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The brand's dark theme in hex (the image renderer takes no oklch): graphite, its chip step, the light ink, the muted
// ink and the lime signal with its ink.
const GRAPHITE = "#14171c";
const CHIP = "#2a2f37";
const INK = "#eef0f2";
const MUTED = "#a3a9b2";
const LIME = "#dbec36";
const LIME_INK = "#20240c";

/**
 * The image renderer can't switch a variable font's axes, so Geist Pixel ships here as static Circle (ELSH 20) and Grid
 * (ELSH 40) cuts, instanced from the Google Fonts file with fontTools, with static Hanken Grotesk and Red Hat Mono.
 */
const fonts = Promise.all(
  [
    ["Geist Pixel Circle", "GeistPixel-Circle.ttf", 400],
    ["Geist Pixel Grid", "GeistPixel-Grid.ttf", 400],
    ["Hanken Grotesk", "HankenGrotesk-Regular.ttf", 400],
    ["Hanken Grotesk", "HankenGrotesk-SemiBold.ttf", 600],
    ["Red Hat Mono", "RedHatMono-Regular.ttf", 400],
  ].map(async ([name, file, weight]) => ({
    name: name as string,
    data: await readFile(join(process.cwd(), "assets/og-fonts", file as string)),
    weight: weight as 400 | 600,
    style: "normal" as const,
  })),
);

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

/** The wordmark as on the site: Geist Pixel Grid with a lime copy one dot down and right behind it (the pixel-echo utility). */
function Word({ size: s }: { size: number }) {
  const off = Math.max(1, s * 0.027);
  const word = { fontFamily: "Geist Pixel Grid", fontSize: s, lineHeight: 1, letterSpacing: "0.01em" } as const;
  return (
    <div style={{ display: "flex", position: "relative" }}>
      <div style={{ ...word, position: "absolute", left: off, top: off, color: LIME }}>GhostQ</div>
      <div style={{ ...word, color: INK }}>GhostQ</div>
    </div>
  );
}

/** A receipt chip as on the Library card: the kind's glyph, the id in mono and the label; lime when Qloo's. */
function Receipt({ signal }: { signal: Signal }) {
  const q = isQloo(signal.source);
  const ink = q ? LIME_INK : INK;
  const bits = GLYPHS[signal.kind].split("");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 18px 0 14px", borderRadius: 999, background: q ? LIME : CHIP, color: ink }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, width: 18, height: 18 }}>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ display: "flex", gap: 2 }}>
            {[0, 1, 2].map((c) => (
              <div key={c} style={{ width: 4.6, height: 4.6, borderRadius: 4, background: ink, opacity: bits[r * 3 + c] === "1" ? 1 : 0.2 }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "Geist Pixel Circle", fontSize: 24 }}>{signal.id}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{signal.label.trim()}</div>
    </div>
  );
}

const chip = { display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: 999, background: CHIP, color: INK, fontSize: 22 } as const;

/**
 * F4: the preview a pasted song link shows, in the Library card's style (26 Oct): title and artist on one line in Geist
 * Pixel Circle, the crowd, a row of the song's tags and the three receipts its lines cite most, and the draft label
 * (required on every song), on the brand's graphite with the crowd mark.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const song = await getSong((await params).id);
  const sheet = song?.sheet;
  const crowd = sheet ? (sheet.featuring ? `For ${sheet.artist}'s and ${sheet.featuring.artist}'s crowds` : `For ${sheet.artist}'s crowd: ${describeCrowd(sheet.crowd)}`) : "";
  const band = sheet?.crowd.ages[0] ? AGE_BANDS[sheet.crowd.ages[0].age] : "all ages";
  const receipts = sheet ? topReceipts(sheet) : [];
  const credit = sheet ? (sheet.featuring ? `${sheet.artist} feat. ${sheet.featuring.artist}` : sheet.artist) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: GRAPHITE, color: INK, padding: "60px 72px", fontFamily: "Hanken Grotesk" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark size={52} />
          <Word size={40} />
          {sheet && (
            // The invitation, top right (the user, 26 Oct): play a sung song, or sing one that isn't sung yet.
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, height: 56, padding: "0 26px 0 10px", borderRadius: 999, background: LIME, color: LIME_INK, fontSize: 24, fontWeight: 600 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 38, background: LIME_INK }}>
                {song?.audio ? (
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M7 4.5v15l12-7.5z" fill={LIME} />
                  </svg>
                ) : (
                  // Lucide mic-audio-lines, the Sing it icon on the card and the player.
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 3v2.341" />
                    <path d="M12 17v4" />
                    <path d="M14 5v.341" />
                    <path d="M18 5v13" />
                    <path d="M2 10v3" />
                    <path d="M22 10v3" />
                    <path d="M6 6v11" />
                    <path d="M9 21h6" />
                    <rect width="4" height="8" x="10" y="9" rx="2" />
                  </svg>
                )}
              </div>
              {song?.audio ? "Play it in GhostQ" : "Sing it in GhostQ"}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 22, rowGap: 6 }}>
            <div style={{ fontFamily: "Geist Pixel Circle", fontSize: sheet && sheet.title.length > 26 ? 54 : 66, lineHeight: 1.05 }}>{sheet?.title ?? "A song for the crowd"}</div>
            {credit && <div style={{ fontFamily: "Geist Pixel Circle", fontSize: 34, color: MUTED }}>{credit}</div>}
          </div>
          {crowd && <div style={{ fontSize: 26, color: MUTED }}>{crowd}</div>}
          {sheet && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
              <div style={chip}>
                {sheet.crowd.place?.name ?? "Worldwide"}
                <div style={{ fontFamily: "Geist Pixel Circle", fontSize: 24, color: MUTED }}>{band}</div>
              </div>
              <div style={{ ...chip, fontFamily: "Red Hat Mono" }}>{sheet.language}</div>
              <div style={{ ...chip, fontFamily: "Red Hat Mono" }}>{sheet.key}</div>
              <div style={{ ...chip, fontFamily: "Red Hat Mono" }}>{sheet.tempo} BPM</div>
              {receipts.map((s) => (
                <Receipt key={s.id} signal={s} />
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 22, color: MUTED }}>{sheet ? draftLabel(sheet.artist, sheet.featuring?.artist) : "AI ghostwriting on Qloo taste data"}</div>
      </div>
    ),
    { ...size, fonts: await fonts },
  );
}
