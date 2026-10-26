import { freshExamples } from "@/server/examples";

/** GET two "Try" examples for the Write page: artists the Library has no song for yet (server/examples). */
export async function GET() {
  return Response.json(await freshExamples(), { headers: { "Cache-Control": "no-store" } });
}
