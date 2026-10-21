import "server-only";
import { generateText, Output, ToolLoopAgent, type StopCondition } from "ai";
import { AGE_BANDS, describeBrief, describeCrowd, PLACES, type AskField, type Brief } from "@/lib/brief";
import { pickArtist } from "@/lib/qloo-parse";
import { TOOL_LABELS, type RunEvent } from "@/lib/run-events";
import { signalLine } from "@/lib/signals";
import { writtenSongSchema, type SongSheet, type WrittenSong } from "@/lib/song-sheet";
import { dropUnknownIds, validateSong, type Problem } from "@/lib/validate-sheet";
import { AGENT_PROVIDER_OPTIONS, LIMITS, MODELS } from "./models";
import { readCrowd } from "@/server/crowd";
import { matchVoice } from "@/server/musicbrainz";
import { newSongId, saveSong } from "@/server/store/songs";
import type { VoiceMatch } from "@/lib/voice";
import { genresFromWords, searchArtist } from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";
import { createTools, RunState, type ToolOutput } from "./tools";

const AGENT_INSTRUCTIONS = `You are GhostQ's research agent. A songwriter wants an ORIGINAL song written for a specific crowd. You read that crowd's taste through Qloo tools, then choose the signals the song will be built on.

How to work:
- The artist and their crowd (city, age bands, language) are already read from Qloo and given in the prompt. Don't ask for them again.
- Decide each next call from what you have found. There's no fixed order, but cover: the act's sound (sound_alikes, or artists_in_genres; sound_from_words if the artist's genre tags are thin), the crowd's themes (crowd_tags kind "theme"; it's the strongest lyric signal), and at least one source of imagery or detail (crowd_taste, fan_audiences or crowd_tags kind "style").
- If sound_alikes says Qloo has no taste data for the act, switch to artists_in_genres. Don't retry the same call with the same input.
- About 6–9 tool calls in total. Before each call, write one short sentence on what you'll check and why.
- Finish with ready_to_write: the signal ids the song should rest on, and its angle in one sentence.

Rules:
- Taste data describes a crowd, never a person.
- Never invent a signal. Only ids returned by tools exist.
- Qloo has no language filter: the language is the one given in the prompt.`;

const WRITER_RULES = `Rules for the song:
- Write an ORIGINAL song in the language given above. Don't quote, paraphrase or imitate any existing lyric, and don't name any real artist, song, film or book in a lyric.
- Artists in the signals are style references for the music and production brief only.
- Films and books in the signals set the mood and the kind of images only. Never use their titles, their characters, their settings or their plots, and never retell a famous scene (a song drawing on a film about four sisters must not mention four sisters).
- Every line cites 1–3 signal ids from the list that shaped it (a theme it's about, an image drawn from a film or book's mood, a style). Use only ids from the list.
- Build the song mostly on the chosen signals. Each theme you use should be audible in the words.
- Structure: verses, a chorus that repeats, and a bridge. Concrete images, not abstractions. Singable lines.
- Chords fit the key. Melody notes are practical directions a musician can use.`;

type Emit = (event: RunEvent) => void;

export async function runGhostQ(brief: Brief, send: Emit, abortSignal?: AbortSignal): Promise<void> {
  const started = Date.now();
  // Every research event is kept with the saved song, so its page can replay how it was made.
  const log: RunEvent[] = [];
  const emit: Emit = (event) => {
    if (event.type === "note" || event.type === "step-start" || event.type === "step-end" || event.type === "crowd") log.push(event);
    send(event);
  };
  const state = new RunState(brief);
  if (!(await readArtistAndCrowd(state, emit))) return;
  // The voice match (MusicBrainz, 1 to 4 calls at 1 a second) runs while the agent researches.
  const voice: Promise<VoiceMatch> = matchVoice(state.act?.musicbrainzId ?? null);
  await research(state, emit, abortSignal);
  if (state.signals.all().length === 0) {
    emit({ type: "error", message: "Qloo returned no taste data for this artist, so there's nothing to write from. Try another artist." });
    return;
  }
  const id = newSongId();
  const sheet: SongSheet = { ...(await write(state, emit, abortSignal)), voice: await voice, id };
  // Saved for the share link; a failed save keeps the song on the page, just without a link.
  await saveSong({ id, brief, sheet, research: log, createdAt: new Date().toISOString(), audio: null }).catch((e) => {
    console.error("save song failed", e instanceof Error ? e.message : e);
    delete sheet.id;
  });
  emit({ type: "sheet", sheet });
  emit({ type: "done", qlooCalls: state.qlooCalls, qlooCached: state.qlooCached, seconds: Math.round((Date.now() - started) / 1000) });
}

/**
 * Before the agent: find the artist on Qloo (pinned by the Spotify pick) and read their crowd from Qloo's data on
 * their fans. Both are fixed steps, not agent choices, because everything after depends on them.
 */
async function readArtistAndCrowd(state: RunState, emit: Emit): Promise<boolean> {
  const { brief } = state;
  const answers = brief.answers;
  const missing: AskField[] = [];
  emit({ type: "step-start", id: "find-artist", tool: "find_artist", label: TOOL_LABELS.find_artist, input: { name: brief.artist, spotifyId: brief.spotifyId ?? null } });
  try {
    const match = pickArtist(await searchArtist(brief.artist, state.onCall), brief.artist, brief.spotifyId);
    if (match) {
      state.act = match;
      state.artistNames.add(match.name);
      const genres = match.tags.filter((t) => t.type.startsWith("urn:tag:genre")).slice(0, 6);
      state.genreTagIds = genres.map((g) => g.id);
      const signals = genres.map((g) => state.signals.add("genre", g.name, `Qloo search: ${match.name}'s tags`, null));
      const pinned = brief.spotifyId && match.spotifyIds.includes(brief.spotifyId) ? " (matched by Spotify id)" : "";
      const listed = [...new Map(signals.map((g) => [g.id, g])).values()].map((g) => `${g.id} ${g.label}`).join(", ");
      emit({ type: "step-end", id: "find-artist", ok: true, summary: `Found ${match.name}${pinned}. Genres: ${listed || "none listed"}.`, signals, raw: { name: match.name, popularity: match.popularity, tags: match.tags } });
    } else if (answers?.sound) {
      // Qloo doesn't know the act: its sound in the user's words becomes Qloo genres (semantic tag search).
      const tags = (await genresFromWords(answers.sound, state.onCall)).slice(0, 6);
      state.genreTagIds = tags.map((t) => t.id);
      const signals = tags.map((t) => state.signals.add("genre", t.name, `Qloo tag search: your words "${answers.sound}"`, t.popularity));
      const listed = signals.map((g) => `${g.id} ${g.label}`).join(", ");
      emit({ type: "step-end", id: "find-artist", ok: tags.length > 0, summary: `Qloo doesn't know ${brief.artist}, so their sound comes from your words. Genres: ${listed || "none matched"}.`, signals, raw: tags });
    } else {
      missing.push("sound");
      emit({ type: "step-end", id: "find-artist", ok: false, summary: `Qloo doesn't know ${brief.artist} yet.`, signals: [], raw: null });
    }

    const artistName = state.act?.name ?? brief.artist;
    emit({ type: "step-start", id: "read-crowd", tool: "read_crowd", label: TOOL_LABELS.read_crowd, input: { artist: artistName } });
    const { crowd, missing: crowdMissing } = await readCrowd(state.act, answers, state.onCall);
    missing.push(...crowdMissing);
    if (missing.length) {
      // Stop and ask: the page shows the question inline and sends the brief again with the answers.
      const gaps = crowdMissing.map((f) => (f === "place" ? "where the fans are" : "how old the fans are")).join(" or ");
      emit({ type: "step-end", id: "read-crowd", ok: false, summary: gaps ? `Qloo has no data on ${gaps}.` : "Waiting for the artist's sound first.", signals: [], raw: crowd });
      emit({ type: "ask", fields: missing, artist: artistName, message: askMessage(artistName, missing) });
      return false;
    }
    state.crowdInfo = crowd;
    const crowdSignals = [
      ...(crowd.place ? [state.signals.add("crowd", `Crowd around ${PLACES[crowd.place].name}`, crowd.from.place === "qloo" ? `Qloo insights: ${artistName}'s fans (world heatmap)` : "Your answer", null)] : []),
      ...crowd.ages.map((a) => state.signals.add("crowd", `Crowd aged ${AGE_BANDS[a.age]}`, crowd.from.ages === "qloo" ? `Qloo insights: ${artistName}'s fans (demographics)` : "Your answer", a.skew)),
    ];
    const yours = [crowd.from.place === "you" && "the city", crowd.from.ages === "you" && "the ages"].filter(Boolean).join(" and ");
    emit({ type: "step-end", id: "read-crowd", ok: true, summary: `Writing for ${describeCrowd(crowd)}, in ${crowd.language}.${yours ? ` Qloo had no data on ${yours}, so those are your answers.` : ""}`, signals: crowdSignals, raw: crowd });
    emit({ type: "crowd", artist: artistName, crowd });
    return true;
  } catch (error) {
    if (error instanceof QlooError) {
      emit({ type: "error", message: `Couldn't reach Qloo: ${error.message}. Try again in a minute.` });
      return false;
    }
    throw error;
  }
}

function askMessage(artist: string, fields: AskField[]): string {
  const parts = fields.map((f) => ({ sound: `describe ${artist}'s sound in a few words`, place: "pick the city of the crowd you're writing for", ages: "pick up to three age bands" })[f]);
  const lead = fields.includes("sound") ? `Qloo doesn't know ${artist} yet.` : `Qloo has no data on part of ${artist}'s crowd.`;
  return `${lead} To carry on, ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.`;
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
    prompt: `${describeBrief(state.brief, state.crowdInfo!)}\nQloo match: ${state.act?.name ?? `none; their sound in the user's words: "${state.brief.answers?.sound ?? ""}"`}. Genre signals so far: ${state.signals.all().filter((x) => x.kind === "genre").map(signalLine).join("; ") || "none"}.\nResearch this crowd and choose the signals for the song.`,
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
    describeBrief(state.brief, state.crowdInfo!),
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

async function write(state: RunState, emit: Emit, abortSignal?: AbortSignal): Promise<Omit<SongSheet, "voice">> {
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
    artist: state.act?.name ?? state.brief.artist,
    crowd: state.crowdInfo!,
    language: state.crowdInfo!.language,
    // Only what the page needs: the cited signals plus the chosen ones.
    signals: signals.filter((s) => cited.has(s.id) || state.chosen?.signalIds.includes(s.id)),
    warnings: problems.map((p) => `${p.where}: ${p.issue}`),
  };
}
