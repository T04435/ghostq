import { Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TEXT = {
  qloo: { title: "Today’s Qloo budget is used up.", body: "GhostQ can’t read new crowds until 00:00 UTC, so new songs wait until then." },
  sing: { title: "Today’s singing budget is used up.", body: "Sheets still write. Singing opens again at 00:00 UTC." },
};

/**
 * The DS's BudgetNotice: the budget Alert, then example songs from the Library, which always play. Never a blank error.
 * `message`: the server's own words (when it comes back), which replace the fixed line; an hourly limit (also a budget
 * refusal) gets its own title, since the daily budget isn't what ran out. `examples`: the song cards (a server-rendered
 * slot); without them it links to the Library instead.
 */
export function BudgetNotice({ kind, message, examples }: { kind: "qloo" | "sing"; message?: string; examples?: ReactNode }) {
  const hourly = Boolean(message && /hour/i.test(message));
  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Budget notice">
      <Alert variant="budget">
        <Clock aria-hidden />
        <AlertTitle>{hourly ? "This hour’s limit is reached." : TEXT[kind].title}</AlertTitle>
        <AlertDescription>
          <p>{message ?? TEXT[kind].body}</p>
          {!examples && (
            <Link href="/library" className="font-medium underline">
              Listen to the songs in the Songbook
            </Link>
          )}
        </AlertDescription>
      </Alert>
      {examples && (
        <>
          <span className="text-[13px] font-semibold">Example songs · they always play, budget or not</span>
          {examples}
        </>
      )}
    </div>
  );
}
