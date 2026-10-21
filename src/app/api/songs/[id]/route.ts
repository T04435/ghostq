import { getSong } from "@/server/store/songs";

/** GET a saved song (sheet, brief, whether it has audio). */
export async function GET(_request: Request, { params }: RouteContext<"/api/songs/[id]">) {
  const song = await getSong((await params).id);
  return song ? Response.json(song) : Response.json({ error: "No such song" }, { status: 404 });
}
