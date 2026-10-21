import { describe, expect, it } from "vitest";
import { geohash, geohashBounds, geohashPolygon } from "@/lib/geohash";

describe("geohash", () => {
  it("matches the cells Qloo returned", () => {
    expect(geohash(-34.9285, 138.6007, 3)).toBe("r1f"); // Adelaide
    expect(geohash(-37.8136, 144.9631, 3)).toBe("r1r"); // Melbourne
    expect(geohash(51.5072, -0.1276, 3)).toBe("gcp"); // London
  });
});

describe("geohashBounds", () => {
  it("decodes the square a cell covers", () => {
    const b = geohashBounds("d2g");
    expect(b.south).toBeCloseTo(4.21875, 4);
    expect(b.north).toBeCloseTo(5.625, 4);
    expect(b.west).toBeCloseTo(-74.53125, 4);
    expect(b.east).toBeCloseTo(-73.125, 4);
    // Bogotá falls inside it.
    expect(geohash(4.71, -74.07, 3)).toBe("d2g");
    expect(geohashPolygon("d2g")).toMatch(/^POLYGON\(\(-74\.53125 4\.21875,/);
  });
});
