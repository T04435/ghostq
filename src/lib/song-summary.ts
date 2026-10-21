import type { Crowd } from "./brief";

/** What the Library lists for each song. */
export type SongSummary = {
  id: string;
  title: string;
  artist: string;
  crowd: Crowd;
  language: string;
  story: string | null;
  sung: boolean;
  audioVersion: string | null;
  createdAt: string;
};
