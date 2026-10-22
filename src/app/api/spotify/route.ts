import { z } from "zod";
import { providerStatus } from "@/server/env";
import { perVisitor, refusalResponse } from "@/server/limits";
import { searchSpotifyArtists } from "@/server/spotify/client";

/** GET /api/spotify?q=… → up to 5 Spotify artists, for the brief's artist picker. */
export async function GET(request: Request) {
  const q = z.string().trim().min(1).max(80).safeParse(new URL(request.url).searchParams.get("q"));
  if (!q.success) return Response.json({ error: "Type an artist name" }, { status: 400 });
  const refused = await perVisitor("search", request);
  if (refused) return refusalResponse(refused);
  if (!providerStatus().spotify) return Response.json({ error: "Spotify isn't configured (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)" }, { status: 503 });
  try {
    return Response.json(await searchSpotifyArtists(q.data));
  } catch (error) {
    console.error("spotify search failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't reach Spotify" }, { status: 502 });
  }
}
