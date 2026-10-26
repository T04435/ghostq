import "server-only";
import { parseArtistSearch, type SpotifyArtist } from "@/lib/spotify-artist";
import { env } from "@/server/env";

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TIMEOUT_MS = 8000;

let token: { value: string; expiresAt: number } | null = null;

/** Client-credentials token (no user sign-in), reused until a minute before it expires. */
async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  const id = env.SPOTIFY_CLIENT_ID;
  const secret = env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify isn't configured");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Spotify token request returned ${response.status}`);
  const body = (await response.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

const cache = new Map<string, { at: number; value: SpotifyArtist[] }>();

export async function searchSpotifyArtists(query: string): Promise<SpotifyArtist[]> {
  const key = query.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000) return hit.value;
  const url = `${API}/search?${new URLSearchParams({ q: query.trim(), type: "artist", limit: "5" })}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Spotify search returned ${response.status}`);
  const value = parseArtistSearch(await response.json());
  cache.set(key, { at: Date.now(), value });
  return value;
}
