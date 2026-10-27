#!/usr/bin/env node
// The judging-day switch, with no redeploy (GhostQ reads it within 30 s):
//   VERCEL_ENV=production node --env-file=.env.local scripts/limits.mjs off 2026-10-31T15:00+11:00   limits off until then
//   VERCEL_ENV=production node --env-file=.env.local scripts/limits.mjs on                           limits back on now
//   VERCEL_ENV=production node --env-file=.env.local scripts/limits.mjs status
// While off, per-device and per-network limits are skipped and the daily budgets use their judging figures
// (GHOSTQ_LYRIA_PER_DAY_JUDGING, GHOSTQ_QLOO_PER_DAY_JUDGING): the money cap on singing stays.
import { neon } from "@neondatabase/serverless";

const [cmd, when] = process.argv.slice(2);
if (process.env.VERCEL_ENV !== "production" || !process.env.DATABASE_URL) {
  console.error("This switches the production limits: run it with VERCEL_ENV=production node --env-file=.env.local");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`;

if (cmd === "off") {
  const until = Date.parse(when ?? "");
  if (!Number.isFinite(until) || until <= Date.now()) {
    console.error("Give a future time, e.g. 2026-10-31T15:00+11:00");
    process.exit(1);
  }
  const iso = new Date(until).toISOString();
  await sql`INSERT INTO settings (key, value) VALUES ('limits_off_until', ${iso}) ON CONFLICT (key) DO UPDATE SET value = ${iso}`;
  console.log(`Limits off until ${iso}.`);
} else if (cmd === "on") {
  await sql`DELETE FROM settings WHERE key = 'limits_off_until'`;
  console.log("Limits on.");
} else if (cmd === "status") {
  const rows = await sql`SELECT value FROM settings WHERE key = 'limits_off_until'`;
  const until = Date.parse(rows[0]?.value ?? "");
  console.log(Number.isFinite(until) && until > Date.now() ? `Limits off until ${new Date(until).toISOString()}.` : "Limits on.");
} else {
  console.error("Usage: limits.mjs off <time> | on | status");
  process.exit(1);
}
