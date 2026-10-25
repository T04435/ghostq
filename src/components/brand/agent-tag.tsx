import { cn } from "cn";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { AGENT_NAME_START } from "@/lib/agent-persona";

/** The Ghost's tag before its own words (notes, the plan): the mark at rest (GHOST_SIZES.tag) and its name. */
export function AgentTag({ name = AGENT_NAME_START, className }: { name?: string; className?: string }) {
  return (
    <span data-slot="agent-tag" className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <GhostMark size={GHOST_SIZES.tag} decorative />
      <span className="font-semibold text-foreground">{name}</span>
    </span>
  );
}
