import { describe, expect, it } from "vitest";
import { alignLyrics } from "@/lib/lyric-align";
import { timingFromSung } from "@/lib/song-timing";

// The first verse of "Last Light on the Shore Road" and what Whisper heard (26 Oct), with its closing junk segment.
const lines = [
  "Up at six, the footpath's still cool, I run the hill to see the harbour turn",
  "Pōhutukawa dropping red on the bonnet of the car you won't be taking",
  "Takapuna sky going peach, then pink, then something I can't name",
  "Your flat in Eden Terrace is boxes, and the jug's the only thing still plugged in",
];
const heard = [
  { start: 9.26, end: 14.56, text: "Up at six, the footpath's still cool, I run the hill to see the harbor turn" },
  { start: 14.56, end: 19.08, text: "Prout to court, droppin' red on the bonnet of the car you won't be takin'" },
  { start: 20.0, end: 23.94, text: "Takafuna sky goin' peach then pink, that's somethin' I can't name" },
  { start: 24.26, end: 29.44, text: "Your flat needin' terraces, boxes, and the jugs, the only thing still plugged in" },
  { start: 121.84, end: 122.0, text: "Thanks for watching!" },
];

describe("alignLyrics", () => {
  const sung = alignLyrics(lines, heard, 122.04);
  it("times every line from the words Whisper heard, despite mishearings", () => {
    expect(sung.lines.map((l) => l && Math.round(l.start))).toEqual([9, 15, 20, 24]);
    sung.lines.forEach((l) => expect(l!.end).toBeGreaterThan(l!.start));
    expect(sung.lines[3]!.end).toBeLessThan(30);
  });
  it("trims a line whose segment swallowed the intro", () => {
    const early = alignLyrics(lines, [{ ...heard[0], start: 0 }, ...heard.slice(1)], 122.04);
    expect(early.lines[0]!.start).toBeGreaterThan(7);
  });
  it("drops junk the singer never sang", () => {
    expect(Math.max(...sung.lines.map((l) => l!.end))).toBeLessThan(30);
  });
  it("leaves an unheard line null and the timeline fills it between its neighbours", () => {
    const missing = alignLyrics([...lines.slice(0, 2), "zzz qqq xxx www vvv", lines[3]], heard, 122.04);
    expect(missing.lines[2]).toBeNull();
    const timing = timingFromSung({ sections: [{ name: "Verse 1", melody: "", lines: [0, 1, 2, 3].map(() => ({ text: "x", chords: "", signalIds: [] })) }] }, missing);
    expect(timing.lines[2].start).toBeGreaterThanOrEqual(timing.lines[1].end - 1e-9);
    expect(timing.lines[2].end).toBeLessThanOrEqual(timing.lines[3].start + 1e-9);
    expect(timing.sections.map((s) => s.name)).toEqual(["Intro", "Verse 1", "Outro"]);
  });
});
