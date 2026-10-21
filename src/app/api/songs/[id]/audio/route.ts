import { getAudio } from "@/server/store/songs";

/** GET a saved song's latest sung MP3. */
export async function GET(_request: Request, { params }: RouteContext<"/api/songs/[id]/audio">) {
  const audio = await getAudio((await params).id);
  if (!audio) return Response.json({ error: "This song hasn't been sung yet" }, { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=60" } });
}
