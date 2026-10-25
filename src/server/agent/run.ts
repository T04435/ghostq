import "server-only";
import { generateText, NoObjectGeneratedError, Output, ToolLoopAgent, type StopCondition } from "ai";
import { AGE_BANDS, describeBrief, describeCrowd, describeHome, type AskField, type Brief, type Crowd } from "@/lib/brief";
import { countryCodeFor, countryFromDescription, describePlace, languageFor, languagesFromTags, type Home } from "@/lib/place";
import { pickArtist, type ComparedTag } from "@/lib/qloo-parse";
import { publicEvent, TOOL_LABELS, type RunEvent } from "@/lib/run-events";
import { signalLine, type Signal } from "@/lib/signals";
import { writtenSongSchema, type SongSheet, type WrittenSong } from "@/lib/song-sheet";
import { dropUnknownIds, validateSong, type Problem } from "@/lib/validate-sheet";
import { chordProblems } from "@/lib/chords";
import { craftProblems, MAX_CRAFT_FIXES } from "@/lib/craft";
import { z } from "zod";
import { idsIn } from "@/lib/signal-text";
import type { VocalMatch } from "@/lib/voice";
import { AGENT_PROVIDER_OPTIONS, LIMITS, MODELS } from "./models";
import { nextAreas, readCrowd } from "@/server/crowd";
import { vocalStyle } from "@/server/vocal-style";
import { artistProfile } from "@/server/musicbrainz";
import { getSong, newSongId, saveSong } from "@/server/store/songs";
import { compareArtists, genresFromWords, searchArtist } from "@/server/qloo/api";
import { QlooError } from "@/server/qloo/client";
import { ArtistRun, createTools, RunState, type ToolOutput } from "./tools";

const AGENT_INSTRUCTIONS = `You are GhostQ's research agent. A songwriter wants an ORIGINAL song written for a specific crowd. You read that crowd's taste through Qloo tools, then choose the signals the song will be built on.

How to work:
- The artist, where they're from, and their crowd (city, age bands, language) are already read and given in the prompt. Don't ask for them again.
- Two kinds of signal: the VOICE (the artist's own themes, styles and home, already found) sets how the song sounds; the CROWD (crowd_tags, crowd_taste, fan_audiences, the local scene) sets what it's about for these listeners. Choose from both.
- Decide each next call from what you have found. There's no fixed order, but cover: the act's sound (sound_alikes, or artists_in_genres; sound_from_words if the artist's genre tags are thin), the crowd's themes (crowd_tags kind "theme"; it's the strongest lyric signal), and at least one source of imagery or detail (crowd_taste, fan_audiences or crowd_tags kind "style").
- If sound_alikes says Qloo has no taste data for the act, switch to artists_in_genres. Don't retry the same call with the same input.
- About 6–9 tool calls in total. Before each call, write one short sentence on what you'll check and why.
- Finish with ready_to_write: the signal ids the song should rest on, and its angle in one sentence.

Rules:
- Taste data describes a crowd, never a person.
- Never invent a signal. Only ids returned by tools exist.
- Qloo has no language filter: the language is the one given in the prompt.`;

export const WRITER_RULES = `Rules for the song:
- Write an ORIGINAL song in the language given above: the title and the lyrics. The notes for musicians and the singer (feel, melody, genre, vocal direction, production brief, angle) stay in English. Don't quote, paraphrase or imitate any existing lyric, and don't name any real artist, song, film or book in a lyric.
- Voice: write as the artist, from their home. The voice signals (their own themes and styles, and home) set the language, slang, places and images. The crowd signals set what the song is about for these listeners.
- Artists in the signals are style references for the music and production brief only.
- Films and books in the signals set the mood and the kind of images only. Never use their titles, their characters, their settings or their plots, and never retell a famous scene (a song drawing on a film about four sisters must not mention four sisters).
- Every line cites 1–3 signal ids from the list that shaped it (a theme it's about, an image drawn from a film or book's mood, a style). Use only ids from the list.
- Build the song mostly on the chosen signals. Each theme you use should be audible in the words.
- Structure: verses, a chorus that repeats, and a bridge. Concrete images, not abstractions. Singable lines.
- Chords fit the key (diatonic, or a common borrowed chord such as bVII or iv in major). A section that repeats (every chorus, every verse) repeats its chord progression. Melody notes are practical directions a musician can use.
- Craft: the title is the hook, sung on the chorus's first or last line. Each verse matches the first verse's syllable count line by line (within 4), so one melody fits both. Every section rhymes (end rhyme or, in Spanish and Portuguese, assonance). Sung lines stay under 18 syllables. No filler ("oh oh", "yeah yeah", "baby baby").
- Genre: a few words naming the music's genre, built from the artist's own genre and style signals and citing their ids. Be specific (a style, not just "pop"). A singer gets exactly this, so it decides what the song sounds like.
- Vocal direction: when there's a "voice" signal (V…), that's how the artist actually sings: build the vocal direction on it and cite it, describing the delivery in technique words (never naming or comparing to anyone). Then 1–2 sentences on how the voices given above perform this song: sung, rapped, spoken, whispered, harmonies, call and answer, who takes which part. Make it fit the genre and cite signal ids. Use exactly the voices given: never add, drop or change one. Never name an artist or cite an artist id here.`;

type Emit = (event: RunEvent) => void;

/** One run. `onQlooCalls` gets the number of live (uncached) Qloo calls it made, however it ended: the daily budget. */
export async function runGhostQ(given: Brief, send: Emit, abortSignal?: AbortSignal, onQlooCalls?: (calls: number) => Promise<void>, owner: string | null = null): Promise<void> {
  const remix = given.remix ? await remixBrief(given) : null;
  if (remix && "error" in remix) {
    send({ type: "error", message: remix.error });
    return;
  }
  const brief = remix?.brief ?? given;
  const state = new RunState(brief);
  state.original = remix?.original ?? null;
  try {
    await run(state, brief, send, abortSignal, owner);
  } finally {
    await onQlooCalls?.(state.qlooCalls).catch((e) => console.error("qloo budget count failed", e instanceof Error ? e.message : e));
  }
}

/**
 * RemixQ: the brief comes from the saved song (its artist, Spotify pick, story and answers), plus the new crowd. The
 * client sends only the song's id, so a remix can't be pointed at an artist or story the song wasn't written for.
 */
async function remixBrief(given: Brief): Promise<{ brief: Brief; original: SongSheet } | { error: string }> {
  const saved = await getSong(given.remix!.of);
  if (!saved) return { error: "That song isn't saved any more, so it can't be remixed." };
  if (saved.sheet.featuring) return { error: "CollabQ songs can't be remixed yet. Remix a solo song." };
  const { artist, spotifyId, story, answers } = saved.brief;
  return { brief: { artist, spotifyId, story, answers, remix: given.remix }, original: { ...saved.sheet, id: saved.id } };
}

async function run(state: RunState, brief: Brief, send: Emit, abortSignal: AbortSignal | undefined, owner: string | null): Promise<void> {
  const started = Date.now();
  // Every research event is kept with the saved song, so its page can replay how it was made.
  const log: RunEvent[] = [];
  const emit: Emit = (event) => {
    if (event.type === "note" || event.type === "step-start" || event.type === "step-end" || event.type === "crowd") log.push(event);
    send(publicEvent(event));
  };
  if (!(await readArtistAndCrowd(state, emit))) return;
  await research(state, emit, abortSignal);
  if (state.signals.all().length === 0) {
    emit({ type: "error", message: "Qloo returned no taste data for this artist, so there's nothing to write from. Try another artist." });
    return;
  }
  const id = newSongId();
  const { voices, source } = songVocals(state);
  const sheet: SongSheet = { ...(await write(state, emit, abortSignal)), vocals: { voices, source }, id };
  const otherAreas = await state.artist().nextAreas;
  if (otherAreas?.length) sheet.crowd = { ...sheet.crowd, otherAreas };
  // Saved for the share link; a failed save keeps the song on the page, just without a link.
  await saveSong({ id, brief, sheet, research: log, createdAt: new Date().toISOString(), audio: null, owner }).catch((e) => {
    console.error("save song failed", e instanceof Error ? e.message : e);
    delete sheet.id;
  });
  emit({ type: "sheet", sheet });
  emit({ type: "done", qlooCalls: state.qlooCalls, qlooCached: state.qlooCached, seconds: Math.round((Date.now() - started) / 1000) });
}

/**
 * Before the agent: find each artist on Qloo (pinned by the Spotify pick) and read their crowd from Qloo's data on
 * their fans. Fixed steps, not agent choices, because everything after depends on them. CollabQ reads A, then B, then
 * what their crowds share; a run stops to ask about whichever artist Qloo lacks data on.
 */
async function readArtistAndCrowd(state: RunState, emit: Emit): Promise<boolean> {
  try {
    for (const x of state.artists) if (!(await readOne(state, x, emit))) return false;
    if (state.collab) await readWhatTheyShare(state, emit);
    return true;
  } catch (error) {
    if (error instanceof QlooError) {
      emit({ type: "error", message: `Couldn't reach Qloo: ${error.message}. Try again in a minute.` });
      return false;
    }
    throw error;
  }
}

/** CollabQ: tags a step with the artist it's for. Nothing for a solo run. */
function whose(state: RunState, key: "A" | "B", name?: string): { who?: "A" | "B"; artist?: string } {
  if (!state.collab) return {};
  const x = state.artist(key);
  return { who: key, artist: name ?? x.act?.name ?? x.name };
}

/**
 * Where the artist is from, Qloo first (F3): the country from Qloo's description of the act (else a country Qloo files
 * among its genre tags); MusicBrainz, found by Qloo's own MusicBrainz id, only adds the city when it agrees on the
 * country, or answers alone when Qloo says nothing.
 */
function homeFor(x: ArtistRun, mb: Home | null): Home | null {
  const fromQloo = countryFromDescription(x.act?.description) ?? (x.homeFromTags ? { country: x.homeFromTags, countryCode: countryCodeFor(x.homeFromTags) } : null);
  if (!fromQloo) return mb;
  if (mb && mb.countryCode && mb.countryCode === fromQloo.countryCode && mb.name !== mb.country) return { ...mb, source: "qloo+musicbrainz" };
  return { name: fromQloo.country, country: fromQloo.country, countryCode: fromQloo.countryCode, source: "qloo" };
}

const HOME_SOURCE: Record<Home["source"], (artist: string) => string> = {
  qloo: (a) => `Qloo: ${a}'s profile`,
  "qloo+musicbrainz": (a) => `Qloo: ${a}'s country; MusicBrainz (by Qloo's id): the city`,
  musicbrainz: (a) => `MusicBrainz: where ${a} is from (Qloo doesn't say)`,
};

/** Words too common in artist names to count as a match. */
const STOPWORDS = new Set(["the", "los", "las", "les", "del", "and", "und", "con"]);

async function readOne(state: RunState, x: ArtistRun, emit: Emit): Promise<boolean> {
  const answers = x.answers;
  const missing: AskField[] = [];
  const side = state.side(x.key);
  const sfx = x.key === "B" ? "-B" : "";
  const findLabel = state.collab ? `Find ${x.name} on Qloo` : TOOL_LABELS.find_artist;
  emit({ type: "step-start", id: `find-artist${sfx}`, tool: "find_artist", label: findLabel, input: { name: x.name, spotifyId: x.spotifyId ?? null }, ...whose(state, x.key, x.name) });
  // The artist's own tags, from Qloo's match or from Qloo's tag search on the user's words: both say where they're from
  // ("cuba") and what language they sing in ("son cubano").
  let ownTags: string[] = [];
  const results = await searchArtist(x.name, state.onCall);
  // The user's pick among Qloo's candidates (asked below when there's no exact match), else the Spotify id or exact name.
  const match = (answers?.qlooId ? results.find((r) => r.id === answers.qlooId) : undefined) ?? (answers?.noQloo ? undefined : pickArtist(results, x.name, x.spotifyId));
  // Qloo's look-alikes worth offering: they share a real word with the name ("Yomil y El Dany" for "Yomil"), not just
  // "El" (El-P for "El Yonki").
  const words = (n: string) => n.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const want = new Set(words(x.name));
  const similar = results.filter((r) => words(r.name).some((w) => want.has(w)));
  if (!match && !answers?.noQloo && !answers?.qlooId && similar.length) {
    // Qloo knows artists by this name but none is this Spotify pick: let the user choose, or go on with Spotify's.
    const options = similar.slice(0, 5).map((r) => ({ id: r.id, name: r.name, description: r.description?.slice(0, 160) ?? null }));
    emit({ type: "step-end", id: `find-artist${sfx}`, ok: false, summary: `Qloo has no exact match for ${x.name}. ${options.length} similar artist${options.length === 1 ? "" : "s"} found.`, signals: [], raw: null });
    emit({ type: "ask", fields: ["qlooArtist"], artist: x.name, message: `Qloo has no exact match for ${x.name}. Is it one of these, or carry on with the Spotify artist?`, options, ...(state.collab ? { who: x.key } : {}) });
    return false;
  }
  if (match) {
    x.act = match;
    ownTags = match.tags.map((t) => t.name);
    state.artistNames.add(match.name);
    // Qloo files some places as genres ("Cuba" for Los Aldeanos): those say where the artist is from, not a genre.
    const genreTags = match.tags.filter((t) => t.type.startsWith("urn:tag:genre"));
    x.homeFromTags = genreTags.map((t) => t.name).find((n) => countryCodeFor(n)) ?? null;
    const genres = genreTags.filter((t) => !countryCodeFor(t.name)).slice(0, 6);
    x.genreTagIds = genres.map((g) => g.id);
    const own = `Qloo: ${match.name}'s own tags (voice)`;
    const signals = [
      ...genres.map((g) => state.signals.add("genre", g.name, own, null, side)),
      ...match.tags.filter((t) => t.type === "urn:tag:theme:qloo").slice(0, 5).map((t) => state.signals.add("theme", t.name, own, null, side)),
      // Specific styles first ("Raw Cuban Rap" over "Energetic"): Qloo lists the generic ones first.
      ...match.tags
        .filter((t) => t.type === "urn:tag:style:qloo")
        .sort((p, q) => Number(q.name.includes(" ")) - Number(p.name.includes(" ")))
        .slice(0, 4)
        .map((t) => state.signals.add("style", t.name, own, null, side)),
      ...match.tags
        .filter((t) => t.type === "urn:tag:influenced_by:qloo")
        .slice(0, 3)
        .map((t) => {
          state.artistNames.add(t.name);
          return state.signals.add("artist", t.name, `Qloo: ${match.name}'s influences`, null, side);
        }),
    ];
    const pinned = x.spotifyId && match.spotifyIds.includes(x.spotifyId) ? " (matched by Spotify id)" : "";
    const listed = [...new Map(signals.map((g) => [g.id, g])).values()].map((g) => `${g.id} ${g.label}`).join(", ");
    emit({ type: "step-end", id: `find-artist${sfx}`, ok: true, summary: `Found ${match.name}${pinned}. Their own sound and themes: ${listed || "none listed"}.`, signals, raw: { name: match.name, popularity: match.popularity, tags: match.tags } });
  } else if (answers?.sound) {
    // Qloo doesn't know the act: its sound in the user's words becomes Qloo genres (semantic tag search).
    const tags = (await genresFromWords(answers.sound, state.onCall)).slice(0, 6);
    x.genreTagIds = tags.map((t) => t.id);
    ownTags = tags.map((t) => t.name);
    // A country among them ("cuba") is where the artist is from, as with a matched artist's tags.
    x.homeFromTags = ownTags.find((n) => countryCodeFor(n)) ?? null;
    const signals = tags.map((t) => state.signals.add("genre", t.name, `Qloo tag search: your words "${answers.sound}"`, t.popularity, side));
    const listed = signals.map((g) => `${g.id} ${g.label}`).join(", ");
    emit({ type: "step-end", id: `find-artist${sfx}`, ok: tags.length > 0, summary: `Qloo doesn't know ${x.name}, so their sound comes from your words. Genres: ${listed || "none matched"}.`, signals, raw: tags });
  } else {
    missing.push("sound");
    emit({ type: "step-end", id: `find-artist${sfx}`, ok: false, summary: `Qloo doesn't know ${x.name} yet.`, signals: [], raw: null });
  }

  const artistName = x.act?.name ?? x.name;
  emit({ type: "step-start", id: `read-crowd${sfx}`, tool: "read_crowd", label: state.collab ? `Read ${artistName}'s crowd` : TOOL_LABELS.read_crowd, input: { artist: artistName }, ...whose(state, x.key, artistName) });
  // The crowd (Qloo) and the artist's profile (MusicBrainz: voice and home) are read in parallel.
  // How they sing (Wikipedia, by Qloo's Wikidata id), read alongside the crowd; it lands as its own step below.
  const singing = vocalStyle(x.act?.wikidataId, languageFor(countryFromDescription(x.act?.description)?.countryCode ?? (x.homeFromTags ? countryCodeFor(x.homeFromTags) : null)));
  const [{ crowd: read, missing: crowdMissing, area }, profile] = await Promise.all([readCrowd(x.act, answers, state.onCall, x.key === "A" ? state.brief.remix : undefined), artistProfile(x.act?.musicbrainzId ?? null)]);
  // Qloo has no gender or member data for artists (probed 23 Oct), so the voices are MusicBrainz's, found by Qloo's id.
  x.vocals = { ...profile.voices, source: `${profile.voices.source} (Qloo has no voice data)` };
  const home = homeFor(x, profile.home);
  // The language: the artist's home, the languages their own Qloo tags point to, and the crowd's city. When these
  // disagree (or there's no home and the tags point elsewhere), the run asks: one of them, or a mix of two.
  const candidates = [
    ...(home?.countryCode ? [languageFor(home.countryCode)] : []),
    ...languagesFromTags(ownTags),
    ...(read.place?.countryCode ? [languageFor(read.place.countryCode)] : []),
  ].filter((l, i, all) => all.indexOf(l) === i);
  const chosen = answers?.language;
  const language = chosen?.primary ?? candidates[0] ?? "English";
  const languageFrom = chosen ? "you" : home?.countryCode && language === languageFor(home.countryCode) ? "home" : "city";
  const crowd: Crowd = { ...read, home, language, languageFrom, ...(chosen?.mix && chosen.mix !== chosen.primary ? { mix: chosen.mix } : {}) };
  missing.push(...crowdMissing);
  if (!chosen && candidates.length > 1) missing.push("language");
  if (missing.length) {
    // Stop and ask: the page shows the question inline and sends the brief again with the answers.
    const gaps = crowdMissing.map((f) => (f === "place" ? "where the fans are" : "how old the fans are")).join(" or ");
    emit({ type: "step-end", id: `read-crowd${sfx}`, ok: false, summary: gaps ? `Qloo has no data on ${gaps}.` : "Waiting for the artist's sound first.", signals: [], raw: crowd });
    emit({
      type: "ask",
      fields: missing,
      artist: artistName,
      message: askMessage(artistName, missing),
      ...(missing.includes("language") ? { languages: candidates.slice(0, 4) } : {}),
      ...(state.collab ? { who: x.key } : {}),
    });
    return false;
  }
  x.crowdInfo = crowd;
  // RemixQ's quick picks, named in the background while the agent researches (awaited when the song is saved).
  if (!state.collab) x.nextAreas = nextAreas(area).catch(() => []);
  const crowdSignals = [
    ...(home ? [state.signals.add("home", describeHome(home), HOME_SOURCE[home.source](artistName), null, side)] : []),
    ...(crowd.place ? [state.signals.add("crowd", `Crowd around ${describePlace(crowd.place)}`, crowd.from.place === "qloo" ? `Qloo insights: ${artistName}'s fans' strongest area (heatmap; place named by OpenStreetMap)` : "Your answer", null, side)] : []),
    ...crowd.ages.map((a) => state.signals.add("crowd", `Crowd aged ${AGE_BANDS[a.age]}`, crowd.from.ages === "qloo" ? `Qloo insights: ${artistName}'s fans (demographics)` : "Your answer", a.skew, side)),
  ];
  const yours = [crowd.from.place === "you" && "the city", crowd.from.ages === "you" && "the ages"].filter(Boolean).join(" and ");
  const picked = [crowd.from.place === "remix" && "the city", crowd.from.ages === "remix" && "the ages"].filter(Boolean).join(" and ");
  emit({ type: "step-end", id: `read-crowd${sfx}`, ok: true, summary: `Writing as ${artistName}${home ? ` (from ${describeHome(home)})` : ""} for ${describeCrowd(crowd)}, in ${crowd.language}.${yours ? ` Qloo had no data on ${yours}, so those are your answers.` : ""}${picked ? ` Remix: ${picked} picked by you; the rest is Qloo's.` : ""}`, signals: crowdSignals, raw: crowd });
  emit({ type: "crowd", artist: artistName, crowd, ...(state.collab ? { who: x.key } : {}) });

  emit({ type: "step-start", id: `vocal-style${sfx}`, tool: "vocal_style", label: TOOL_LABELS.vocal_style, input: { artist: artistName }, ...whose(state, x.key, artistName) });
  // The note must describe the voice, never name it: one that names the artist is dropped.
  const style = await singing.then((v) => (v && !v.delivery.toLowerCase().includes(artistName.toLowerCase()) ? v : null));
  const voice = style ? [state.signals.add("voice", style.delivery, `Wikipedia: ${artistName}'s article, condensed (CC BY-SA, ${style.url})`, null, side)] : [];
  emit({
    type: "step-end",
    id: `vocal-style${sfx}`,
    ok: Boolean(style),
    summary: style ? `How ${artistName} sings, from Wikipedia: ${style.delivery}` : x.act?.wikidataId ? `Wikipedia doesn't describe how ${artistName} sings, so the vocal direction rests on the genre and style signals.` : `Qloo has no Wikipedia link for ${artistName}, so the vocal direction rests on the genre and style signals.`,
    signals: voice,
  });
  return true;
}

/** CollabQ: what A's and B's crowds share (the chorus), and what only one has, from one Qloo compare call. */
async function readWhatTheyShare(state: RunState, emit: Emit): Promise<void> {
  const [a, b] = state.artists;
  emit({ type: "step-start", id: "compare", tool: "compare_crowds", label: TOOL_LABELS.compare_crowds, input: { a: a.name, b: b.name } });
  if (!a.act || a.actInvalid || !b.act || b.actInvalid) {
    emit({ type: "step-end", id: "compare", ok: false, summary: "Qloo needs both artists in its taste graph to compare them, so the chorus rests on the two crowds' closest themes.", signals: [] });
    return;
  }
  try {
    const c = await compareArtists(a.act.id, b.act.id, state.onCall);
    const useful = (t: { kind: string }) => t.kind === "theme" || t.kind === "style" || t.kind === "genre";
    const add = (t: ComparedTag, source: string, side: "A" | "B" | "shared") => state.signals.add(t.kind as "theme" | "style" | "genre", t.name, source, t.score, side);
    const shared = c.shared.filter(useful).slice(0, 10).map((t) => add(t, `Qloo compare: shared by ${a.name}'s and ${b.name}'s fans`, "shared"));
    const onlyA = c.onlyA.filter((t) => t.kind === "theme").slice(0, 4).map((t) => add(t, `Qloo compare: ${a.name}'s fans, not ${b.name}'s`, "A"));
    const onlyB = c.onlyB.filter((t) => t.kind === "theme").slice(0, 4).map((t) => add(t, `Qloo compare: ${b.name}'s fans, not ${a.name}'s`, "B"));
    const list = (s: Signal[]) => s.map((x) => `${x.id} ${x.label}`).join(", ") || "none";
    emit({
      type: "step-end",
      id: "compare",
      ok: shared.length > 0,
      summary: `Both crowds share: ${list(shared)}. Only ${a.name}'s: ${list(onlyA)}. Only ${b.name}'s: ${list(onlyB)}.`,
      signals: [...shared, ...onlyA, ...onlyB],
      raw: c,
    });
  } catch (error) {
    if (!(error instanceof QlooError)) throw error;
    emit({ type: "step-end", id: "compare", ok: false, summary: `Qloo couldn't compare the two crowds (${error.message}), so the chorus rests on their closest themes.`, signals: [] });
  }
}

function askMessage(artist: string, fields: AskField[]): string {
  const parts = fields.map((f) => ({ language: "choose the song's language", qlooArtist: "pick the right artist", sound: `describe ${artist}'s sound in a few words`, place: "find the city of the crowd you're writing for", ages: "pick up to three age bands" })[f]);
  const lead = fields.includes("sound")
    ? `Qloo doesn't know ${artist} yet.`
    : fields.every((f) => f === "language")
      ? `${artist}'s home, Qloo tags and crowd point to different languages.`
      : `Qloo has no data on part of ${artist}'s crowd.`;
  return `${lead} To carry on, ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.`;
}

/** RemixQ's addition to the agent's prompt: the song exists; research what the NEW crowd calls for. */
function remixResearch(state: RunState): string {
  const o = state.original;
  if (!o) return "";
  return `\nThis is a RemixQ: "${o.title}" was written for ${describeCrowd(o.crowd)}; now rewrite it for the crowd above. Research what THIS crowd cares about (crowd_tags kind "theme" first, then imagery), so the writer can change the lines it calls for. The artist's own sound stays.`;
}

/** CollabQ's addition to the agent's prompt: both artists, and the artist input on the tools. */
function collabBrief(state: RunState): string {
  if (!state.collab) return "";
  const b = state.artist("B");
  return `\nThis is a CollabQ: "${state.artist("A").name} feat. ${b.name}". Featuring: ${describeBrief({ artist: b.name }, b.crowdInfo!)} Qloo match for B: ${b.act?.name ?? "none"}.
Research BOTH crowds: pass artist "A" or "B" to the tools (at least crowd_tags kind "theme" for each, and the act's sound for each). The compare step already found what the crowds share (signals tagged {shared}). Choose signals from A, B and shared: verse 1 is A's crowd, verse 2 B's, the chorus what they share. About 9–13 calls.`;
}

async function research(state: RunState, emit: Emit, abortSignal?: AbortSignal): Promise<void> {
  const tools = createTools(state);
  type Tools = typeof tools;
  const chosen: StopCondition<Tools> = () => state.chosen !== null;
  // A CollabQ researches two crowds: a few more steps.
  const maxSteps = state.collab ? LIMITS.maxSteps + 4 : LIMITS.maxSteps;
  const outOfSteps: StopCondition<Tools> = ({ steps }) => steps.length >= maxSteps;
  const agent = new ToolLoopAgent({
    model: MODELS.agent,
    instructions: AGENT_INSTRUCTIONS,
    tools,
    stopWhen: [chosen, outOfSteps],
    maxOutputTokens: LIMITS.maxOutputTokensPerStep,
    providerOptions: AGENT_PROVIDER_OPTIONS,
    prepareStep: ({ stepNumber }) => (stepNumber >= maxSteps - 1 ? { activeTools: ["ready_to_write"] } : {}),
  });
  const result = await agent.stream({
    prompt: `${describeBrief(state.brief, state.crowdInfo!)}\nQloo match: ${state.act?.name ?? `none; their sound in the user's words: "${state.brief.answers?.sound ?? ""}"`}. Genre signals so far: ${state.signals.all().filter((x) => x.kind === "genre").map(signalLine).join("; ") || "none"}.${collabBrief(state)}${remixResearch(state)}\nResearch ${state.collab ? "both crowds" : "this crowd"} and choose the signals for the song.${state.brief.avoid?.length ? `\nSongs already written for this brief (choose signals for a clearly different angle): ${state.brief.avoid.join(" | ")}` : ""}`,
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
        emit({ type: "step-start", id: part.toolCallId, tool: part.toolName, label: TOOL_LABELS[part.toolName] ?? part.toolName, input: part.input, ...whose(state, (part.input as { artist?: "A" | "B" } | null)?.artist ?? "A") });
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

/** The voices are data (MusicBrainz now; Qloo first once it has them), never the model's choice. */
/**
 * The song's voices. Solo: the artist's. CollabQ: up to two of A's then at least one of B's (three at most), each
 * owned by its artist, so verse 1 goes to A's voices and verse 2 to B's.
 */
function songVocals(state: RunState): VocalMatch & { owners: ("A" | "B")[] } {
  const [a, b] = state.artists;
  const av = a.vocals?.voices.length ? a.vocals.voices : [null];
  if (!b) return { voices: a.vocals?.voices ?? [], source: a.vocals?.source ?? "MusicBrainz didn't answer", owners: (a.vocals?.voices ?? []).map(() => "A") };
  const bv = b.vocals?.voices.length ? b.vocals.voices : [null];
  const fromA = av.slice(0, Math.min(av.length, 2));
  const fromB = bv.slice(0, Math.max(1, 3 - fromA.length));
  return {
    voices: [...fromA, ...fromB],
    source: `${a.name}: ${a.vocals?.source ?? "unknown"}; ${b.name}: ${b.vocals?.source ?? "unknown"}`,
    owners: [...fromA.map(() => "A" as const), ...fromB.map(() => "B" as const)],
  };
}

/** The voices are data (MusicBrainz now; Qloo first once it has them), never the model's choice. */
function voicesLine(state: RunState): string {
  const { voices, owners } = songVocals(state);
  if (!voices.length || (!state.collab && voices.includes(null))) return "Voices for the recording: not known yet (the user picks them), so write a vocal direction that works for one or more voices.";
  if (voices.length === 1) return `Voices for the recording (fixed, from data): one ${voices[0]} voice.`;
  const named = voices.map((g, i) => `Voice ${"ABC"[i]} ${g ?? "(gender not known yet)"}${state.collab ? ` (${state.artist(owners[i]).name}'s side)` : ""}`).join(", ");
  return `Voices for the recording (fixed, from data): ${voices.length} voices, ${named}. Give every section its "voices": who performs it, by letter.`;
}

/** The song's language: the artist's, or for a CollabQ both when they differ ("Spanish and English"). */
function songLanguage(state: RunState): string {
  const [a, b] = state.artists;
  if (b && b.crowdInfo!.language !== a.crowdInfo!.language) return `${a.crowdInfo!.language} and ${b.crowdInfo!.language}`;
  return a.crowdInfo!.mix ? `${a.crowdInfo!.language} and ${a.crowdInfo!.mix}` : a.crowdInfo!.language;
}

/** CollabQ's rules for the writer: a verse per crowd, the chorus on what they share, each verse in its artist's language. */
function collabRules(state: RunState): string {
  if (!state.collab) return "";
  const [a, b] = state.artists;
  const la = a.crowdInfo!.language;
  const lb = b.crowdInfo!.language;
  const lang = la === lb ? `The whole song is in ${la}.` : `It's bilingual: ${a.name}'s verses in ${la}, ${b.name}'s verses in ${lb}, and the chorus and bridge mix both languages naturally.`;
  return `This is a CollabQ: "${a.name} feat. ${b.name}".
- Verse 1 (and any other odd verse) is ${a.name}'s: built on signals tagged {artist A}, for ${a.name}'s crowd, sung by ${a.name}'s voices.
- Verse 2 (and any other even verse) is ${b.name}'s: built on signals tagged {artist B}, for ${b.name}'s crowd, sung by ${b.name}'s voices.
- The chorus is where they meet: built on signals tagged {shared}, sung by all the voices.
- ${lang}
- The genre blends both artists' own genre and style signals.`;
}

/** RemixQ's rules for the writer: the original song, and what to keep (structure, hook) and change (what the new crowd calls for). */
function remixRules(state: RunState): string {
  const o = state.original;
  if (!o) return "";
  const song = o.sections.map((s) => [`[${s.name}]`, ...s.lines.map((l) => `${l.text}    (${l.chords})`)].join("\n")).join("\n\n");
  return `This is a RemixQ of "${o.title}", first written for ${describeCrowd(o.crowd)}. Rewrite it for the crowd above.
- Keep: the title "${o.title}", the key, the tempo, the same sections in the same order with the same number of lines, and the chorus's hook line (its first line). The artist's voice and home stay too.
- Change for the new crowd: rewrite the verses, pre-chorus and bridge around the new crowd's signals (its themes, its city, its age, its films, books and lifestyles). A changed line gets new images and a new point, not synonyms. Places and details that belong to the ORIGINAL crowd's city move to the new crowd's world; places from the artist's own home may stay.
- At least two thirds of the verse and bridge lines change. The chorus keeps its hook line; its other lines change where the new crowd calls for it.
- Every line, kept or changed, cites ids from the signal list below (the original's ids don't carry over). Changed lines cite the new crowd's signals.
The original song:
${song}`;
}

function writerPrompt(state: RunState, previous?: { song: WrittenSong; problems: Problem[] }): string {
  const all = state.signals.all();
  const chosenIds = new Set(state.chosen?.signalIds ?? all.map((s) => s.id));
  const chosen = all.filter((s) => chosenIds.has(s.id));
  const other = all.filter((s) => !chosenIds.has(s.id));
  return [
    describeBrief(state.brief, state.crowdInfo!),
    state.collab ? `Featuring: ${describeBrief({ artist: state.artist("B").name }, state.artist("B").crowdInfo!)}` : "",
    state.chosen ? `The research agent's angle: ${state.chosen.angle}` : "",
    state.brief.avoid?.length
      ? state.original
        ? `Remixes already written for this crowd, so take a different angle and images (same title and hook): ${state.brief.avoid.join(" | ")}`
        : `Already written for this brief, so write something clearly different (a new title, hook, angle and images): ${state.brief.avoid.join(" | ")}`
      : "",
    "",
    voicesLine(state),
    collabRules(state),
    remixRules(state),
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

const craftFixes = z.object({
  fixes: z.array(
    z.object({
      section: z.number().int().describe("The section's index, as given"),
      line: z.number().int().describe("The line's index in its section, as given"),
      text: z.string().describe("The rewritten line"),
      signalIds: z.array(z.string()).describe("1–3 signal ids behind the rewritten line"),
    }),
  ),
});

/**
 * The craft pass, shown as a step: the lines that fail the craft rules (lib/craft.ts) go back to the writer on their
 * own, at most MAX_CRAFT_FIXES. A rewrite that breaks a receipt rule is dropped, so the line stays as it was.
 */
async function craftPass(state: RunState, song: WrittenSong, emit: Emit, abortSignal?: AbortSignal): Promise<WrittenSong> {
  const signals = state.signals.all();
  emit({ type: "step-start", id: "craft", tool: "craft_pass", label: TOOL_LABELS.craft_pass, input: { checks: ["hook", "filler", "syllables", "rhyme", "length"] } });
  const todo = craftProblems(song).slice(0, MAX_CRAFT_FIXES);
  if (!todo.length) {
    emit({ type: "step-end", id: "craft", ok: true, summary: "Every line passes: the hook is in the chorus, the verses match, every section rhymes, no filler.", signals: [] });
    return song;
  }
  try {
    const lines = song.sections.map((s, si) => [`[${si}] ${s.name}`, ...s.lines.map((l, li) => `  (${si}.${li}) ${l.text}  [${l.signalIds.join(", ")}]`)].join("\n")).join("\n");
    const prompt = [
      `A song titled "${song.title}", in ${state.crowdInfo!.language}. Rewrite ONLY the lines listed below, to fix the craft problem named for each. Keep each line's meaning, images and receipts where you can, keep the language, and keep it singable over the same chords. Every other line stays as it is.`,
      "",
      "The song:",
      lines,
      "",
      "Lines to rewrite:",
      ...todo.map((p) => `- (${p.section}.${p.line}) ${p.where}: ${p.issue}`),
      "",
      "Signals you may cite:",
      ...signals.map(signalLine),
      "",
      WRITER_RULES,
    ].join("\n");
    const { output } = await generateText({
      model: MODELS.writer,
      output: Output.object({ schema: craftFixes }),
      prompt,
      maxOutputTokens: 2000,
      abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.writerTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
    });
    const wanted = new Set(todo.map((p) => `${p.section}.${p.line}`));
    const changed: string[] = [];
    let patched = song;
    for (const fix of output.fixes) {
      const key = `${fix.section}.${fix.line}`;
      const before = song.sections[fix.section]?.lines[fix.line];
      if (!wanted.has(key) || !before || !fix.text.trim() || fix.text.trim() === before.text) continue;
      const next: WrittenSong = {
        ...patched,
        sections: patched.sections.map((s, si) => (si !== fix.section ? s : { ...s, lines: s.lines.map((l, li) => (li !== fix.line ? l : { ...l, text: fix.text.trim(), signalIds: fix.signalIds })) })),
      };
      // A rewrite that cites an unknown id or names an artist or title is dropped; the line keeps its first draft.
      const where = `${song.sections[fix.section].name || `Section ${fix.section + 1}`}, line ${fix.line + 1}`;
      if (validateSong(next, signals, [...state.artistNames]).some((p) => p.where === where)) continue;
      patched = next;
      changed.push(`${where}: "${before.text}" → "${fix.text.trim()}"`);
    }
    const left = craftProblems(patched).length;
    emit({
      type: "step-end",
      id: "craft",
      ok: true,
      summary: changed.length
        ? `Rewrote ${changed.length} of ${todo.length} flagged line${todo.length === 1 ? "" : "s"}; the rest of the song stays. ${changed.join(" · ")}${left ? ` (${left} smaller point${left === 1 ? "" : "s"} left as written.)` : ""}`
        : `Checked ${todo.length} flagged line${todo.length === 1 ? "" : "s"} and kept them as written.`,
      signals: [],
      raw: { flagged: todo },
    });
    return patched;
  } catch (error) {
    if (abortSignal?.aborted) throw error;
    emit({ type: "step-end", id: "craft", ok: false, summary: "The craft pass didn't answer, so the song stays as first written.", signals: [] });
    return song;
  }
}

async function write(state: RunState, emit: Emit, abortSignal?: AbortSignal): Promise<Omit<SongSheet, "vocals">> {
  emit({ type: "writing", signalCount: state.chosen?.signalIds.length ?? state.signals.all().length });
  const signals = state.signals.all();
  const once = async (prompt: string) =>
    (
      await generateText({
        model: MODELS.writer,
        output: Output.object({ schema: writtenSongSchema }),
        prompt,
        maxOutputTokens: LIMITS.writerMaxOutputTokens,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.writerTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output;
  // A draft that doesn't parse (cut off, or malformed) gets one more try before the run fails.
  const ask = async (prompt: string) => {
    try {
      return await once(prompt);
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error) || abortSignal?.aborted) throw error;
      emit({ type: "note", text: "The writer's draft came back unreadable, so it writes it once more." });
      return once(prompt);
    }
  };
  let song = await ask(writerPrompt(state));
  let problems = [...validateSong(song, signals, [...state.artistNames]), ...chordProblems(song)];
  if (problems.length) {
    emit({ type: "note", text: `The draft broke ${problems.length} receipt or chord rule${problems.length === 1 ? "" : "s"}, so it goes back for one repair.` });
    song = await ask(writerPrompt(state, { song, problems }));
  }
  song = dropUnknownIds(song, signals);
  song = await craftPass(state, song, emit, abortSignal);
  problems = [...validateSong(song, signals, [...state.artistNames]), ...chordProblems(song)];
  const cited = new Set([...song.sections.flatMap((s) => s.lines.flatMap((l) => l.signalIds)), ...idsIn([song.genre, song.vocalDirection, song.productionBrief, song.feel, song.angle].join(" "))]);
  return {
    ...song,
    // Qloo's name, unless it only differs in case from the user's Spotify pick ("yoasobi" vs "YOASOBI").
    artist: state.act && state.act.name.toLowerCase() !== state.brief.artist.toLowerCase() ? state.act.name : state.brief.artist,
    crowd: state.crowdInfo!,
    ...(state.collab ? { featuring: { artist: state.artist("B").act?.name ?? state.artist("B").name, crowd: state.artist("B").crowdInfo! } } : {}),
    ...(state.original ? { title: state.original.title, remixOf: { id: state.original.id!, title: state.original.title, crowd: state.original.crowd } } : {}),
    language: songLanguage(state),
    // What the page and the singer need: every cited signal, the chosen ones, and all the artist's genre and style
    // tags (the singing prompt's genre comes from them; before 23 Oct only line receipts were kept, so it was lost).
    signals: signals.filter((s) => cited.has(s.id) || state.chosen?.signalIds.includes(s.id) || s.kind === "genre" || s.kind === "style" || s.kind === "voice"),
    warnings: problems.map((p) => `${p.where}: ${p.issue}`),
  };
}
