// One-time backfill (31 Oct): sets `origin` on the signals of songs saved before signals had one, from the structured
// data saved with each song (src/lib/origin-backfill.ts), never from a signal's source text. A dry run by default: it
// reads and reports. --write saves, and only with VERCEL_ENV=production (it runs once, at the release that ships origin).
// Run: node --env-file=.env.local scripts/backfill-origins.mjs              (report)
//      VERCEL_ENV=production node --env-file=.env.local scripts/backfill-origins.mjs --write
import { neon } from "@neondatabase/serverless";
import { backfillOrigins } from "../src/lib/origin-backfill.ts";

const write = process.argv.includes("--write");
if (write && process.env.VERCEL_ENV !== "production") {
  console.error("--write saves to the production database: run it with VERCEL_ENV=production, at the release (see the comment at the top).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT id, created_at, sheet, research FROM songs ORDER BY created_at`;
const total = { qloo: 0, notonq: 0, other: 0 };
const unknown = [];
let changed = 0;
for (const row of rows) {
  if (!row.sheet?.signals?.some((s) => !s.origin)) continue;
  const r = backfillOrigins({ createdAt: new Date(row.created_at).toISOString(), sheet: row.sheet, research: row.research ?? [] });
  for (const k of Object.keys(total)) total[k] += r.set[k];
  if (r.unknown.length) unknown.push(`${row.id} ${row.sheet.title}: ${r.unknown.join(", ")}`);
  changed++;
  if (write) await sql`UPDATE songs SET sheet = ${JSON.stringify(r.sheet)}::jsonb WHERE id = ${row.id}`;
}
console.log(`${changed} of ${rows.length} songs ${write ? "backfilled" : "would be backfilled"}: ${total.qloo} Qloo, ${total.notonq} NotOnQ, ${total.other} other signals`);
console.log(`${unknown.length} songs have signals with no structured basis (left other):`);
for (const line of unknown) console.log(`  ${line}`);
