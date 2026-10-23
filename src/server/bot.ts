import "server-only";
import { checkBotId } from "botid/server";

/**
 * A 403 for a request Vercel BotID classifies as a bot, else null. Local development always passes (BotID answers
 * "not a bot" off Vercel). Paired with the paths in src/instrumentation-client.ts.
 */
export async function botRefusal(): Promise<Response | null> {
  const { isBot } = await checkBotId();
  return isBot ? Response.json({ error: "This request looks automated, so GhostQ didn't run it. Use the page in a browser." }, { status: 403 }) : null;
}
