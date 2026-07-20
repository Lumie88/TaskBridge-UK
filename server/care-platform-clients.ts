import { createHmac } from "node:crypto";
import { config } from "./config.js";
import type { CarePlatformProvider } from "./care-platform-adapters.js";

type ProviderWithCredentials = Exclude<CarePlatformProvider, "generic">;

type CarePlatformRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  path: string;
  payload?: unknown;
  idempotencyKey?: string;
  extraHeaders?: Record<string, string>;
  credentialsOverride?: {
    apiBaseUrl: string;
    apiKey: string;
    healthPath: string;
  };
};

const credentialProviders: ProviderWithCredentials[] = ["birdie", "pass", "cera"];

export type CarePlatformCredentialOverride = {
  apiBaseUrl?: string | null;
  apiKey?: string | null;
};

export function carePlatformCredentialStatus() {
  return credentialProviders.map((provider) => {
    const credentials = credentialsFor(provider);
    return {
      provider,
      configured: Boolean(credentials.apiBaseUrl && credentials.apiKey),
      apiBaseUrlSet: Boolean(credentials.apiBaseUrl),
      apiKeySet: Boolean(credentials.apiKey),
      healthPath: credentials.healthPath
    };
  });
}

export async function carePlatformHealthCheck(provider: CarePlatformProvider, override: CarePlatformCredentialOverride = {}) {
  if (provider === "generic") return { provider, configured: true, status: "generic_adapter" };
  const credentials = credentialsFor(provider, override);
  if (!credentials.apiBaseUrl || !credentials.apiKey) {
    throw Object.assign(new Error(`${provider.toUpperCase()} API credentials are not configured`), { statusCode: 422 });
  }
  const started = Date.now();
  const response = await carePlatformRequest(provider, {
    method: "GET",
    path: credentials.healthPath,
    credentialsOverride: credentials
  });
  return {
    provider,
    configured: true,
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - started
  };
}

export async function postCarePlatformCompletionCallback(provider: CarePlatformProvider, callbackUrl: string, signingSecret: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-taskbridge-provider": provider,
      "x-taskbridge-signature": createHmac("sha256", signingSecret).update(body).digest("hex")
    },
    body,
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Care-platform callback failed with HTTP ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
  }
  return response;
}

async function carePlatformRequest(provider: ProviderWithCredentials, options: CarePlatformRequestOptions) {
  const credentials = "credentialsOverride" in options && options.credentialsOverride
    ? options.credentialsOverride as ReturnType<typeof credentialsFor>
    : credentialsFor(provider);
  const body = options.payload === undefined ? undefined : JSON.stringify(options.payload);
  const response = await fetch(`${credentials.apiBaseUrl.replace(/\/$/, "")}${normalisePath(options.path)}`, {
    method: options.method || "POST",
    headers: {
      "accept": "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      "authorization": `Bearer ${credentials.apiKey}`,
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
      ...(options.extraHeaders || {})
    },
    body,
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${provider.toUpperCase()} request failed with HTTP ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
  }
  return response;
}

function credentialsFor(provider: ProviderWithCredentials, override: CarePlatformCredentialOverride = {}) {
  const fallback = config.carePlatforms[provider];
  return {
    apiBaseUrl: override.apiBaseUrl || fallback.apiBaseUrl,
    apiKey: override.apiKey || fallback.apiKey,
    healthPath: fallback.healthPath
  };
}

function normalisePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
