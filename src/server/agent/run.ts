import "server-only";
import { generateText, Output, ToolLoopAgent, type StopCondition } from "ai";
import { describeBrief, type Brief } from "@/lib/brief";
import { TOOL_LABELS, type RunEvent } from "@/lib/run-events";
import { signalLine } from "@/lib/signals";
import { writtenSongSchema, type SongSheet, type WrittenSong } from "@/lib/song-sheet";
import { dropUnknownIds, validateSong, type Problem } from "@/lib/validate-sheet";
import { AGENT_PROVIDER_OPTIONS, LIMITS, MODELS } from "./models";
import { createTools, RunState, type ToolOutput } from "./tools";

const AGENT_INSTRUCTIONS = `You are GhostQ's research agent. A songwriter wants an ORIGINAL song written for a specific crowd. You read that crowd's taste through Qloo tools, then choose the signals the song will be built on.

How to work:
- Decide each next call from what you have found. There's no fixed order, but cover: the act's sound (find_artist, or sound_from_words if there's no artist or Qloo doesn't know it), the crowd's themes (crowd_tags kind "theme"; it's the strongest lyric signal), and at least one source of imagery or detail (crowd_taste, fan_audiences or crowd_tags kind "style").
- If sound_alikes or fan_profile says Qloo has no taste data for the act, switch to artists_in_genres. Don't retry the same call with the same input.
- About 6–9 tool calls in total. Before each call, write one short sentence on what you'll check and why.
- Finish with ready_to_write: the signal ids the song should rest on, and its angle in one sentence.

Rules:
- Taste data describes a crowd, never a person.
- Never invent a signal. Only ids returned by tools exist.
- Qloo has no language filter: the language comes from the brief.`;

const WRITER_RULES = `Rules for the song:
- Write an ORIGINAL song in the brief's language. Don't quote, paraphrase or imitate any existing lyric, and don't name any real artist, song, film or book in a lyric.
- Artists in the signals are style references for the music and production brief only.
- Every line cites 1–3 signal ids from the list that shaped it (a theme it's about, an image drawn from a film or book's mood, a style). Use only ids from the list.
- Build the song mostly on the chosen signals. Each theme you use should be audible in the words.
- Structure: verses, a chorus that repeats, and a bridge. Concrete images, not abstractions. Singable lines.
- Chords fit the key. Melody notes are practical directions a musician can use.`;

type Emit = (event: RunEvent) => void;

export async function runGhostQ(brief: Brief, emit: Emit, abortSignal?: AbortSignal): Promise<void> {
  const started = Date.now();
  const state = new RunState(brief);
  await research(state, emit, abortSignal);
  if (state.signals.all().length === 0) {
    emit({ type: "error", message: "Qloo returned no taste data for this brief, so there's nothing to write from. Try another artist, other words, or another city." });
    return;
  }
  const sheet = await write(state, emit, abortSignal);
  emit({ type: "sheet", sheet });
  emit({ type: "done", qlooCalls: state.qlooCalls, qlooCached: state.qlooCached, seconds: Math.round((Date.now() - started) / 1000) });
}

async function research(state: RunState, emit: Emit, abortSignal?: AbortSignal): Promise<void> {
  const tools = createTools(state);
  type Tools = typeof tools;
  const chosen: StopCondition<Tools> = () => state.chosen !== null;
  const outOfSteps: StopCondition<Tools> = ({ steps }) => steps.length >= LIMITS.maxSteps;
  const agent = new ToolLoopAgent({
    model: MODELS.agent,
    instructions: AGENT_INSTRUCTIONS,
    tools,
    stopWhen: [chosen, outOfSteps],
    maxOutputTokens: LIMITS.maxOutputTokensPerStep,
    providerOptions: AGENT_PROVIDER_OPTIONS,
    prepareStep: ({ stepNumber }) => (stepNumber >= LIMITS.maxSteps - 1 ? { activeTools: ["ready_to_write"] } : {}),
  });
  const result = await agent.stream({
    prompt: `${describeBrief(state.brief)}\nResearch this crowd and choose the signals for the song.`,
    abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.agentTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
  });
  // Notes stream as whole blocks: the reasoning summary and the sentence before each call.
  const buffers = new Map<string, string>();
  const flush = (key: string) => {
    const text = buffers.get(key)?.trim();
    buffers.delete(key);
    if (text) emit({ type: "note", text });
  };
  for await (const part of result.fullStream) {
    switch (part.type) {
      case "reasoning-start":
      case "text-start":
        buffers.set(part.id, "");
        break;
      case "reasoning-delta":
      case "text-delta":
        if (buffers.has(part.id)) buffers.set(part.id, buffers.get(part.id)! + part.text);
        break;
      case "reasoning-end":
      case "text-end":
        flush(part.id);
        break;
      case "tool-call":
        if (part.invalid) break;
        for (const key of [...buffers.keys()]) flush(key);
        emit({ type: "step-start", id: part.toolCallId, tool: part.toolName, label: TOOL_LABELS[part.toolName] ?? part.toolName, input: part.input });
        break;
      case "tool-result": {
        const out = part.output as ToolOutput;
        emit({ type: "step-end", id: part.toolCallId, ok: out.ok, summary: out.summary, signals: out.signals, raw: out.raw ?? null });
        break;
      }
      case "tool-error": {
        const message = part.error instanceof Error ? part.error.message : String(part.error);
        emit({ type: "step-end", id: part.toolCallId, ok: false, summary: message.slice(0, 300), signals: [], raw: null });
        break;
      }
    }
  }
}

function writerPrompt(state: RunState, previous?: { song: WrittenSong; problems: Problem[] }): string {
  const all = state.signals.all();
  const chosenIds = new Set(state.chosen?.signalIds ?? all.map((s) => s.id));
  const chosen = all.filter((s) => chosenIds.has(s.id));
  const other = all.filter((s) => !chosenIds.has(s.id));
  return [
    describeBrief(state.brief),
    state.chosen ? `The research agent's angle: ${state.chosen.angle}` : "",
    "",
    "Chosen Qloo signals (build the song on these):",
    ...chosen.map(signalLine),
    other.length ? "\nOther signals you may cite:" : "",
    ...other.map(signalLine),
    "",
    WRITER_RULES,
    previous
      ? `\nYour previous draft broke these rules. Fix every one and return the whole song again:\n${previous.problems.map((p) => `- ${p.where}: ${p.issue}`).join("\n")}\n\nPrevious draft:\n${JSON.stringify(previous.song)}`
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

async function write(state: RunState, emit: Emit, abortSignal?: AbortSignal): Promise<SongSheet> {
  emit({ type: "writing", signalCount: state.chosen?.signalIds.length ?? state.signals.all().length });
  const signals = state.signals.all();
  const ask = async (prompt: string) =>
    (
      await generateText({
        model: MODELS.writer,
        output: Output.object({ schema: writtenSongSchema }),
        prompt,
        maxOutputTokens: LIMITS.writerMaxOutputTokens,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.writerTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output;
  let song = await ask(writerPrompt(state));
  let problems = validateSong(song, signals, [...state.artistNames]);
  if (problems.length) {
    emit({ type: "note", text: `The draft broke ${problems.length} receipt rule${problems.length === 1 ? "" : "s"}, so it goes back for one repair.` });
    song = await ask(writerPrompt(state, { song, problems }));
  }
  song = dropUnknownIds(song, signals);
  problems = validateSong(song, signals, [...state.artistNames]);
  const cited = new Set(song.sections.flatMap((s) => s.lines.flatMap((l) => l.signalIds)));
  return {
    ...song,
    language: state.brief.language,
    // Only what the page needs: the cited signals plus the chosen ones.
    signals: signals.filter((s) => cited.has(s.id) || state.chosen?.signalIds.includes(s.id)),
    warnings: problems.map((p) => `${p.where}: ${p.issue}`),
  };
}
