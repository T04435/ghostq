import { briefSchema } from "@/lib/brief";
import type { RunEvent } from "@/lib/run-events";
import { runGhostQ } from "@/server/agent/run";
import { providerStatus } from "@/server/env";
import { addQlooCalls, checkQloo, device, perVisitor, refusalResponse } from "@/server/limits";

export const maxDuration = 300;

/** Streams the run as NDJSON: one RunEvent per line. */
export async function POST(request: Request) {
  const parsed = briefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid brief" }, { status: 400 });
  const status = providerStatus();
  if (!status.qloo || !status.aiGateway) {
    console.error("GhostQ not configured", { qloo: status.qloo, aiGateway: status.aiGateway });
    return Response.json({ error: "GhostQ can't write songs right now. Try again later." }, { status: 503 });
  }

  const refused = (await perVisitor("write", request)) ?? (await checkQloo(parsed.data.feat ? 2 : 1));
  if (refused) return refusalResponse(refused);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runGhostQ(parsed.data, emit, request.signal, addQlooCalls, device(request));
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
