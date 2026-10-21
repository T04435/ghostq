import { describe, expect, it } from "vitest";
import { normalizeCrowd } from "@/lib/brief";
import { countryCodeFor, describePlace, languageFor, toPlace } from "@/lib/place";

describe("languageFor", () => {
  it("gives a country's main language among the five GhostQ writes in", () => {
    expect(languageFor("CU")).toBe("Spanish");
    expect(languageFor("CO")).toBe("Spanish");
    expect(languageFor("BR")).toBe("Portuguese");
    expect(languageFor("FR")).toBe("French");
    expect(languageFor("DE")).toBe("German");
    expect(languageFor("AU")).toBe("English");
  });

  it("falls back to English when unknown or not one of the five", () => {
    expect(languageFor(null)).toBe("English");
    expect(languageFor("JP")).toBe("English");
  });
});

describe("countryCodeFor", () => {
  it("maps English country names to ISO codes, with common spellings", () => {
    expect(countryCodeFor("Cuba")).toBe("CU");
    expect(countryCodeFor("colombia")).toBe("CO");
    expect(countryCodeFor("United States of America")).toBe("US");
  });

  it("is null for names that aren't countries", () => {
    expect(countryCodeFor("Hip Hop")).toBeNull();
    expect(countryCodeFor("Rap")).toBeNull();
  });
});

describe("toPlace and normalizeCrowd", () => {
  it("reads a pre-22-Oct city id as a place", () => {
    expect(toPlace("buenos-aires")).toMatchObject({ name: "Buenos Aires", countryCode: "AR" });
    expect(toPlace("nowhere")).toBeNull();
  });

  it("fills in what older crowds lack", () => {
    const crowd = normalizeCrowd({ from: { place: "qloo", ages: "you" }, place: "melbourne", placeRank: { rank: 1, of: 9 }, ages: [{ age: "25_to_29", skew: null }], language: "English" });
    expect(crowd.place?.name).toBe("Melbourne");
    expect(crowd.home).toBeNull();
    expect(crowd.languageFrom).toBe("city");
  });

  it("describes a place once when it's a country", () => {
    expect(describePlace({ name: "Cuba", country: "Cuba" })).toBe("Cuba");
    expect(describePlace({ name: "Bogotá", country: "Colombia" })).toBe("Bogotá, Colombia");
  });
});
