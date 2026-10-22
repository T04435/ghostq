import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type { Brief, Crowd } from "@/lib/brief";
import { publicEvent, type RunEvent } from "@/lib/run-events";
import { normalizeSheet, type SongSheet } from "@/lib/song-sheet";
import type { SongSummary } from "@/lib/song-summary";
import { toVocalLine, type VocalLine } from "@/lib/voice";
import { env, providerStatus } from "@/server/env";
import { getObject, putObject } from "./objects";

/**
 * Saved songs, for share links and the Library.
 * - Deployed (and locally with DATABASE_URL): Neon. Songs, their crowd and research in Postgres (table `songs`); sung
 *   MP3s in Neon Object Storage (bucket `ghostq-audio`, key `songs/<id>.mp3`).
 * - Without DATABASE_URL: files under .data/ (git-ignored, because receipts carry Qloo-derived data).
 */
const ID = /^[a-z0-9-]{6,48}$/;
/** The only moderation (the user, 22 Oct): a song Lyria refuses this many times leaves the Library. */
export const SING_BLOCKS_TO_HIDE = 3;

export type SavedSong = {
  id: string;
  brief: Brief;
  sheet: SongSheet;
  /** The run's research as it streamed (notes and Qloo steps), replayed on the song page. */
  research: RunEvent[];
  createdAt: string;
  /** The latest sung version: the vocals it was sung with (null for an old value that no longer reads). */
  audio: { vocals: VocalLine | null; createdAt: string } | null;
  /** Hidden from the Library (moderation); the song's own link still works. */
  hidden?: boolean;
  /** How many times Lyria refused to sing it (content filter). Three takes it out of the Library. */
  singBlocks?: number;
};

type Store = {
  save(song: SavedSong): Promise<void>;
  get(id: string): Promise<SavedSong | null>;
  saveAudio(id: string, vocals: VocalLine, audio: Buffer): Promise<void>;
  getAudio(id: string): Promise<Buffer | null>;
  list(limit: number): Promise<SavedSong[]>;
  /** RemixQ: the songs that remix this one, oldest first (hidden ones included: they're linked, not listed). */
  remixesOf(id: string): Promise<SavedSong[]>;
  /** One more Lyria refusal; the third hides the song from the Library. */
  recordSingBlock(id: string): Promise<{ blocks: number; hidden: boolean }>;
};

export function isSongId(id: string): boolean {
  return ID.test(id);
}

export function newSongId(): string {
  return randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10).padEnd(10, "0");
}

// ---- Neon -------------------------------------------------------------------------------------------------------

let schema: Promise<unknown> | null = null;

function sql() {
  return neon(env.DATABASE_URL!);
}

/** Creates the table once per instance; safe to run on every cold start. */
function ensureSchema(): Promise<unknown> {
  schema ??= sql()`
    CREATE TABLE IF NOT EXISTS songs (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      brief jsonb NOT NULL,
      sheet jsonb NOT NULL,
      research jsonb NOT NULL DEFAULT '[]'::jsonb,
      hidden boolean NOT NULL DEFAULT false,
      audio_voice text,
      audio_created_at timestamptz
    )`
    .then(() => sql()`ALTER TABLE songs ADD COLUMN IF NOT EXISTS sing_blocks integer NOT NULL DEFAULT 0`)
    .catch((e) => {
    schema = null;
    throw e;
  });
  return schema;
}

type Row = { id: string; created_at: string | Date; brief: Brief; sheet: SongSheet; research: RunEvent[]; hidden: boolean; sing_blocks?: number; audio_voice: string | null; audio_created_at: string | Date | null };

function fromRow(r: Row): SavedSong {
  const iso = (d: string | Date) => new Date(d).toISOString();
  return {
    id: r.id,
    createdAt: iso(r.created_at),
    brief: r.brief,
    sheet: r.sheet,
    research: r.research ?? [],
    hidden: r.hidden,
    singBlocks: r.sing_blocks ?? 0,
    audio: r.audio_voice && r.audio_created_at ? { vocals: toVocalLine(r.audio_voice), createdAt: iso(r.audio_created_at) } : null,
  };
}

const neonStore: Store = {
  async save(song) {
    await ensureSchema();
    await sql()`
      INSERT INTO songs (id, created_at, brief, sheet, research, hidden)
      VALUES (${song.id}, ${song.createdAt}, ${JSON.stringify(song.brief)}::jsonb, ${JSON.stringify(song.sheet)}::jsonb, ${JSON.stringify(song.research)}::jsonb, ${song.hidden ?? false})
      ON CONFLICT (id) DO UPDATE SET brief = EXCLUDED.brief, sheet = EXCLUDED.sheet, research = EXCLUDED.research, hidden = EXCLUDED.hidden`;
  },
  async get(id) {
    await ensureSchema();
    const rows = (await sql()`SELECT * FROM songs WHERE id = ${id}`) as Row[];
    return rows[0] ? fromRow(rows[0]) : null;
  },
  async saveAudio(id, vocals, audio) {
    await ensureSchema();
    await putObject(`songs/${id}.mp3`, audio, "audio/mpeg");
    // audio_voice held a voice name ("male") before 22 Oct; now the vocal line as JSON. toVocalLine reads both.
    await sql()`UPDATE songs SET audio_voice = ${JSON.stringify(vocals)}, audio_created_at = now() WHERE id = ${id}`;
  },
  async getAudio(id) {
    return getObject(`songs/${id}.mp3`);
  },
  async list(limit) {
    await ensureSchema();
    const rows = (await sql()`SELECT * FROM songs WHERE NOT hidden ORDER BY created_at DESC LIMIT ${limit}`) as Row[];
    return rows.map(fromRow);
  },
  async remixesOf(id) {
    await ensureSchema();
    const rows = (await sql()`SELECT * FROM songs WHERE sheet->'remixOf'->>'id' = ${id} ORDER BY created_at`) as Row[];
    return rows.map(fromRow);
  },
  async recordSingBlock(id) {
    await ensureSchema();
    const rows = (await sql()`
      UPDATE songs SET sing_blocks = sing_blocks + 1, hidden = hidden OR sing_blocks + 1 >= ${SING_BLOCKS_TO_HIDE}
      WHERE id = ${id} RETURNING sing_blocks, hidden`) as { sing_blocks: number; hidden: boolean }[];
    return { blocks: rows[0]?.sing_blocks ?? 0, hidden: rows[0]?.hidden ?? false };
  },
};

// ---- Local files ------------------------------------------------------------------------------------------------

const ROOT = path.join(process.cwd(), ".data", "songs");

function file(id: string, ext: "json" | "mp3"): string {
  if (!isSongId(id)) throw new Error("Invalid song id");
  return path.join(ROOT, `${id}.${ext}`);
}

const fileStore: Store = {
  async save(song) {
    await mkdir(ROOT, { recursive: true });
    await writeFile(file(song.id, "json"), JSON.stringify(song));
  },
  async get(id) {
    try {
      return JSON.parse(await readFile(file(id, "json"), "utf8")) as SavedSong;
    } catch {
      return null;
    }
  },
  async saveAudio(id, vocals, audio) {
    const song = await fileStore.get(id);
    if (!song) throw new Error("No such song");
    await writeFile(file(id, "mp3"), audio);
    await fileStore.save({ ...song, audio: { vocals, createdAt: new Date().toISOString() } });
  },
  async getAudio(id) {
    try {
      return await readFile(file(id, "mp3"));
    } catch {
      return null;
    }
  },
  async list(limit) {
    let names: string[];
    try {
      names = (await readdir(ROOT)).filter((n) => n.endsWith(".json"));
    } catch {
      return [];
    }
    const songs = await Promise.all(names.map((n) => fileStore.get(n.slice(0, -5))));
    return songs
      .filter((s): s is SavedSong => Boolean(s && !s.hidden))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },
  async remixesOf(id) {
    let names: string[];
    try {
      names = (await readdir(ROOT)).filter((n) => n.endsWith(".json"));
    } catch {
      return [];
    }
    const songs = await Promise.all(names.map((n) => fileStore.get(n.slice(0, -5))));
    return songs.filter((s): s is SavedSong => s?.sheet.remixOf?.id === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async recordSingBlock(id) {
    const song = await fileStore.get(id);
    if (!song) return { blocks: 0, hidden: false };
    const blocks = (song.singBlocks ?? 0) + 1;
    const hidden = Boolean(song.hidden) || blocks >= SING_BLOCKS_TO_HIDE;
    await fileStore.save({ ...song, singBlocks: blocks, hidden });
    return { blocks, hidden };
  },
};

// ---- The store the app uses ---------------------------------------------------------------------------------------

/** Older songs read into today's shape: the sheet by normalizeSheet, the sung vocals by toVocalLine. */
function normalize(song: SavedSong | null): SavedSong | null {
  if (!song) return null;
  const audio = song.audio && "voice" in song.audio ? { vocals: toVocalLine(String(song.audio.voice)), createdAt: song.audio.createdAt } : song.audio;
  return { ...song, audio, sheet: normalizeSheet(song.sheet) };
}

function store(): Store {
  return providerStatus().database ? neonStore : fileStore;
}

export async function saveSong(song: SavedSong): Promise<void> {
  await store().save(song);
}

export async function getSong(id: string): Promise<SavedSong | null> {
  return isSongId(id) ? normalize(await store().get(id)) : null;
}

/** Keeps the latest sung version of a song; singing again replaces it. */
export async function saveAudio(id: string, vocals: VocalLine, audio: Buffer): Promise<void> {
  if (!isSongId(id)) throw new Error("Invalid song id");
  await store().saveAudio(id, vocals, audio);
}

export async function getAudio(id: string): Promise<Buffer | null> {
  return isSongId(id) ? store().getAudio(id) : null;
}

/** Every visible song, newest first. */
export async function listSongs(limit = 200): Promise<SongSummary[]> {
  const songs = (await store().list(limit)).map((s) => normalize(s)!);
  return songs
    .filter((s) => s.sheet?.crowd)
    .map((s) => ({
      id: s.id,
      title: s.sheet.title,
      artist: s.sheet.artist,
      featuring: s.sheet.featuring?.artist ?? null,
      remixOf: s.sheet.remixOf?.title ?? null,
      crowd: s.sheet.crowd,
      language: s.sheet.language,
      story: s.brief.story ?? null,
      sung: Boolean(s.audio),
      audioVersion: s.audio?.createdAt ?? null,
      createdAt: s.createdAt,
    }));
}

/** RemixQ: the songs that remix this one, oldest first, as links (title and crowd). */
export async function remixesOf(id: string): Promise<{ id: string; title: string; crowd: Crowd }[]> {
  if (!isSongId(id)) return [];
  return (await store().remixesOf(id)).map((s) => normalize(s)!).map((s) => ({ id: s.id, title: s.sheet.title, crowd: s.sheet.crowd }));
}

/** Counts one Lyria refusal for a saved song; the third takes it out of the Library (its link still works). */
export async function recordSingBlock(id: string): Promise<{ blocks: number; hidden: boolean }> {
  return isSongId(id) ? store().recordSingBlock(id) : { blocks: 0, hidden: false };
}

/** A saved song as a browser may see it: what the page shows, without Qloo's raw responses or moderation fields. */
export type PublicSong = Pick<SavedSong, "id" | "createdAt" | "sheet" | "research" | "audio"> & { brief: Pick<Brief, "artist" | "story"> };

export function publicSong(song: SavedSong): PublicSong {
  return {
    id: song.id,
    createdAt: song.createdAt,
    brief: { artist: song.brief.artist, story: song.brief.story },
    sheet: song.sheet,
    research: song.research.map(publicEvent),
    audio: song.audio,
  };
}
