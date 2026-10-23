import { z } from "zod";
import { rewriteSection } from "@/server/agent/rewrite";
import { providerStatus } from "@/server/env";
import { device, perVisitor, refusalResponse } from "@/server/limits";
import { getSong, isSongId, saveSong } from "@/server/store/songs";

export const maxDuration = 120;

/**
 * POST {songId, section, note?} → the saved song with that one section rewritten (the rest kept). Only the device
 * that wrote the song may rewrite it, and only before it's sung (the audio would no longer match the words).
 */
export async function POST(request: Request) {
  const body = z
    .object({ songId: z.string().refine(isSongId), section: z.number().int().min(0).max(12), note: z.string().trim().max(200).optional() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Pick a section to rewrite" }, { status: 400 });
  if (!providerStatus().aiGateway) return Response.json({ error: "Rewriting isn't available right now." }, { status: 503 });
  const { songId, section, note } = body.data;
  const song = await getSong(songId);
  if (!song || !song.sheet.sections[section]) return Response.json({ error: "That song or section isn't saved." }, { status: 404 });
  const who = device(request);
  if (!song.owner || !who || song.owner !== who) return Response.json({ error: "Only the browser that wrote this song can rewrite it. Remix it instead." }, { status: 403 });
  if (song.audio) return Response.json({ error: "This song is already sung, so its words stay. Write another or remix it." }, { status: 409 });
  const refused = await perVisitor("write", request);
  if (refused) return refusalResponse(refused);
  try {
    const sheet = await rewriteSection(song.sheet, section, note || undefined, request.signal);
    await saveSong({ ...song, sheet });
    return Response.json({ sheet });
  } catch (error) {
    console.error("rewrite failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "The rewrite didn't come back. Try again in a minute." }, { status: 502 });
  }
}
