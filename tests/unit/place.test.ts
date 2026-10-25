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

  it("falls back to English when unknown or not one Lyria sings", () => {
    expect(languageFor(null)).toBe("English");
    expect(languageFor("IT")).toBe("English");
  });

  it("writes in Japanese, Korean and Hindi too", () => {
    expect(languageFor("JP")).toBe("Japanese");
    expect(languageFor("KR")).toBe("Korean");
    expect(languageFor("IN")).toBe("Hindi");
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

describe("countryFromDescription (Qloo first for home)", () => {
  it("reads the country from Qloo's description, by name or demonym", async () => {
    const { countryFromDescription } = await import("@/lib/place");
    expect(countryFromDescription("Lorde is a New Zealand singer-songwriter known for…")).toEqual({ country: "New Zealand", countryCode: "NZ" });
    expect(countryFromDescription("BTS is a South Korean boy band formed in Seoul.")).toMatchObject({ countryCode: "KR" });
    expect(countryFromDescription("Los Aldeanos are a Cuban hip hop duo.")).toMatchObject({ countryCode: "CU" });
    expect(countryFromDescription("The xx are an English indie pop band.")).toMatchObject({ countryCode: "GB" });
    expect(countryFromDescription("A band that plays loud.")).toBeNull();
    expect(countryFromDescription(null)).toBeNull();
  });
});

describe("languagesFromTags (the artist's own tags)", () => {
  it("reads the language the tags point to", async () => {
    const { languagesFromTags, countryCodeFor } = await import("@/lib/place");
    expect(languagesFromTags(["cuban", "cuba", "son cubano", "Afro-Cuban", "Latin Urban"])).toEqual(["Spanish"]);
    expect(languagesFromTags(["K-Pop", "Dance Pop"])).toEqual(["Korean"]);
    expect(languagesFromTags(["Indie Pop", "Art Pop"])).toEqual([]);
    expect(countryCodeFor("cuba")).toBe("CU");
  });
});

describe("countryFromDescription, description starting with the country", () => {
  it("reads 'American rapper…'", async () => {
    const { countryFromDescription } = await import("@/lib/place");
    expect(countryFromDescription("American rapper, songwriter, and record producer known for his complex lyrics")).toMatchObject({ countryCode: "US" });
    expect(countryFromDescription("Collaborative music duo known for blending rap")).toBeNull();
  });
});
