import { describe, expect, it } from "vitest";
import { geohash } from "@/lib/geohash";

describe("geohash", () => {
  it("matches the cells Qloo returned", () => {
    expect(geohash(-34.9285, 138.6007, 3)).toBe("r1f"); // Adelaide
    expect(geohash(-37.8136, 144.9631, 3)).toBe("r1r"); // Melbourne
    expect(geohash(51.5072, -0.1276, 3)).toBe("gcp"); // London
  });
});
