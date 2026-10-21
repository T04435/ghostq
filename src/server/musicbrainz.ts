import "server-only";
import { voiceFromMusicBrainz, type VoiceMatch } from "@/lib/voice";

/**
 * MusicBrainz web service (checked 21 Oct 2026): free for non-commercial use; about 1 request a second per IP; every
 * request needs a User-Agent naming the app and a contact. Commercial use needs a check before launch.
 */
const API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "GhostQ/0.1 ( https://github.com/T04435 )";
const GAP_MS = 1100;
const TIMEOUT_MS = 8000;

let nextSlot = 0;
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

type MbArtist = {
  name?: string;
  type?: string | null;
  gender?: string | null;
  relations?: { type?: string; direction?: string; ended?: boolean; artist?: { id: string; name?: string } }[];
};

const cache = new Map<string, Promise<MbArtist>>();

async function getArtist(mbid: string, withMembers: boolean): Promise<MbArtist> {
  const url = `${API}/artist/${mbid}?fmt=json${withMembers ? "&inc=artist-rels" : ""}`;
  const hit = cache.get(url);
  if (hit) return hit;
  const value = (async () => {
    await paced();
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`MusicBrainz returned ${res.status}`);
    return (await res.json()) as MbArtist;
  })();
  cache.set(url, value);
  value.catch(() => cache.delete(url));
  return value;
}

/** The voice that matches the artist: one call for a person, plus up to three current members for a band. Never throws. */
export async function matchVoice(mbid: string | null): Promise<VoiceMatch> {
  if (!mbid) return { voice: null, source: "Qloo has no MusicBrainz id for this artist" };
  try {
    const artist = await getArtist(mbid, true);
    if (artist.type === "Person") return voiceFromMusicBrainz(artist);
    const current = (artist.relations ?? []).filter((r) => r.type === "member of band" && r.direction === "backward" && !r.ended && r.artist).slice(0, 3);
    const members = [];
    for (const r of current) members.push(await getArtist(r.artist!.id, false));
    return voiceFromMusicBrainz(artist, members);
  } catch {
    return { voice: null, source: "MusicBrainz didn't answer" };
  }
}
