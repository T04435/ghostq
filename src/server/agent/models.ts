import "server-only";

/**
 * Model ids on Vercel AI Gateway (same as Busk Map, checked against the gateway's model list on 2026-10-15).
 * - agent: picks the Qloo calls and the signals
 * - writer: writes the song sheet
 * - plain: the no-data comparison on /how
 */
export const MODELS = {
  agent: "anthropic/claude-sonnet-5.5",
  writer: "anthropic/claude-sonnet-5.5",
  plain: "anthropic/claude-sonnet-5.5",
} as const;

/** Sonnet 5.5 takes adaptive thinking only; summaries make the agent's reasoning readable on the page. */
export const AGENT_PROVIDER_OPTIONS = {
  anthropic: { thinking: { type: "adaptive", display: "summarized" }, effort: "medium" },
} as const;

export const LIMITS = {
  maxSteps: 12,
  maxOutputTokensPerStep: 3000,
  agentTimeoutMs: 150_000,
  writerMaxOutputTokens: 6000,
  writerTimeoutMs: 120_000,
} as const;
