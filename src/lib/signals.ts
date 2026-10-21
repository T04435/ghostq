/** A piece of Qloo taste data the song may cite. Ids are short ("T3") so the writer can quote them. */
export type SignalKind = "theme" | "style" | "genre" | "artist" | "movie" | "book" | "audience" | "crowd" | "home";

export type Signal = {
  id: string;
  kind: SignalKind;
  label: string;
  /** The Qloo call it came from, in plain words. */
  source: string;
  /** Affinity, score or skew from Qloo, 0–1 or signed; null when Qloo gives none. */
  value: number | null;
};

const PREFIX: Record<SignalKind, string> = {
  theme: "T",
  style: "S",
  genre: "G",
  artist: "A",
  movie: "M",
  book: "B",
  audience: "H",
  crowd: "C",
  home: "O",
};

/** Collects signals across tool calls. One per kind and label: a repeat keeps the first id. */
export class SignalRegistry {
  private readonly byId = new Map<string, Signal>();
  private readonly byKey = new Map<string, string>();
  private readonly counts = new Map<SignalKind, number>();

  add(kind: SignalKind, label: string, source: string, value: number | null): Signal {
    const key = `${kind}:${label.toLowerCase()}`;
    const existing = this.byKey.get(key);
    if (existing) return this.byId.get(existing)!;
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const signal: Signal = { id: `${PREFIX[kind]}${n}`, kind, label, source, value: value === null ? null : Math.round(value * 100) / 100 };
    this.byId.set(signal.id, signal);
    this.byKey.set(key, signal.id);
    return signal;
  }

  get(id: string): Signal | undefined {
    return this.byId.get(id);
  }

  all(): Signal[] {
    return [...this.byId.values()];
  }
}

/** One line for the writer's prompt. */
export function signalLine(s: Signal): string {
  return `${s.id} [${s.kind}] ${s.label}${s.value !== null ? ` (${s.value})` : ""}, from ${s.source}`;
}
