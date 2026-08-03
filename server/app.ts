import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { authenticate } from "./auth.js";
import { config, isProduction, productionConfigErrors } from "./config.js";
import { databaseReady, withRequestDbContext } from "./db.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { coordinatorRouter } from "./routes/coordinator.js";
import { familyRouter } from "./routes/family.js";
import { handymanOnboardingRouter } from "./routes/handyman-onboarding.js";
import { visitRouter } from "./routes/visit.js";
import { webhookRouter } from "./routes/webhooks.js";

const brandSvgAssets: Record<string, string> = {
  "/favicon.svg": `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TaskBridge by Growing Fig"><defs><linearGradient id="faviconMark" x1="6" y1="5" x2="58" y2="59" gradientUnits="userSpaceOnUse"><stop stop-color="#FF315F"/><stop offset=".62" stop-color="#FF8A2A"/><stop offset="1" stop-color="#0F8F73"/></linearGradient><linearGradient id="faviconCheck" x1="24" y1="44" x2="41" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="#FF315F"/><stop offset="1" stop-color="#FF8A2A"/></linearGradient></defs><path d="M32 6.5C24.6 14.7 13.5 22.7 13.5 36.1 13.5 48.6 21.7 57.8 32 57.8s18.5-9.2 18.5-21.7C50.5 22.7 39.4 14.7 32 6.5Z" fill="url(#faviconMark)"/><path d="M32 10.8C25.8 17.7 17.1 24.6 17.1 36.1c0 10.1 6.5 17.8 14.9 17.8s14.9-7.7 14.9-17.8c0-11.5-8.7-18.4-14.9-25.3Z" stroke="white" stroke-width="3.2" stroke-linejoin="round"/><path d="M22.9 36.7c0-6.6 4.1-9.9 9.1-14 5 4.1 9.1 7.4 9.1 14 0 7.1-3.7 11.9-9.1 11.9s-9.1-4.8-9.1-11.9Z" fill="#CFEF8A" fill-opacity=".78"/><path d="M31.9 28.4v16M26.2 33c2.7 2.2 4.5 4.7 5.7 7.7M37.8 33c-2.7 2.2-4.5 4.7-5.7 7.7M26 39.4h12.2" stroke="#0F8F73" stroke-width="1.8" stroke-linecap="round" stroke-opacity=".62"/><path d="m24.4 37.7 5.8 5.9 11.5-14" stroke="white" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="m24.4 37.7 5.8 5.9 11.5-14" stroke="url(#faviconCheck)" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="51" cy="51" r="6.4" fill="#22C55E" stroke="white" stroke-width="2.8"/></svg>`,
  "/taskbridge-mark.svg": `<svg width="82" height="82" viewBox="0 0 82 82" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc"><title id="title">TaskBridge mark</title><desc id="desc">A fig-shaped safeguarding check mark for TaskBridge by Growing Fig.</desc><defs><linearGradient id="taskbridgeMark" x1="8" y1="8" x2="70" y2="70" gradientUnits="userSpaceOnUse"><stop stop-color="#FF315F"/><stop offset=".62" stop-color="#FF8A2A"/><stop offset="1" stop-color="#0F8F73"/></linearGradient><linearGradient id="checkAccent" x1="27" y1="50" x2="48" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#FF315F"/><stop offset="1" stop-color="#FF8A2A"/></linearGradient></defs><rect x="8" y="8" width="58" height="58" rx="16" fill="url(#taskbridgeMark)"/><path d="M37 17.5C30.8 24.3 21.6 31 21.6 42.2 21.6 52.6 28.4 60.3 37 60.3s15.4-7.7 15.4-18.1C52.4 31 43.2 24.3 37 17.5Z" stroke="white" stroke-width="3.3" stroke-linejoin="round"/><path d="M26.7 42.6c0-7.5 4.7-11.2 10.3-15.9 5.6 4.7 10.3 8.4 10.3 15.9 0 8-4.2 13.4-10.3 13.4s-10.3-5.4-10.3-13.4Z" fill="#CFEF8A" fill-opacity=".78"/><path d="M36.9 32.9v18.2M30.3 38.1c3.1 2.5 5.2 5.4 6.6 8.8M43.8 38.1c-3.2 2.5-5.3 5.4-6.7 8.8M30.1 45.5h14.5" stroke="#0F8F73" stroke-width="2" stroke-linecap="round" stroke-opacity=".62"/><path d="m28.4 43.6 6.5 6.7 13.1-15.9" stroke="white" stroke-width="5.7" stroke-linecap="round" stroke-linejoin="round"/><path d="m28.4 43.6 6.5 6.7 13.1-15.9" stroke="url(#checkAccent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="65" cy="65" r="7" fill="#22C55E" stroke="white" stroke-width="3"/></svg>`,
  "/taskbridge-logo.svg": `<svg width="310" height="82" viewBox="0 0 310 82" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc"><title id="title">TaskBridge by Growing Fig logo</title><desc id="desc">TaskBridge wordmark with a fig-shaped safeguarding check mark.</desc><defs><linearGradient id="taskbridgeMark" x1="8" y1="8" x2="70" y2="70" gradientUnits="userSpaceOnUse"><stop stop-color="#FF315F"/><stop offset=".62" stop-color="#FF8A2A"/><stop offset="1" stop-color="#0F8F73"/></linearGradient><linearGradient id="bridgeText" x1="144" y1="20" x2="248" y2="52" gradientUnits="userSpaceOnUse"><stop stop-color="#F43F5E"/><stop offset="1" stop-color="#EA580C"/></linearGradient><linearGradient id="checkAccent" x1="27" y1="50" x2="48" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#FF315F"/><stop offset="1" stop-color="#FF8A2A"/></linearGradient></defs><g><rect x="8" y="8" width="58" height="58" rx="16" fill="url(#taskbridgeMark)"/><path d="M37 17.5C30.8 24.3 21.6 31 21.6 42.2 21.6 52.6 28.4 60.3 37 60.3s15.4-7.7 15.4-18.1C52.4 31 43.2 24.3 37 17.5Z" stroke="white" stroke-width="3.3" stroke-linejoin="round"/><path d="M26.7 42.6c0-7.5 4.7-11.2 10.3-15.9 5.6 4.7 10.3 8.4 10.3 15.9 0 8-4.2 13.4-10.3 13.4s-10.3-5.4-10.3-13.4Z" fill="#CFEF8A" fill-opacity=".78"/><path d="M36.9 32.9v18.2M30.3 38.1c3.1 2.5 5.2 5.4 6.6 8.8M43.8 38.1c-3.2 2.5-5.3 5.4-6.7 8.8M30.1 45.5h14.5" stroke="#0F8F73" stroke-width="2" stroke-linecap="round" stroke-opacity=".62"/><path d="m28.4 43.6 6.5 6.7 13.1-15.9" stroke="white" stroke-width="5.7" stroke-linecap="round" stroke-linejoin="round"/><path d="m28.4 43.6 6.5 6.7 13.1-15.9" stroke="url(#checkAccent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="65" cy="65" r="7" fill="#22C55E" stroke="white" stroke-width="3"/></g><text x="82" y="43" fill="#0F172A" font-family="Outfit, Inter, Arial, sans-serif" font-size="31" font-weight="850" letter-spacing="-0.5">Task</text><text x="148" y="43" fill="url(#bridgeText)" font-family="Outfit, Inter, Arial, sans-serif" font-size="31" font-weight="850" letter-spacing="-0.5">Bridge</text><text x="84" y="61" fill="#94A3B8" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="1.9">BY GROWING FIG</text></svg>`
};

export function createApp() {
  const app = express();
  const connectSources = ["'self'"];
  if (config.objectStorageEndpoint) {
    try { connectSources.push(new URL(config.objectStorageEndpoint).origin); } catch { /* Invalid endpoint is rejected by the storage client. */ }
  }
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const svg = brandSvgAssets[req.path];
    if (!svg) return next();
    res.type("image/svg+xml").setHeader("Cache-Control", "public, max-age=3600");
    res.send(svg);
  });
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
    if (origin && !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: "Request origin is not allowed" });
    next();
  });
  app.use(authenticate);
  app.use((req, res, next) => {
    if (!req.auth) return next();
    void withRequestDbContext(req.auth, () => new Promise<void>((resolve, reject) => {
      res.once("finish", resolve);
      res.once("close", resolve);
      res.once("error", reject);
      try {
        next();
      } catch (error) {
        reject(error);
      }
    })).catch(next);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "taskbridge", timestamp: new Date().toISOString() });
  });
  app.get("/api/readiness", async (_req, res) => {
    const database = await databaseReady();
    const missing = productionConfigErrors();
    const objectStorage = Boolean(
      config.objectStorageEndpoint &&
      config.objectStorageAccessKeyId &&
      config.objectStorageSecretAccessKey &&
      config.objectStorageBucket &&
      config.objectStoragePublicBaseUrl
    );
    const ready = database && missing.length === 0;
    res.status(ready ? 200 : 503).json({ ready, database, objectStorage, missingConfiguration: missing });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/coordinator", coordinatorRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/family", familyRouter);
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
