/**
 * The label on every song, wherever it shows (song page, Library, share text): GhostQ writes FOR an artist's crowd,
 * and the song is never the artist's own or endorsed by them (compliance list, approved by the user 22 Oct).
 */
export function draftLabel(artist: string, feat?: string): string {
  if (feat) return `GhostQ draft for ${artist} feat. ${feat}, AI-generated, not affiliated with ${artist} or ${feat}`;
  return `GhostQ draft for ${artist}, AI-generated, not affiliated with ${artist}`;
}
