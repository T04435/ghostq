/** A piece of Qloo taste data the song may cite. Ids are short ("T3") so the writer can quote them. */
export type SignalKind = "theme" | "style" | "genre" | "artist" | "movie" | "book" | "audience" | "crowd" | "home" | "voice";

export type Signal = {
  id: string;
  kind: SignalKind;
  label: string;
  /** The Qloo call it came from, in plain words. */
  source: string;
  /** Affinity, score or skew from Qloo, 0–1 or signed; null when Qloo gives none. */
  value: number | null;
  /** CollabQ: which artist's crowd it came from, or "shared" when both crowds have it. Solo songs have none. */
  side?: Side;
};

export type Side = "A" | "B" | "shared";

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
  voice: "V",
};

/** Collects signals across tool calls. One per kind and label: a repeat keeps the first id. */
export class SignalRegistry {
  private readonly byId = new Map<string, Signal>();
  private readonly byKey = new Map<string, string>();
  private readonly counts = new Map<SignalKind, number>();

  add(kind: SignalKind, label: string, source: string, value: number | null, side?: Side): Signal {
    const key = `${kind}:${label.toLowerCase()}`;
    const existing = this.byKey.get(key);
    if (existing) {
      // Found for both artists' crowds: it's what they share.
      const s = this.byId.get(existing)!;
      if (side && s.side && s.side !== side) s.side = "shared";
      return s;
    }
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const signal: Signal = { id: `${PREFIX[kind]}${n}`, kind, label, source, value: value === null ? null : Math.round(value * 100) / 100, ...(side ? { side } : {}) };
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
  const side = s.side ? ` {${s.side === "shared" ? "shared" : `artist ${s.side}`}}` : "";
  return `${s.id} [${s.kind}]${side} ${s.label}${s.value !== null ? ` (${s.value})` : ""}, from ${s.source}`;
}
