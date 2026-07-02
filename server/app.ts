import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { authenticate } from "./auth.js";
import { config, isProduction, productionConfigErrors } from "./config.js";
import { databaseReady } from "./db.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { coordinatorRouter } from "./routes/coordinator.js";
import { handymanOnboardingRouter } from "./routes/handyman-onboarding.js";
import { visitRouter } from "./routes/visit.js";
import { webhookRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();
  const connectSources = ["'self'"];
  if (config.objectStorageEndpoint) {
    try { connectSources.push(new URL(config.objectStorageEndpoint).origin); } catch { /* Invalid endpoint is rejected by the storage client. */ }
  }
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        connectSrc: connectSources,
        scriptSrc: ["'self'", "'sha256-TSms3c3Q8YdPIIyrvzAZ038jj6+maTTSDzgxjFuN17E='"]
      }
    } : false,
    crossOriginEmbedderPolicy: false
  }));
  app.use((req, res, next) => {
    const requestId = req.get("x-request-id") || randomUUID();
    res.setHeader("x-request-id", requestId);
    next();
  });
  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      (req as Request).rawBody = Buffer.from(buffer);
    }
  }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/api/webhooks/")) return next();
    const origin = req.get("origin");
    if (origin && origin !== config.appOrigin) return res.status(403).json({ error: "Request origin is not allowed" });
    next();
  });
  app.use(authenticate);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "taskbridge", timestamp: new Date().toISOString() });
  });
  app.get("/api/readiness", async (_req, res) => {
    const database = await databaseReady();
    const missing = productionConfigErrors();
    const ready = database && missing.length === 0;
    res.status(ready ? 200 : 503).json({ ready, database, missingConfiguration: missing });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/coordinator", coordinatorRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/handyman-onboarding", handymanOnboardingRouter);
  app.use("/api/visit", visitRouter);
  app.use("/api/webhooks", webhookRouter);

  app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));
  app.use((error: Error & { statusCode?: number }, req: Request, res: Response, _next: NextFunction) => {
    const status = error.statusCode || 500;
    console.error("Request failed", {
      requestId: res.getHeader("x-request-id"),
      method: req.method,
      path: req.path,
      status,
      message: error.message
    });
    res.status(status).json({ error: status >= 500 ? "Internal server error" : error.message });
  });
  return app;
}
