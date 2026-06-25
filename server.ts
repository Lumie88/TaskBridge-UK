import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import express from "express";
import { createApp } from "./server/app.js";
import { config, isProduction, productionConfigErrors } from "./server/config.js";
import { pool } from "./server/db.js";
import { processRetryQueue } from "./server/retry-worker.js";

const app = createApp();
const root = path.dirname(fileURLToPath(import.meta.url));

if (isProduction) {
  const missing = productionConfigErrors();
  if (missing.length) {
    console.error(`Missing required production configuration: ${missing.join(", ")}`);
    process.exit(1);
  }
  const clientRoot = path.join(root, "client");
  app.use(express.static(clientRoot, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => res.sendFile(path.join(clientRoot, "index.html")));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`TaskBridge running on http://localhost:${config.port}`);
});

let retryTimer: NodeJS.Timeout | undefined;
let retryRunning = false;
if (config.retryWorkerEnabled) {
  retryTimer = setInterval(() => {
    if (retryRunning) return;
    retryRunning = true;
    pool.connect()
      .then(async (client) => {
        try {
          await client.query("BEGIN");
          await processRetryQueue(client, 10);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          console.error("Retry worker failed", { message: error instanceof Error ? error.message : "Unknown error" });
        } finally {
          client.release();
          retryRunning = false;
        }
      })
      .catch((error) => {
        retryRunning = false;
        console.error("Retry worker could not acquire database connection", { message: error instanceof Error ? error.message : "Unknown error" });
      });
  }, config.retryWorkerIntervalMs);
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}; closing TaskBridge`);
  if (retryTimer) clearInterval(retryTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
