import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { normalizeCrowd, type Brief } from "@/lib/brief";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";
import type { SongSummary } from "@/lib/song-summary";
import { normalizeVocals, toVocalLine, type VocalLine } from "@/lib/voice";
import { env, providerStatus } from "@/server/env";
import { getObject, putObject } from "./objects";

/**
 * Saved songs, for share links and the Library.
 * - Deployed (and locally with DATABASE_URL): Neon. Songs, their crowd and research in Postgres (table `songs`); sung
 *   MP3s in Neon Object Storage (bucket `ghostq-audio`, key `songs/<id>.mp3`).
 * - Without DATABASE_URL: files under .data/ (git-ignored, because receipts carry Qloo-derived data).
 */
const ID = /^[a-z0-9-]{6,48}$/;

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
};

type Store = {
  save(song: SavedSong): Promise<void>;
  get(id: string): Promise<SavedSong | null>;
  saveAudio(id: string, vocals: VocalLine, audio: Buffer): Promise<void>;
  getAudio(id: string): Promise<Buffer | null>;
  list(limit: number): Promise<SavedSong[]>;
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
    )`.catch((e) => {
    schema = null;
    throw e;
  });
  return schema;
}

type Row = { id: string; created_at: string | Date; brief: Brief; sheet: SongSheet; research: RunEvent[]; hidden: boolean; audio_voice: string | null; audio_created_at: string | Date | null };

function fromRow(r: Row): SavedSong {
  const iso = (d: string | Date) => new Date(d).toISOString();
  return {
    id: r.id,
    createdAt: iso(r.created_at),
    brief: r.brief,
    sheet: r.sheet,
    research: r.research ?? [],
    hidden: r.hidden,
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
};

// ---- The store the app uses ---------------------------------------------------------------------------------------

/**
 * Songs saved before 22 Oct kept a city id and no home on their crowd, and one lead voice ({voice}) instead of vocals:
 * read them into today's shape.
 */
function normalize(song: SavedSong | null): SavedSong | null {
  if (!song) return null;
  const { voice, ...sheet } = song.sheet as SavedSong["sheet"] & { voice?: unknown };
  const audio = song.audio && "voice" in song.audio ? { vocals: toVocalLine(String(song.audio.voice)), createdAt: song.audio.createdAt } : song.audio;
  return { ...song, audio, sheet: { ...sheet, crowd: normalizeCrowd(sheet.crowd), vocals: normalizeVocals(sheet.vocals ?? voice, sheet) } };
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
      crowd: s.sheet.crowd,
      language: s.sheet.language,
      story: s.brief.story ?? null,
      sung: Boolean(s.audio),
      audioVersion: s.audio?.createdAt ?? null,
      createdAt: s.createdAt,
    }));
}
