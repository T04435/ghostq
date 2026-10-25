import { cn } from "cn";
import { GHOST_SIZES, GhostMark } from "@/components/brand/ghost-mark";
import { AGENT_NAME_INLINE, AGENT_NAME_START } from "@/lib/agent-persona";
import { possessive } from "@/lib/possessive";

export type AgentState =
  | { state: "researching"; artist?: string; city?: string }
  | { state: "asking" }
  | { state: "writing"; signals: number }
  | { state: "done"; qlooCalls: number }
  | { state: "failed"; step: number; reason?: string }
  | { state: "replayed" };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The Ghost's line for a state, in the third person. */
export function agentStatusText(s: AgentState): string {
  switch (s.state) {
    case "researching":
      if (!s.artist) return `${AGENT_NAME_START} is reading what the crowd cares about.`;
      return `${AGENT_NAME_START} is reading what ${possessive(s.artist)} fans${s.city ? ` in ${s.city}` : ""} care about.`;
    case "asking":
      return `${AGENT_NAME_START} needs an answer before it carries on.`;
    case "writing":
      return `${AGENT_NAME_START} is writing from ${plural(s.signals, "Qloo signal")}.`;
    case "done":
      return `Researched and written by ${AGENT_NAME_INLINE} from ${plural(s.qlooCalls, "Qloo call")}.`;
    case "failed": {
      const where = s.step > 0 ? ` at step ${s.step}` : "";
      const reason = s.reason?.trim().replace(/\.$/, "");
      return `${AGENT_NAME_START} lost the thread${where}${reason ? `: ${reason}` : ""}.`;
    }
    case "replayed":
      return `Shown as ${AGENT_NAME_INLINE} researched it. Nothing new was asked.`;
  }
}

/**
 * One line saying what the Ghost is doing: its mark (GHOST_SIZES.status, decorative, since the sentence carries the state)
 * and the sentence in a status region. Working while it researches or writes, at rest otherwise. `mark={false}` drops the
 * mark where a lockup already shows it.
 */
export function AgentStatusLine({ status, mark = true, className }: { status: AgentState; mark?: boolean; className?: string }) {
  const live = status.state === "researching" || status.state === "writing";
  return (
    <p role="status" aria-live={live ? "polite" : "off"} data-slot="agent-status" className={cn("m-0 flex items-start gap-2 text-sm leading-5", className)}>
      {mark && <GhostMark size={GHOST_SIZES.status} state={live ? "working" : "rest"} decorative />}
      <span className={cn("min-w-0 text-pretty", status.state === "failed" ? "text-destructive" : "text-muted-foreground")}>{agentStatusText(status)}</span>
    </p>
  );
}
