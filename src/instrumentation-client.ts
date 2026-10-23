import { initBotId } from "botid/client/core";

/**
 * Vercel BotID (Basic, free): the browser proves it's a person before the paid routes run. Each route listed here
 * calls checkBotId() on the server (src/server/bot.ts); one that does must be listed, or every request fails it.
 */
initBotId({
  protect: [
    { path: "/api/write", method: "POST" },
    { path: "/api/sing", method: "POST" },
    { path: "/api/rewrite", method: "POST" },
  ],
});
