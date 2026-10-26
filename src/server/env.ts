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
  // Qloo's data through NotOnQ (Qloo's answers unchanged; artists Qloo has no record of filled from open data). Set
  // it to https://hackathon.api.qloo.com to call Qloo directly; locally, http://localhost:3400/q/app/ghostq-dev.
  QLOO_API_BASE_URL: z.url().default("https://notonq.vercel.app/q/app/ghostq"),
  AI_GATEWAY_API_KEY: secret,
  GEMINI_API_KEY: secret,
  SPOTIFY_CLIENT_ID: secret,
  SPOTIFY_CLIENT_SECRET: secret,
  VERCEL_OIDC_TOKEN: secret,
  /** "1" on Vercel, where the AI Gateway authenticates with the project's OIDC token at request time (not an env var). */
  VERCEL: z.string().optional(),
  /** Neon Postgres (Vercel integration): saved songs and their research. */
  DATABASE_URL: secret,
  /** Neon Object Storage (S3-compatible, beta): sung MP3s. `neon env pull --service object-storage` writes these. */
  AWS_ACCESS_KEY_ID: secret,
  AWS_SECRET_ACCESS_KEY: secret,
  AWS_ENDPOINT_URL_S3: secret,
  AWS_REGION: secret,
  NEON_STORAGE_BUCKET: secret,
});

export const env = schema.parse(process.env);

export function providerStatus() {
  return {
    qloo: Boolean(env.QLOO_API_KEY),
    aiGateway: Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL === "1"),
    gemini: Boolean(env.GEMINI_API_KEY),
    spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
    database: Boolean(env.DATABASE_URL),
    objectStorage: Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_ENDPOINT_URL_S3 && env.NEON_STORAGE_BUCKET),
  };
}
