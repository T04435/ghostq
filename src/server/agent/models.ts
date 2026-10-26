import "server-only";

/**
 * Model ids on Vercel AI Gateway (same as Busk Map, checked against the gateway's model list on 2026-10-15).
 * - agent: picks the Qloo calls and the signals
 * - writer: writes the song sheet
 */
export const MODELS = {
  agent: "anthropic/claude-sonnet-5.5",
  writer: "anthropic/claude-sonnet-5.5",
} as const;

/** Sonnet 5.5 takes adaptive thinking only; summaries make the agent's reasoning readable on the page. */
export const AGENT_PROVIDER_OPTIONS = {
  anthropic: { thinking: { type: "adaptive", display: "summarized" }, effort: "medium" },
} as const;

export const LIMITS = {
  maxSteps: 12,
  maxOutputTokensPerStep: 3000,
  agentTimeoutMs: 150_000,
  // Korean, Japanese and Hindi take many more tokens per line: 6000 cut a BTS song off mid-object (23 Oct).
  writerMaxOutputTokens: 12000,
  writerTimeoutMs: 150_000,
} as const;
