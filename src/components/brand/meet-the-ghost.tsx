import { cn } from "cn";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { Card, CardContent } from "@/components/ui/card";
import { AGENT_NAME_INLINE } from "@/lib/agent-persona";

/** How it works: the card introducing the agent, with the full mark at rest. The agent is only ever called the Ghost. */
export function MeetTheGhost({ className }: { className?: string }) {
  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="flex flex-col gap-4 p-[18px] sm:flex-row sm:items-center sm:gap-6">
        <GhostMark size={GHOST_SIZES.card} decorative />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-lg leading-[1.15] font-semibold tracking-[-0.02em]">Meet {AGENT_NAME_INLINE}</h2>
          <p className="max-w-[560px] text-sm leading-normal text-pretty text-muted-foreground">
            The writer behind every GhostQ draft. It reads a crowd from Qloo, picks what to write about, and shows a receipt for every line.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
