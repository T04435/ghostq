import { z } from "zod";

/** A Spotify artist as the brief's picker shows it. */
export type SpotifyArtist = { id: string; name: string; image: string | null; genres: string[]; followers: number | null };

/** Spotify removed some artist fields for new apps in 2026 (popularity, followers), so all but id and name are optional. */
const artist = z.object({
  id: z.string(),
  name: z.string(),
  images: z.array(z.object({ url: z.string(), width: z.number().nullish() })).optional().default([]),
  genres: z.array(z.string()).optional().default([]),
  followers: z.object({ total: z.number().nullish() }).nullish(),
});

export function parseArtistSearch(json: unknown): SpotifyArtist[] {
  const parsed = z.object({ artists: z.object({ items: z.array(artist).default([]) }) }).parse(json);
  return parsed.artists.items.map((a) => ({
    id: a.id,
    name: a.name,
    // The smallest image wide enough for a 40 px avatar.
    image: [...a.images].sort((x, y) => (x.width ?? 0) - (y.width ?? 0)).find((i) => (i.width ?? 0) >= 64)?.url ?? a.images[0]?.url ?? null,
    genres: a.genres.slice(0, 3),
    followers: a.followers?.total ?? null,
  }));
}
