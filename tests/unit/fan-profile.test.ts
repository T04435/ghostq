import { describe, expect, it } from "vitest";
import { describeAges } from "@/lib/brief";
import { bestPlace, topAgeBands } from "@/lib/fan-profile";

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

describe("bestPlace", () => {
  it("picks the listed city in the strongest cell", () => {
    // Geohash 3 cells from the 21 Oct probe for Teenage Joans: r1f Adelaide, r7h Brisbane, r1r Melbourne, gcp London.
    const cells = [
      { geohash: "r1f", affinity: 1 },
      { geohash: "r7h", affinity: 0.992 },
      { geohash: "r1r", affinity: 0.989 },
      { geohash: "gcp", affinity: 0.745 },
      { geohash: "zzz", affinity: 0.5 },
    ];
    expect(bestPlace(cells)).toEqual({ place: "adelaide", affinity: 1, rank: 1, of: 5 });
    expect(bestPlace(cells.slice(1))).toEqual({ place: "brisbane", affinity: 0.99, rank: 1, of: 4 });
  });

  it("is null with no cells", () => {
    expect(bestPlace([])).toBeNull();
  });
});

describe("describeAges", () => {
  it("lists bands in Qloo's order", () => {
    expect(describeAges(["30_to_34", "25_to_29"])).toBe("25–29 and 30–34");
    expect(describeAges(["25_to_29"])).toBe("25–29");
  });
});
