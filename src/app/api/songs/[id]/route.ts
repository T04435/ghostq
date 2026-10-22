import { getSong, publicSong } from "@/server/store/songs";

/** GET a saved song: what its page shows (sheet, artist and story, research summaries, audio). Never Qloo's raw data. */
export async function GET(_request: Request, { params }: RouteContext<"/api/songs/[id]">) {
  const song = await getSong((await params).id);
  return song ? Response.json(publicSong(song)) : Response.json({ error: "No such song" }, { status: 404 });
}
