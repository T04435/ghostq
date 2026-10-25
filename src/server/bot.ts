import "server-only";
import { checkBotId } from "botid/server";

/**
 * A 403 for a request Vercel BotID classifies as a bot, else null. Paired with the paths in
 * src/instrumentation-client.ts. Only on Vercel: off it, `next dev` answers "not a bot" but a local `next start` throws
 * ("Must be deployed on Vercel"), so a local production build skips the check (the client skips it on localhost too).
 */
export async function botRefusal(): Promise<Response | null> {
  if (!process.env.VERCEL) return null;
  const { isBot } = await checkBotId();
  return isBot ? Response.json({ error: "This request looks automated, so GhostQ didn't run it. Use the page in a browser." }, { status: 403 }) : null;
}
