import { describe, expect, it } from "vitest";
import { describeAges } from "@/lib/brief";
import { hotspots, rankCells, topAgeBands } from "@/lib/fan-profile";

describe("topAgeBands", () => {
  it("keeps up to three bands over the threshold, strongest first", () => {
    const demo = { age: { "24_and_younger": 0.17, "25_to_29": 0.27, "30_to_34": 0.21, "35_to_44": 0.03, "55_and_older": -0.54 }, gender: {} };
    expect(topAgeBands(demo)).toEqual([
      { age: "25_to_29", skew: 0.27 },
      { age: "30_to_34", skew: 0.21 },
      { age: "24_and_younger", skew: 0.17 },
    ]);
  });

  it("drops bands under the threshold, even inside the top three", () => {
    const demo = { age: { "25_to_29": 0.3, "30_to_34": 0.05, "35_to_44": 0.02 }, gender: {} };
    expect(topAgeBands(demo)).toEqual([{ age: "25_to_29", skew: 0.3 }]);
  });

  it("is empty without fan data or without a skew over the threshold", () => {
    expect(topAgeBands(null)).toEqual([]);
    expect(topAgeBands({ age: { "25_to_29": 0.05 }, gender: {} })).toEqual([]);
  });
});

describe("hotspots", () => {
  it("takes the most popular of the top cells by affinity, keeping each cell's rank", () => {
    // Los Aldeanos, 22 Oct: #1 by affinity was over the Pacific with little activity; Bogotá was #3 and the most popular.
    const cells = [
      { geohash: "99z", affinity: 1, popularity: 0.247 },
      { geohash: "d20", affinity: 0.9999, popularity: 0.958 },
      { geohash: "d2g", affinity: 0.999, popularity: 0.999 },
      { geohash: "dhj", affinity: 0.944, popularity: 0.99 },
    ];
    const picked = hotspots(cells, 3);
    expect(picked.map((c) => [c.geohash, c.rank])).toEqual([
      ["d2g", 3],
      ["d20", 2],
      ["99z", 1],
    ]);
  });
});

describe("rankCells", () => {
  it("orders cells strongest first with their rank and the total", () => {
    const ranked = rankCells([
      { geohash: "69y", affinity: 0.96 },
      { geohash: "d2g", affinity: 0.999 },
      { geohash: "dhj", affinity: 0.944 },
    ]);
    expect(ranked.map((c) => [c.geohash, c.rank, c.of])).toEqual([
      ["d2g", 1, 3],
      ["69y", 2, 3],
      ["dhj", 3, 3],
    ]);
  });
});

describe("describeAges", () => {
  it("lists bands in Qloo's order", () => {
    expect(describeAges(["30_to_34", "25_to_29"])).toBe("25–29 and 30–34");
    expect(describeAges(["25_to_29"])).toBe("25–29");
  });
});
