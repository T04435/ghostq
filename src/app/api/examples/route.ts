import { freshExamples } from "@/server/examples";

/** GET three Ghost suggestions for the Write page (server/examples); ?mode=feat for CollabQ pairs, ?mode=remix for RemixQs. */
export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  return Response.json(await freshExamples(mode === "feat" || mode === "remix" ? mode : "solo"), { headers: { "Cache-Control": "no-store" } });
}
