import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import express from "express";
import { createApp } from "./server/app.js";
import { config, isProduction, productionConfigErrors } from "./server/config.js";
import { pool } from "./server/db.js";

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

async function shutdown(signal: string) {
  console.log(`Received ${signal}; closing TaskBridge`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
