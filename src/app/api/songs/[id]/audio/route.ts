import { getAudioStream } from "@/server/store/songs";

/**
 * GET a saved song's latest sung MP3, streamed and seekable (byte ranges). A versioned URL (?v=<sung at>) never
 * changes, so the CDN keeps it: only the first listener waits on Object Storage.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/songs/[id]/audio">) {
  const range = request.headers.get("range");
  const audio = await getAudioStream((await params).id, range);
  if (!audio) return Response.json({ error: "This song hasn't been sung yet" }, { status: 404 });
  const versioned = new URL(request.url).searchParams.has("v");
  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "private, max-age=60",
  };
  if (audio.length !== undefined) headers["Content-Length"] = String(audio.length);
  if (audio.contentRange) headers["Content-Range"] = audio.contentRange;
  return new Response(audio.body as BodyInit, { status: audio.contentRange ? 206 : 200, headers });
}
