import { describe, expect, it, vi } from "vitest";
import { draftLabel } from "@/lib/draft-label";
import { publicEvent, type RunEvent } from "@/lib/run-events";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ providerStatus: () => ({ database: false }), env: {} }));
const { publicSong } = await import("@/server/store/songs");

const research: RunEvent[] = [
  { type: "step-start", id: "s1", tool: "crowd_tags", label: "What this crowd cares about", input: {} },
  { type: "step-end", id: "s1", ok: true, summary: "T1 Love", signals: [{ id: "T1", kind: "theme", label: "Love", source: "Qloo", value: 0.8 }], raw: { results: { tags: ["a", "b"] } } },
];

describe("public responses", () => {
  it("drop Qloo's raw response but keep the summary, labels and scores", () => {
    const end = publicEvent(research[1]) as Extract<RunEvent, { type: "step-end" }>;
    expect("raw" in end).toBe(false);
    expect(end.summary).toBe("T1 Love");
    expect(end.signals[0]).toMatchObject({ label: "Love", value: 0.8 });
  });

  it("publicSong carries no raw data, no moderation fields and no brief answers", () => {
    const song = publicSong({
      id: "abcdef1234",
      createdAt: "2026-10-23T00:00:00Z",
      brief: { artist: "Lorde", story: "s", answers: { ages: ["25_to_29"] } },
      sheet: {} as never,
      research,
      audio: null,
      hidden: false,
      singBlocks: 1,
    });
    expect(JSON.stringify(song)).not.toContain("results");
    expect(song).not.toHaveProperty("hidden");
    expect(song).not.toHaveProperty("singBlocks");
    expect(song.brief).toEqual({ artist: "Lorde", story: "s" });
  });

  it("labels every song as an AI draft, not the artist's", () => {
    expect(draftLabel("Lorde")).toBe("GhostQ draft for Lorde, AI-generated, not affiliated with Lorde");
  });
});
