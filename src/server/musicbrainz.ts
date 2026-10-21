import "server-only";
import type { Home } from "@/lib/place";
import { voiceFromMusicBrainz, type VoiceMatch } from "@/lib/voice";

/**
 * MusicBrainz web service (checked 21 Oct 2026): free for non-commercial use; about 1 request a second per IP; every
 * request needs a User-Agent naming the app and a contact. Commercial use needs a check before launch.
 */
const API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "GhostQ/1.0 ( https://ghostq.xyz )";
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
  /** Where the artist is from: the country (with ISO code), and the city or town they began in when known. */
  area?: { name?: string; "iso-3166-1-codes"?: string[] } | null;
  "begin-area"?: { name?: string } | null;
  country?: string | null;
};

/** Where the artist is from, per MusicBrainz (Los Aldeanos: area Cuba, country CU, no begin-area; 22 Oct). */
function homeOf(artist: MbArtist): Home | null {
  const country = artist.area?.name;
  if (!country) return null;
  const code = artist.area?.["iso-3166-1-codes"]?.[0] ?? artist.country ?? null;
  const city = artist["begin-area"]?.name;
  return { name: city && city !== country ? city : country, country, countryCode: code, source: "musicbrainz" };
}

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

/**
 * What MusicBrainz knows about the artist: the voice that matches them (one call for a person, plus up to three current
 * members for a band) and where they're from. Never throws.
 */
export async function artistProfile(mbid: string | null): Promise<{ voice: VoiceMatch; home: Home | null }> {
  if (!mbid) return { voice: { voice: null, source: "Qloo has no MusicBrainz id for this artist" }, home: null };
  try {
    const artist = await getArtist(mbid, true);
    const home = homeOf(artist);
    if (artist.type === "Person") return { voice: voiceFromMusicBrainz(artist), home };
    const current = (artist.relations ?? []).filter((r) => r.type === "member of band" && r.direction === "backward" && !r.ended && r.artist).slice(0, 3);
    const members = [];
    for (const r of current) members.push(await getArtist(r.artist!.id, false));
    return { voice: voiceFromMusicBrainz(artist, members), home };
  } catch {
    return { voice: { voice: null, source: "MusicBrainz didn't answer" }, home: null };
  }
}
