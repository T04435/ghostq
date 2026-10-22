import type { Signal } from "./signals";

const IDS = String.raw`[A-Z]\d+(?:\s*(?:,|and|or|&)\s*[A-Z]\d+)*`;
const POINTER = String.raw`(?:in the (?:style|vein|spirit|manner|mould|mold) of|reminiscent of|nodding to|echoing|à la|a la|like)`;
/** Phrases that point at artist ids ("in the style of A10 and A7"): they go with the ids. */
const ARTIST_PHRASE = new RegExp(String.raw`\s*,?\s*\b${POINTER}\s+(?:A\d+(?:\s*(?:,|and|or|&)\s*A\d+)*)`, "gi");

/**
 * The writer's text with its signal ids turned into words a music model or a reader can use: "(G4, S1)" becomes
 * "(Indie, Minimalist Indie Pop)" and a bare "T3" becomes "Introspection". Artist ids are removed, with the phrase
 * that points at them, because a real artist's name never goes to Lyria (and GhostQ never imitates one). Ids that
 * aren't signals (a note such as "A4" in some other sense) are left alone. Replaced the 21 Oct stripSignalIds, which
 * deleted every id and so dropped the genre the research had found (bug report, 23 Oct).
 */
export function namesForIds(text: string, signals: Signal[]): string {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const isArtist = (id: string) => byId.get(id)?.kind === "artist";
  const name = (id: string) => byId.get(id)?.label.trim() ?? id;
  return text
    .replace(ARTIST_PHRASE, (m) => (m.match(/A\d+/g) ?? []).every((id) => byId.has(id) ? isArtist(id) : true) ? "" : m)
    .replace(new RegExp(String.raw`[([]\s*(${IDS})\s*[)\]]`, "g"), (m, list: string, offset: number, all: string) => {
      const ids = list.split(/\s*(?:,|and|or|&)\s*/).filter(Boolean);
      if (!ids.every((id) => byId.has(id))) return m;
      // "Minimalist indie pop (S1)" already says S1's name: don't repeat it in brackets.
      const before = all.slice(Math.max(0, offset - 60), offset).toLowerCase();
      const names = ids.filter((id) => !isArtist(id)).map(name).filter((n) => !before.includes(n.toLowerCase()));
      return names.length ? `(${names.join(", ")})` : "";
    })
    .replace(/\b[A-Z]\d+\b/g, (id) => (byId.has(id) ? (isArtist(id) ? "" : name(id)) : id))
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/,\s*(?=[.;:])/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Real artist names in text bound for Lyria: removed, since the model refuses them and GhostQ never imitates anyone. */
export function withoutArtistNames(text: string, names: string[]): string {
  let out = text;
  for (const n of names.map((x) => x.trim()).filter((x) => x.length >= 3)) {
    const name = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(String.raw`(?:\s*,?\s*\b${POINTER}\s+)?${name}`, "gi"), "");
  }
  return out.replace(/\s+([,.;:)])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

/** Every signal id the text cites. */
export function idsIn(text: string): string[] {
  return text.match(/\b[A-Z]\d+\b/g) ?? [];
}
