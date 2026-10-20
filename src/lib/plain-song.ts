import { z } from "zod";

/** The no-data comparison on /how: the same brief, the same model, no Qloo. */
export const plainSongSchema = z.object({
  title: z.string(),
  key: z.string(),
  tempo: z.number().int(),
  sections: z.array(z.object({ name: z.string(), lines: z.array(z.object({ text: z.string(), chords: z.string() })) })),
  productionBrief: z.string(),
});
export type PlainSong = z.infer<typeof plainSongSchema>;
