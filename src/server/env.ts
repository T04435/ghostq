import "server-only";
import { z } from "zod";

/**
 * Validated, server-only environment. Never log values from here:
 * `providerStatus()` reports booleans only.
 */
const secret = z
  .string()
  .optional()
  .transform((value) => {
    // Values pulled from Vercel can arrive wrapped in quotes.
    const trimmed = value?.trim().replace(/^"(.*)"$/, "$1");
    return trimmed && trimmed.toUpperCase() !== "SET_ME" ? trimmed : undefined;
  });

const schema = z.object({
  QLOO_API_KEY: secret,
  QLOO_API_BASE_URL: z.url().default("https://hackathon.api.qloo.com"),
  AI_GATEWAY_API_KEY: secret,
  GEMINI_API_KEY: secret,
  SPOTIFY_CLIENT_ID: secret,
  SPOTIFY_CLIENT_SECRET: secret,
  VERCEL_OIDC_TOKEN: secret,
});

export const env = schema.parse(process.env);

export function providerStatus() {
  return {
    qloo: Boolean(env.QLOO_API_KEY),
    aiGateway: Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN),
    gemini: Boolean(env.GEMINI_API_KEY),
    spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
  };
}
