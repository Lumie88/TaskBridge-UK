import "dotenv/config";

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function originListEnv(value: string | undefined, fallback: string[]) {
  const values = (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return Array.from(new Set([...values, ...fallback]));
}

function providerEnv(provider: string, key: string) {
  return process.env[`CARE_PLATFORM_${provider}_${key}`] || process.env[`${provider}_${key}`] || "";
}

const defaultAllowedOrigins = [
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://www.growingfig.com",
  "https://growingfig.com",
  "https://taskbridge-uk-production.up.railway.app"
];

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: numberEnv(process.env.PORT, 4173),
  appOrigin: process.env.APP_ORIGIN || "http://localhost:4173",
  allowedOrigins: originListEnv(process.env.APP_ORIGINS || process.env.APP_ORIGIN, defaultAllowedOrigins),
  retryWorkerEnabled: booleanEnv(process.env.RETRY_WORKER_ENABLED, true),
  retryWorkerIntervalMs: numberEnv(process.env.RETRY_WORKER_INTERVAL_MS, 60_000),
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: booleanEnv(process.env.DATABASE_SSL),
  sessionTtlHours: numberEnv(process.env.SESSION_TTL_HOURS, 8),
  encryptionKey: process.env.ENCRYPTION_KEY || "development-only-taskbridge-key-change-me",
  dbsProviderKind: process.env.DBS_PROVIDER_KIND || "ddc",
  dbsProviderApiUrl: process.env.DBS_PROVIDER_API_URL || "",
  dbsProviderApiKey: process.env.DBS_PROVIDER_API_KEY || "",
  dbsWebhookSecret: process.env.DBS_PROVIDER_WEBHOOK_SECRET || "",
  ddcApiBaseUrl: process.env.DDC_API_BASE_URL || process.env.DBS_PROVIDER_API_URL || "",
  ddcApiToken: process.env.DDC_API_TOKEN || process.env.DBS_PROVIDER_API_KEY || "",
  ddcApplicationPath: process.env.DDC_APPLICATION_PATH || "/api/applications",
  ddcAccountCode: process.env.DDC_ACCOUNT_CODE || "",
  ddcLocationCode: process.env.DDC_LOCATION_CODE || "",
  ddcBasicPackageCode: process.env.DDC_BASIC_PACKAGE_CODE || "basic_dbs",
  ddcEnhancedPackageCode: process.env.DDC_ENHANCED_PACKAGE_CODE || "enhanced_dbs",
  dbsApprovalValidityMonths: numberEnv(process.env.DBS_APPROVAL_VALIDITY_MONTHS, 36),
  handymanNetworkProvider: process.env.HANDYMAN_NETWORK_PROVIDER || "internal",
  handymanNetworkApiUrl: process.env.HANDYMAN_NETWORK_API_URL || "",
  handymanNetworkApiKey: process.env.HANDYMAN_NETWORK_API_KEY || "",
  handymanNetworkCancelApiUrl: process.env.HANDYMAN_NETWORK_CANCEL_API_URL || "",
  smsProviderApiUrl: process.env.SMS_PROVIDER_API_URL || "",
  smsProviderApiKey: process.env.SMS_PROVIDER_API_KEY || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || "",
  twilioFallbackFromNumber: process.env.TWILIO_FALLBACK_FROM_NUMBER || "",
  twilioStatusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || "",
  emailProviderKind: process.env.EMAIL_PROVIDER_KIND || "generic",
  emailProviderApiUrl: process.env.EMAIL_PROVIDER_API_URL || "https://api.resend.com/emails",
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY || "",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || "",
  handymanLeadNotificationEmail: process.env.HANDYMAN_LEAD_NOTIFICATION_EMAIL || "integrations@growingfig.com",
  zohoAccountsBaseUrl: process.env.ZOHO_ACCOUNTS_BASE_URL || "https://accounts.zoho.eu",
  zohoMailApiBaseUrl: process.env.ZOHO_MAIL_API_BASE_URL || "https://mail.zoho.eu",
  zohoMailAccountId: process.env.ZOHO_MAIL_ACCOUNT_ID || "",
  zohoMailOAuthToken: process.env.ZOHO_MAIL_OAUTH_TOKEN || process.env.EMAIL_PROVIDER_API_KEY || "",
  zohoClientId: process.env.ZOHO_CLIENT_ID || "",
  zohoClientSecret: process.env.ZOHO_CLIENT_SECRET || "",
  zohoRefreshToken: process.env.ZOHO_REFRESH_TOKEN || process.env.ZOHO_MAIL_REFRESH_TOKEN || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeApiBaseUrl: process.env.STRIPE_API_BASE_URL || "https://api.stripe.com",
  aiTaskPlannerUrl: process.env.AI_TASK_PLANNER_URL || "",
  aiTaskPlannerApiKey: process.env.AI_TASK_PLANNER_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5",
  openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
  googleGeminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || "",
  googleGeminiModel: process.env.GOOGLE_GEMINI_MODEL || "gemini-1.5-flash",
  objectStorageEndpoint: process.env.OBJECT_STORAGE_ENDPOINT || "",
  objectStorageRegion: process.env.OBJECT_STORAGE_REGION || "auto",
  objectStorageAccessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID || "",
  objectStorageSecretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || "",
  objectStorageBucket: process.env.OBJECT_STORAGE_BUCKET || "",
  objectStoragePublicBaseUrl: process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || "",
  carePlatforms: {
    birdie: {
      apiBaseUrl: providerEnv("BIRDIE", "API_BASE_URL"),
      apiKey: providerEnv("BIRDIE", "API_KEY"),
      healthPath: providerEnv("BIRDIE", "HEALTH_PATH") || "/"
    },
    pass: {
      apiBaseUrl: providerEnv("PASS", "API_BASE_URL"),
      apiKey: providerEnv("PASS", "API_KEY"),
      healthPath: providerEnv("PASS", "HEALTH_PATH") || "/"
    },
    cera: {
      apiBaseUrl: providerEnv("CERA", "API_BASE_URL"),
      apiKey: providerEnv("CERA", "API_KEY"),
      healthPath: providerEnv("CERA", "HEALTH_PATH") || "/"
    }
  }
};

export const isProduction = config.nodeEnv === "production";

export function productionConfigErrors() {
  if (!isProduction) return [];
  const missing: string[] = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!process.env.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");
  if (!process.env.APP_ORIGIN) missing.push("APP_ORIGIN");
  return missing;
}
