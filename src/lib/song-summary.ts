import type { Crowd } from "./brief";
import type { Signal } from "./signals";

/** What the Library lists for each song. */
export type SongSummary = {
  id: string;
  title: string;
  artist: string;
  /** CollabQ's featured artist, when there is one. */
  featuring: string | null;
  /** RemixQ: the original's title, when this song remixes one. */
  remixOf: string | null;
  crowd: Crowd;
  language: string;
  story: string | null;
  sung: boolean;
  audioVersion: string | null;
  /** The sheet's key and tempo, and its receipts: how many signals it cites, and the three it cites most. */
  key: string;
  tempo: number;
  receiptCount: number;
  receipts: Signal[];
  /** Written in this browser (its device cookie matches the song's owner): the Library highlights it. */
  mine?: boolean;
  createdAt: string;
};
