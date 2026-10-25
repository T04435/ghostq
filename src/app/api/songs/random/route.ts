import { listSongs } from "@/server/store/songs";

/** GET one random sung song from the Library for the QPlayer's Next random song (`?not=<id>` skips the one playing). */
export async function GET(request: Request) {
  const not = new URL(request.url).searchParams.get("not");
  const sung = (await listSongs()).filter((s) => s.sung && s.id !== not);
  if (!sung.length) return Response.json({ error: "Nothing has been sung yet" }, { status: 404 });
  const s = sung[Math.floor(Math.random() * sung.length)];
  return Response.json(
    { id: s.id, title: s.title, artist: s.artist, featuring: s.featuring, audioVersion: s.audioVersion },
    { headers: { "Cache-Control": "no-store" } },
  );
}
