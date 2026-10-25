import { cn } from "cn";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { AGENT_NAME_START } from "@/lib/agent-persona";

/**
 * The run header lockup: the Ghost's mark (GHOST_SIZES.lockup) and its name, nothing else (no model credit). `live` runs
 * the mark's working state; otherwise it rests with its tail. Spans only, so it can sit in a heading or a button.
 */
export function AgentLockup({ live, name = AGENT_NAME_START, size = GHOST_SIZES.lockup, className }: { live?: boolean; name?: string; size?: number; className?: string }) {
  return (
    <span data-slot="agent-lockup" className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <GhostMark size={size} state={live ? "working" : "rest"} decorative />
      <span className="text-base leading-none font-semibold tracking-[-0.02em] whitespace-nowrap">{name}</span>
    </span>
  );
}
