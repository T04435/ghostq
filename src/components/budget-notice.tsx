import { Clock } from "lucide-react";
import { SongCard, type SongCardSong } from "@/components/song-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TEXT = {
  qloo: { title: "Today’s Qloo budget is used up.", body: "GhostQ can’t read new crowds until 00:00 UTC, so new songs wait until then." },
  sing: { title: "Today’s singing budget is used up.", body: "Sheets still write. Singing opens again at 00:00 UTC." },
};

/** The DS's BudgetNotice: the budget Alert and the example songs, which always play. Never a blank error. */
export function BudgetNotice({ kind, examples = [] }: { kind: "qloo" | "sing"; examples?: SongCardSong[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Alert variant="budget">
        <Clock aria-hidden />
        <AlertTitle>{TEXT[kind].title}</AlertTitle>
        <AlertDescription>{TEXT[kind].body}</AlertDescription>
      </Alert>
      {examples.length > 0 && (
        <>
          <span className="text-[13px] font-semibold">Example songs · they always play, budget or not</span>
          {examples.map((s) => (
            <SongCard key={s.id} song={s} compact />
          ))}
        </>
      )}
    </div>
  );
}
