import { initBotId } from "botid/client/core";

/**
 * Vercel BotID (Basic, free): the browser proves it's a person before the paid routes run. Each route listed here
 * calls checkBotId() on the server (src/server/bot.ts); one that does must be listed, or every request fails it.
 * Only on a deployment: Vercel serves BotID's challenge script, so on localhost the protected fetches would fail
 * (and checkBotId() lets everything through in development anyway).
 */
if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
  initBotId({
    protect: [
      { path: "/api/write", method: "POST" },
      { path: "/api/sing", method: "POST" },
      { path: "/api/rewrite", method: "POST" },
    ],
  });
}
