import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Brief } from "@/lib/brief";
import type { SongSummary } from "@/lib/song-summary";
import type { RunEvent } from "@/lib/run-events";
import type { SongSheet } from "@/lib/song-sheet";
import type { Voice } from "@/lib/voice";

/**
 * Saved songs, for share links and instant examples. This is the local-development store: files under .data/ (git-
 * ignored, because receipts carry Qloo-derived data). Vercel's filesystem is read-only, so the deploy (B02) swaps this
 * module for Neon (sheets) and Vercel Blob (audio) behind the same functions.
 */
const ROOT = path.join(process.cwd(), ".data", "songs");
const ID = /^[a-z0-9-]{6,48}$/;

export type SavedSong = {
  id: string;
  brief: Brief;
  sheet: SongSheet;
  /** The run's research as it streamed (notes and Qloo steps), replayed on the song page and in the Library. */
  research: RunEvent[];
  createdAt: string;
  audio: { voice: Voice; createdAt: string } | null;
  /** Hidden from the Library (moderation); the song's own link still works. */
  hidden?: boolean;
};


export function isSongId(id: string): boolean {
  return ID.test(id);
}

function file(id: string, ext: "json" | "mp3"): string {
  if (!isSongId(id)) throw new Error("Invalid song id");
  return path.join(ROOT, `${id}.${ext}`);
}

export function newSongId(): string {
  return randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10).padEnd(10, "0");
}

export async function saveSong(song: SavedSong): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  await writeFile(file(song.id, "json"), JSON.stringify(song));
}

export async function getSong(id: string): Promise<SavedSong | null> {
  if (!isSongId(id)) return null;
  try {
    return JSON.parse(await readFile(file(id, "json"), "utf8")) as SavedSong;
  } catch {
    return null;
  }
}

/** Keeps the latest sung version of a song; singing again replaces it. */
export async function saveAudio(id: string, voice: Voice, audio: Buffer): Promise<void> {
  const song = await getSong(id);
  if (!song) throw new Error("No such song");
  await writeFile(file(id, "mp3"), audio);
  await saveSong({ ...song, audio: { voice, createdAt: new Date().toISOString() } });
}

export async function getAudio(id: string): Promise<Buffer | null> {
  if (!isSongId(id)) return null;
  try {
    return await readFile(file(id, "mp3"));
  } catch {
    return null;
  }
}

/** Every visible song, newest first. The local store reads the folder; the deployed store will query Neon. */
export async function listSongs(limit = 200): Promise<SongSummary[]> {
  let names: string[];
  try {
    names = (await readdir(ROOT)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const songs = await Promise.all(names.map((n) => getSong(n.slice(0, -5))));
  return songs
    .filter((s): s is SavedSong => Boolean(s && !s.hidden && s.sheet?.crowd))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
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
