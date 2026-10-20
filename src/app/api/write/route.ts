import { briefSchema } from "@/lib/brief";
import type { RunEvent } from "@/lib/run-events";
import { runGhostQ } from "@/server/agent/run";
import { providerStatus } from "@/server/env";

export const maxDuration = 300;

/** Streams the run as NDJSON: one RunEvent per line. */
export async function POST(request: Request) {
  const parsed = briefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid brief" }, { status: 400 });
  const status = providerStatus();
  if (!status.qloo || !status.aiGateway) {
    return Response.json({ error: `Not configured: ${[!status.qloo && "QLOO_API_KEY", !status.aiGateway && "AI Gateway key"].filter(Boolean).join(" and ")} missing in .env.local` }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runGhostQ(parsed.data, emit, request.signal);
      } catch (error) {
        console.error("GhostQ run failed", error instanceof Error ? error.message : error);
        if (!request.signal.aborted) emit({ type: "error", message: "The run failed part-way. Try again in a minute." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
