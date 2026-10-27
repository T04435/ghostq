import { signalLine, type Signal } from "@/lib/signals";

/** One finished research call, as the resumed agent is told about it. */
export type DoneCall = { tool: string; input: unknown };

/**
 * The research agent's prompt addition when its first try was cut off (the model service didn't answer): what already
 * ran and what it found, so the second try carries on from there instead of starting over.
 */
export function resumeBrief(calls: DoneCall[], found: Signal[]): string {
  const ran = calls.map((c) => `${c.tool} ${JSON.stringify(c.input ?? {})}`).join("; ") || "none";
  return `\nYour research was cut off (the model service stopped answering) and is picking up where it stopped. Calls that already ran (don't repeat them): ${ran}.\nSignals found so far:\n${found.map(signalLine).join("\n") || "none"}\nResearch only what's still missing, then choose the signals for the song.`;
}
