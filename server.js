import { createServer } from "node:http";
import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual, pbkdf2Sync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const ENCRYPTION_KEY = Buffer.from(process.env.TASKBRIDGE_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef");
const SIGNING_SECRET = process.env.TASKBRIDGE_SIGNING_SECRET || "dev-taskbridge-signing-secret";
const USE_REAL_PARTNER_APIS = process.env.USE_REAL_PARTNER_APIS === "true";
const TASKBRIDGE_PLATFORM_FEE_RATE = 0.1;
const AGENCY_SERVICE_FEE_RATE = 0.05;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const db = seedDatabase();

function seedDatabase() {
  const agency = {
    id: "birdie-london",
    name: "Birdie London",
    apiKey: "shl_demo_birdie_token",
    primaryContact: "Maya Shah",
    webhookUrl: "https://partner.example.local/birdie/webhooks/TaskBridge",
    logoUrl: "https://logo.clearbit.com/birdie.care",
    logoDomain: "birdie.care",
    logoProvider: "clearbit",
    monthlyCap: 500,
    monthlyCommittedSpend: 115
  };

  const users = [
    {
      id: "su_1001",
      agencyId: agency.id,
      name: encryptField("Eleanor Price"),
      address: encryptField("18 Rowan Court, Hackney, London"),
      lat: 51.545,
      lng: -0.055,
      isVulnerable: true
    },
    {
      id: "su_1002",
      agencyId: agency.id,
      name: encryptField("Gareth Morgan"),
      address: encryptField("4 Heathfield Road, Islington, London"),
      lat: 51.544,
      lng: -0.103,
      isVulnerable: false
    }
  ];

  const traders = [
    {
      id: "trd_001",
      source: "taskrabbit",
      marketplaceTraderId: "taskr_88A",
      name: "Nadia Clarke",
      mobile: "+447700900101",
      amiqusSessionId: "amq_sess_ok_001",
      dbsStatus: "Approved",
      dbsExpiryDate: "2027-04-12",
      lat: 51.55,
      lng: -0.07,
      hourlyRate: 38,
      nextAvailable: "Today 14:00-16:00",
      services: ["Garden Path Clearing", "Trip Hazard Removal", "Lawn Mowing", "Window Cleaning"],
      insuranceStatus: "Verified",
      insuranceExpiryDate: "2027-05-31",
      qualifications: ["public-liability", "garden-maintenance"],
      qualityScore: 96,
      lastCheckedAt: "2026-05-28T09:30:00.000Z"
    },
    {
      id: "trd_002",
      source: "checkatrade",
      marketplaceTraderId: "chk_member_204",
      name: "Oliver Bennett",
      mobile: "+447700900202",
      amiqusSessionId: "amq_sess_pending_002",
      dbsStatus: "Pending",
      dbsExpiryDate: null,
      lat: 51.515,
      lng: -0.141,
      hourlyRate: 29,
      nextAvailable: "Today 11:00-13:00",
      services: ["Loose Rails", "Lock Repairs", "Window Cleaning", "Garden Clearance"],
      insuranceStatus: "Verified",
      insuranceExpiryDate: "2027-02-20",
      qualifications: ["public-liability", "minor-repairs"],
      qualityScore: 89,
      lastCheckedAt: "2026-05-27T15:45:00.000Z"
    },
    {
      id: "trd_003",
      source: "airtasker",
      marketplaceTraderId: "air_7731",
      name: "Priya Nair",
      mobile: "+447700900303",
      amiqusSessionId: "amq_sess_ok_003",
      dbsStatus: "Approved",
      dbsExpiryDate: "2026-12-22",
      lat: 51.49,
      lng: -0.082,
      hourlyRate: 34,
      nextAvailable: "Tomorrow 09:00-11:00",
      services: ["Appliance Safety", "Deep Cleaning", "Trip Hazard Removal", "Garden Path Clearing"],
      insuranceStatus: "Verified",
      insuranceExpiryDate: "2027-01-15",
      qualifications: ["public-liability", "appliance-safety"],
      qualityScore: 93,
      lastCheckedAt: "2026-05-29T08:00:00.000Z"
    }
  ];

  const firstTaskToken = signVisitToken("tsk_9A41FD", "trd_001");
  const tasks = [
    {
      id: "tsk_9A41FD",
      serviceUserId: "su_1001",
      careWorkerNotes: "Moss on the front path. Resident uses a walking frame and has already slipped once.",
      category: "Garden Path Clearing",
      urgency: "High",
      assignedTraderId: "trd_001",
      status: "Dispatched",
      beforePhotoUrl: "https://images.unsplash.com/photo-1598902108854-10e335adac99?auto=format&fit=crop&w=900&q=80",
      afterPhotoUrl: null,
      checkInTime: null,
      checkOutTime: null,
      checkInLat: null,
      checkInLng: null,
      token: firstTaskToken,
      createdAt: "2026-05-29T08:45:00.000Z",
      dispatchReceipt: "mock_taskrabbit_8a00",
      ringFenceEnforced: true,
      marketplace: "taskrabbit",
      assignmentStatus: "Assigned",
      estimatedCustomerCharge: 115,
      paymentStatus: "Authorised",
      completionConfirmationStatus: "Not required yet"
    },
    {
      id: "tsk_7C62ED",
      serviceUserId: "su_1002",
      careWorkerNotes: "Oven door seal loose and grease build-up creating smoke during use.",
      category: "Appliance Safety",
      urgency: "Medium",
      assignedTraderId: null,
      status: "Triaged",
      beforePhotoUrl: null,
      afterPhotoUrl: null,
      checkInTime: null,
      checkOutTime: null,
      checkInLat: null,
      checkInLng: null,
      token: signVisitToken("tsk_7C62ED", "unassigned"),
      createdAt: "2026-05-29T10:15:00.000Z",
      dispatchReceipt: null,
      ringFenceEnforced: false,
      marketplace: null,
      assignmentStatus: "Pending assignment",
      estimatedCustomerCharge: 0,
      paymentStatus: "Pending cap check",
      completionConfirmationStatus: "Not required yet"
    }
  ];

  return {
    agencies: new Map([[agency.id, agency]]),
    careManagers: new Map([
      [
        "maya@birdie.example",
        {
          id: "cm_001",
          name: "Maya Shah",
          email: "maya@birdie.example",
          password: hashPassword("demo12345"),
          role: "Care Coordinator",
          accessLevel: "care",
          agencyId: agency.id
        }
      ],
      [
        "admin@taskbridge.example",
        {
          id: "adm_001",
          name: "Alex Reid",
          email: "admin@taskbridge.example",
          password: hashPassword("admin12345"),
          role: "TaskBridge Admin",
          accessLevel: "admin",
          agencyId: agency.id
        }
      ]
    ]),
    demoRequests: [],
    serviceUsers: new Map(users.map((user) => [user.id, user])),
    traders: new Map(traders.map((trader) => [trader.id, trader])),
    tasks: new Map(tasks.map((task) => [task.id, task])),
    audit: [
      auditEvent("system.seed", "Demo data loaded with encrypted service-user fields")
    ]
  };
}

function encryptField(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptField(payload) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  const hash = pbkdf2Sync(String(password), salt, 150000, 32, "sha256").toString("base64url");
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith("pbkdf2$")) return stored === String(password || "");
  const [, salt, expected] = stored.split("$");
  const actual = hashPassword(password, salt).split("$")[2];
  return timingSafeStringEqual(actual, expected);
}

function timingSafeStringEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function signSessionToken(user) {
  const body = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    accessLevel: user.accessLevel,
    issuedAt: Date.now()
  })).toString("base64url");
  const sig = createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySessionToken(token, expectedEmail, requiredAccessLevel = null) {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
  if (!timingSafeStringEqual(sig, expectedSig)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const { email, accessLevel, issuedAt } = payload;
  const maxAgeMs = 8 * 60 * 60 * 1000;
  if (Date.now() - Number(issuedAt) > maxAgeMs) return null;
  if (expectedEmail && email !== String(expectedEmail).trim().toLowerCase()) return null;
  const user = db.careManagers.get(email);
  if (!user || user.accessLevel !== accessLevel) return null;
  if (requiredAccessLevel && user.accessLevel !== requiredAccessLevel) return null;
  return user;
}

function signVisitToken(taskId, traderId) {
  const nonce = randomBytes(8).toString("hex");
  const body = `${taskId}.${traderId}.${nonce}`;
  const sig = createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyVisitToken(token, task) {
  if (!token || !task || token !== task.token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const body = parts.slice(0, 3).join(".");
  const expected = createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
  return timingSafeEqual(Buffer.from(parts[3]), Buffer.from(expected));
}

function auditEvent(type, detail, meta = {}) {
  return {
    id: `aud_${randomBytes(4).toString("hex")}`,
    type,
    detail,
    meta,
    at: new Date().toISOString()
  };
}

function agencyIdFromName(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);
  return slug || `agency-${randomBytes(3).toString("hex")}`;
}

function companyLogoDataUrl(name) {
  const initials = String(name || "TB")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .join("") || "TB";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#dff5e8"/><circle cx="70" cy="26" r="10" fill="#2563eb"/><text x="48" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#102027">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const knownBrandDomains = new Map([
  ["birdie", "birdie.care"],
  ["birdie london", "birdie.care"],
  ["nourish", "nourishcare.com"],
  ["nourish care", "nourishcare.com"],
  ["cera", "ceracare.co.uk"],
  ["cera care", "ceracare.co.uk"],
  ["cera dcp", "ceracare.co.uk"],
  ["pass", "everylifetechnologies.com"],
  ["pass planning", "everylifetechnologies.com"],
  ["pass care planning", "everylifetechnologies.com"],
  ["access", "theaccessgroup.com"],
  ["access group", "theaccessgroup.com"],
  ["the access group", "theaccessgroup.com"],
  ["bluebird care", "bluebirdcare.co.uk"],
  ["bluebird", "bluebirdcare.co.uk"],
  ["helping hands", "helpinghandshomecare.co.uk"],
  ["home instead", "homeinstead.co.uk"]
]);

function normaliseCompanyKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited|plc|llp|group|uk|care)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseDomain(value) {
  const domain = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return "";
  return domain;
}

function domainFromEmail(email) {
  return normaliseDomain(String(email || "").split("@")[1] || "");
}

function brandDomainCandidates({ companyName, email }) {
  const domains = [];
  const emailDomain = domainFromEmail(email);
  if (emailDomain) domains.push(emailDomain);

  const rawKey = normaliseCompanyKey(companyName);
  const knownDomain = knownBrandDomains.get(rawKey) || knownBrandDomains.get(String(companyName || "").toLowerCase().trim());
  if (knownDomain) domains.push(knownDomain);

  const slug = rawKey.replace(/\s+/g, "");
  if (slug && slug.length > 2) {
    domains.push(`${slug}.co.uk`, `${slug}.com`, `${slug}.care`);
  }

  return [...new Set(domains)].slice(0, 6);
}

async function imageUrlIsUsable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": "TaskBridgeLogoResolver/1.0" }
    });
    const contentType = response.headers.get("content-type") || "";
    return response.ok && contentType.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveBrandLogo({ companyName, email }) {
  const fallback = companyLogoDataUrl(companyName);
  const emailDomain = domainFromEmail(email);
  if (emailDomain) {
    return {
      logoUrl: `https://logo.clearbit.com/${encodeURIComponent(emailDomain)}?size=160`,
      domain: emailDomain,
      provider: "clearbit",
      fallback: false
    };
  }

  const knownDomain = knownBrandDomains.get(normaliseCompanyKey(companyName));
  if (knownDomain) {
    return {
      logoUrl: `https://logo.clearbit.com/${encodeURIComponent(knownDomain)}?size=160`,
      domain: knownDomain,
      provider: "clearbit",
      fallback: false
    };
  }

  const domains = brandDomainCandidates({ companyName, email });

  for (const domain of domains) {
    const clearbitUrl = `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=160`;
    if (await imageUrlIsUsable(clearbitUrl)) {
      return { logoUrl: clearbitUrl, domain, provider: "clearbit", fallback: false };
    }

    if (domain === domainFromEmail(email) || knownBrandDomains.get(normaliseCompanyKey(companyName)) === domain) {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
      if (await imageUrlIsUsable(faviconUrl)) {
        return { logoUrl: faviconUrl, domain, provider: "favicon", fallback: false };
      }
    }
  }

  return { logoUrl: fallback, domain: null, provider: "generated", fallback: true };
}

function isWorkEmail(email) {
  const domain = String(email || "").split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const blocked = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com",
    "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me",
    "protonmail.com", "pm.me", "mail.com", "gmx.com", "gmx.co.uk", "zoho.com", "yandex.com"
  ]);
  return !blocked.has(domain);
}

function publicState(viewer = null, visitTask = null) {
  const serviceUsers = [...db.serviceUsers.values()].map((user) => ({
    ...user,
    name: decryptField(user.name),
    address: decryptField(user.address)
  }));
  const visibleUsers = viewer?.accessLevel === "admin"
    ? serviceUsers
    : viewer?.accessLevel === "care"
      ? serviceUsers.filter((user) => user.agencyId === viewer.agencyId)
      : visitTask
        ? serviceUsers.filter((user) => user.id === visitTask.serviceUserId).map((user) => ({ ...user, name: "Resident details redacted", address: "Address redacted until check-in" }))
        : [];
  const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
  const sourceTasks = visitTask ? [visitTask] : [...db.tasks.values()].filter((task) => visibleUserIds.has(task.serviceUserId));
  const tasks = sourceTasks.map((task) => {
    const serviceUser = serviceUsers.find((user) => user.id === task.serviceUserId);
    const trader = db.traders.get(task.assignedTraderId);
    const safeServiceUser = visibleUsers.find((user) => user.id === task.serviceUserId) || serviceUser;
    return {
      ...task,
      serviceUser: safeServiceUser,
      assignedTrader: viewer?.accessLevel === "admin" || visitTask ? trader || null : trader ? { id: trader.id, name: trader.name, source: trader.source } : null,
      tokenUrl: task.assignedTraderId && (viewer?.accessLevel === "admin" || visitTask) ? `/visit/${task.id}?token=${encodeURIComponent(task.token)}` : null
    };
  });
  const vulnerableCases = serviceUsers.filter((user) => user.isVulnerable).length;
  return {
    agencies: [...db.agencies.values()].map(({ apiKey, ...agency }) => agency),
    serviceUsers: visibleUsers,
    traders: viewer?.accessLevel === "admin" ? [...db.traders.values()] : [],
    tasks,
    audit: viewer?.accessLevel === "admin" ? db.audit.slice(-12).reverse() : [],
    metrics: {
      connectedPartners: db.agencies.size,
      activeVulnerableCases: vulnerableCases,
      totalFallRisksPrevented: tasks.filter((task) => task.status === "Completed" || task.category.includes("Path")).length,
      ringFenceTasks: tasks.filter((task) => task.ringFenceEnforced).length
    }
  };
}

async function createTaskFromCarePayload(agency, body) {
  const serviceUser = db.serviceUsers.get(body.service_user_id);
  if (!serviceUser || serviceUser.agencyId !== agency.id) {
    return { error: "Service user not found for agency", status: 404 };
  }
  const plannedTasks = Array.isArray(body.aiTasks) && body.aiTasks.length ? body.aiTasks : [body];
  const results = [];
  for (const planned of plannedTasks) {
  const estimatedCustomerCharge = estimateTaskCharge(planned.category || body.category || "General Home Safety");
  const capCheck = checkAgencyPaymentCap(agency, estimatedCustomerCharge);
  const task = {
    id: `tsk_${randomBytes(3).toString("hex").toUpperCase()}`,
    serviceUserId: serviceUser.id,
    careWorkerNotes: String(planned.notes || body.notes || "").slice(0, 1500),
    category: String(planned.category || body.category || "General Home Safety"),
    urgency: ["Low", "Medium", "High"].includes(planned.urgency || body.urgency) ? (planned.urgency || body.urgency) : "Medium",
    aiSummary: planned.summary || body.aiSummary || null,
    aiRecommendedService: planned.category || body.aiRecommendedService || null,
    preferredWindow: body.preferredWindow || "Next available",
    carerOnSite: Boolean(body.carerOnSite),
    supervisedVisitRequired: Boolean(serviceUser.isVulnerable && body.carerOnSite),
    assignedTraderId: null,
    status: "Triaged",
    beforePhotoUrl: body.beforePhotoUrl || null,
    afterPhotoUrl: null,
    checkInTime: null,
    checkOutTime: null,
    checkInLat: null,
    checkInLng: null,
    token: signVisitToken("pending", "unassigned"),
    createdAt: new Date().toISOString(),
    dispatchReceipt: null,
    ringFenceEnforced: Boolean(serviceUser.isVulnerable),
    marketplace: null,
    assignmentStatus: capCheck.allowed ? "Pending assignment" : "Blocked",
    estimatedCustomerCharge,
    paymentStatus: capCheck.allowed ? "Pending cap authorisation" : "Agency cap exceeded",
    capCheck,
    completionConfirmationStatus: "Not required yet"
  };
  task.token = signVisitToken(task.id, "unassigned");
  db.tasks.set(task.id, task);
  db.audit.push(auditEvent("task.triaged", `Care manager approved intake for TaskBridge admin assignment from ${agency.name}`, { taskId: task.id, ringFence: task.ringFenceEnforced, capCheck }));
  results.push(task);
  }
  return {
    task: results[0],
    tasks: results,
    safeguard: results[0].ringFenceEnforced
      ? results[0].supervisedVisitRequired
        ? "Digital Ring-Fence active: Enhanced DBS required; carer-on-site supervision recorded"
        : "Digital Ring-Fence active: Enhanced DBS required"
      : "Standard marketplace rules",
    assignmentSummary: results.map((task) => ({
      taskId: task.id,
      status: task.assignmentStatus,
      assignedTraderId: task.assignedTraderId
    }))
  };
}

function requireAgencyAuth(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return [...db.agencies.values()].find((agency) => agency.apiKey === token);
}

function requireTaskBridgeAdmin(email) {
  const user = db.careManagers.get(String(email || "").trim().toLowerCase());
  return user?.accessLevel === "admin" ? user : null;
}

function requireTaskBridgeAdminSession(email, sessionToken) {
  return verifySessionToken(sessionToken, email, "admin");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function getRoute(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return { pathname: url.pathname, params: url.searchParams };
}

async function handleApi(req, res) {
  const { pathname, params } = getRoute(req);

  if (req.method === "GET" && pathname === "/api/state") {
    const visitTaskId = params.get("visitTaskId");
    if (visitTaskId) {
      const visitTask = db.tasks.get(visitTaskId);
      if (!verifyVisitToken(params.get("visitToken"), visitTask)) return sendJson(res, 403, { error: "Invalid or expired visit token" });
      return sendJson(res, 200, publicState(null, visitTask));
    }
    const viewer = verifySessionToken(params.get("sessionToken"), params.get("email"));
    return sendJson(res, 200, publicState(viewer));
  }

  if (req.method === "GET" && pathname === "/api/brand-logo") {
    const companyName = String(params.get("companyName") || "").trim().slice(0, 140);
    const email = String(params.get("email") || "").trim().toLowerCase().slice(0, 160);
    if (!companyName && !email) return sendJson(res, 422, { error: "Company name or work email is required" });
    const logo = await resolveBrandLogo({ companyName, email });
    return sendJson(res, 200, logo);
  }

  if (req.method === "POST" && pathname === "/api/demo-requests") {
    const body = await readJson(req);
    const demo = {
      id: `demo_${randomBytes(4).toString("hex")}`,
      name: String(body.name || "").slice(0, 120),
      workEmail: String(body.workEmail || "").slice(0, 160),
      organisation: String(body.organisation || "").slice(0, 160),
      role: String(body.role || "Care Manager").slice(0, 80),
      message: String(body.message || "").slice(0, 600),
      status: "Requested",
      createdAt: new Date().toISOString()
    };
    db.demoRequests.push(demo);
    db.audit.push(auditEvent("demo.requested", `${demo.organisation || demo.workEmail} requested a TaskBridge demo`, { demoId: demo.id }));
    return sendJson(res, 201, { demo, message: "Demo request received. A TaskBridge specialist will follow up." });
  }

  if (req.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !String(body.password || "").trim()) return sendJson(res, 422, { error: "Email and password are required" });
    if (!isWorkEmail(email)) return sendJson(res, 422, { error: "Please use your work email address. Personal email domains are not accepted." });
    if (db.careManagers.has(email)) return sendJson(res, 409, { error: "An account already exists for this email" });
    const companyName = String(body.companyName || body.organisation || "").trim().slice(0, 140);
    if (!companyName) return sendJson(res, 422, { error: "Company name is required" });
    let agencyId = agencyIdFromName(companyName);
    if (db.agencies.has(agencyId) && db.agencies.get(agencyId).name.toLowerCase() !== companyName.toLowerCase()) {
      agencyId = `${agencyId}-${randomBytes(2).toString("hex")}`;
    }
    const logo = await resolveBrandLogo({ companyName, email });
    const agency = db.agencies.get(agencyId) || {
      id: agencyId,
      name: companyName,
      apiKey: `tb_${randomBytes(12).toString("hex")}`,
      primaryContact: String(body.name || "Care Manager").slice(0, 120),
      webhookUrl: "",
      logoUrl: logo.logoUrl,
      logoDomain: logo.domain,
      logoProvider: logo.provider,
      monthlyCap: 500,
      monthlyCommittedSpend: 0
    };
    if (!agency.logoUrl || agency.logoProvider === "generated") {
      agency.logoUrl = logo.logoUrl;
      agency.logoDomain = logo.domain;
      agency.logoProvider = logo.provider;
    }
    db.agencies.set(agency.id, agency);
    const manager = {
      id: `cm_${randomBytes(3).toString("hex")}`,
      name: String(body.name || "Care Manager").slice(0, 120),
      email,
      password: hashPassword(String(body.password).slice(0, 120)),
      role: ["Care Manager", "Care Coordinator"].includes(body.role) ? body.role : "Care Coordinator",
      accessLevel: "care",
      agencyId: agency.id
    };
    db.careManagers.set(email, manager);
    db.audit.push(auditEvent("auth.signup", `${manager.name} joined ${agency.name}`, { managerId: manager.id }));
    return sendJson(res, 201, { user: sanitizeManager(manager), sessionToken: signSessionToken(manager), agency: { id: agency.id, name: agency.name, logoUrl: agency.logoUrl || companyLogoDataUrl(agency.name), logoDomain: agency.logoDomain, logoProvider: agency.logoProvider } });
  }

  if (req.method === "POST" && pathname === "/api/auth/signin") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const manager = db.careManagers.get(email);
    if (!manager || !verifyPassword(body.password, manager.password)) return sendJson(res, 401, { error: "Invalid care manager credentials" });
    if (manager.accessLevel !== "care") return sendJson(res, 403, { error: "Use the TaskBridge admin access point" });
    const agency = db.agencies.get(manager.agencyId);
    db.audit.push(auditEvent("auth.signin", `${manager.name} signed in`, { managerId: manager.id }));
    return sendJson(res, 200, { user: sanitizeManager(manager), sessionToken: signSessionToken(manager), agency: { id: agency.id, name: agency.name, logoUrl: agency.logoUrl, logoDomain: agency.logoDomain } });
  }

  if (req.method === "POST" && pathname === "/api/auth/admin-signin") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const admin = db.careManagers.get(email);
    if (!admin || !verifyPassword(body.password, admin.password) || admin.accessLevel !== "admin") {
      return sendJson(res, 401, { error: "Invalid TaskBridge admin credentials" });
    }
    const agency = db.agencies.get(admin.agencyId);
    db.audit.push(auditEvent("auth.admin_signin", `${admin.name} signed in to admin`, { adminId: admin.id }));
    return sendJson(res, 200, { user: sanitizeManager(admin), sessionToken: signSessionToken(admin), agency: { id: agency.id, name: agency.name, logoUrl: agency.logoUrl, logoDomain: agency.logoDomain } });
  }

  if (req.method === "POST" && pathname === "/api/ai/task-plan") {
    const body = await readJson(req);
    const manager = verifySessionToken(body.sessionToken, body.managerEmail, "care");
    if (!manager) return sendJson(res, 401, { error: "Care manager session not recognised" });
    const serviceUser = db.serviceUsers.get(body.service_user_id);
    if (!serviceUser || serviceUser.agencyId !== manager.agencyId) {
      return sendJson(res, 404, { error: "Service user not found for care manager" });
    }
    const plan = buildAiTaskPlan(serviceUser, body);
    db.audit.push(auditEvent("ai.task_plan", "AI task plan generated from care note", { managerId: manager.id, serviceUserId: serviceUser.id, category: plan.category }));
    return sendJson(res, 200, plan);
  }

  if (req.method === "POST" && pathname === "/api/care/tasks") {
    const body = await readJson(req);
    const manager = verifySessionToken(body.sessionToken, body.managerEmail, "care");
    if (!manager) return sendJson(res, 401, { error: "Care manager session not recognised" });
    const agency = db.agencies.get(manager.agencyId);
    const result = await createTaskFromCarePayload(agency, body);
    if (result.error) return sendJson(res, result.status, { error: result.error });
    return sendJson(res, 201, result);
  }

  if (req.method === "POST" && pathname === "/api/webhooks/incoming-care-task") {
    const agency = requireAgencyAuth(req);
    if (!agency) return sendJson(res, 401, { error: "Invalid agency bearer token" });
    const body = await readJson(req);
    const serviceUser = db.serviceUsers.get(body.service_user_id);
    if (!serviceUser || serviceUser.agencyId !== agency.id) {
      return sendJson(res, 404, { error: "Service user not found for agency" });
    }
    const result = await createTaskFromCarePayload(agency, body);
    if (result.error) return sendJson(res, result.status, { error: result.error });
    db.audit.push(auditEvent("webhook.received", `Inbound care webhook processed for ${agency.name}`, { taskId: result.task.id }));
    return sendJson(res, 201, result);
  }

  if (req.method === "POST" && pathname === "/api/webhooks/amiqus-callback") {
    const body = await readJson(req);
    if (body.event !== "session.completed") return sendJson(res, 202, { ignored: true });
    const trader = [...db.traders.values()].find((item) => item.amiqusSessionId === body.session_id);
    if (!trader) return sendJson(res, 404, { error: "DBS verification session not mapped to a trader" });
    trader.dbsStatus = body.outcome === "clear" ? "Approved" : "Rejected";
    trader.dbsExpiryDate = trader.dbsStatus === "Approved" ? body.expires_at || oneYearFromNow() : null;
    trader.lastCheckedAt = new Date().toISOString();
    db.audit.push(auditEvent("dbs.updated", `${trader.name} marked ${trader.dbsStatus} via DBS verification callback`, { traderId: trader.id }));
    return sendJson(res, 200, { trader });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/traders\/[^/]+\/(?:dbs-check|amiqus-check)$/)) {
    const body = await readJson(req);
    const admin = requireTaskBridgeAdminSession(body.actorEmail, body.sessionToken);
    if (!admin) return sendJson(res, 403, { error: "TaskBridge admin access required to trigger DBS checks" });
    const traderId = pathname.split("/")[3];
    const trader = db.traders.get(traderId);
    if (!trader) return sendJson(res, 404, { error: "Trader not found" });
    const session = await createAmiqusSession(trader);
    trader.amiqusSessionId = session.id;
    trader.dbsStatus = "Pending";
    trader.lastCheckedAt = new Date().toISOString();
    db.audit.push(auditEvent("dbs.session.created", `DBS verification started for ${trader.name} by ${admin.name}`, { traderId, sessionId: session.id, adminId: admin.id }));
    return sendJson(res, 200, { trader, session });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/admin\/traders\/[^/]+\/approve-dbs$/)) {
    const body = await readJson(req);
    const admin = requireTaskBridgeAdminSession(body.actorEmail, body.sessionToken);
    if (!admin) return sendJson(res, 403, { error: "TaskBridge admin access required to approve Enhanced DBS" });
    const traderId = pathname.split("/")[4];
    const trader = db.traders.get(traderId);
    if (!trader) return sendJson(res, 404, { error: "Trader not found" });
    trader.dbsStatus = "Approved";
    trader.dbsExpiryDate = body.expiresAt || oneYearFromNow();
    trader.lastCheckedAt = new Date().toISOString();
    db.audit.push(auditEvent("dbs.admin_approved", `${admin.name} approved Enhanced DBS for ${trader.name}`, { traderId, adminId: admin.id }));
    return sendJson(res, 200, { trader });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/(?:taskbridge|safehome)\/tasks\/[^/]+\/dispatch$/)) {
    const body = await readJson(req);
    const admin = requireTaskBridgeAdminSession(body.actorEmail, body.sessionToken);
    if (!admin) return sendJson(res, 403, { error: "TaskBridge admin access required to approve handyman assignment" });
    const taskId = pathname.split("/")[4];
    const task = db.tasks.get(taskId);
    if (!task) return sendJson(res, 404, { error: "Task not found" });
    if (task.status !== "Triaged") return sendJson(res, 409, { error: "Only triaged tasks can be approved for dispatch" });
    if (task.assignmentStatus === "Blocked") return sendJson(res, 409, { error: task.paymentStatus || "Task is blocked and requires admin review" });
    const serviceUser = db.serviceUsers.get(task.serviceUserId);
    const agency = db.agencies.get(serviceUser.agencyId);
    const capCheck = checkAgencyPaymentCap(agency, task.estimatedCustomerCharge || estimateTaskCharge(task.category));
    if (!capCheck.allowed) {
      task.assignmentStatus = "Blocked";
      task.paymentStatus = "Agency cap exceeded";
      task.capCheck = capCheck;
      db.audit.push(auditEvent("dispatch.blocked.cap", "Agency monthly payment cap blocked task release", { taskId, capCheck, adminId: admin.id }));
      return sendJson(res, 409, { error: "Agency monthly cap would be exceeded. Increase cap or approve an override before dispatch.", capCheck });
    }
    const eligible = findEligibleTraders(serviceUser, task.ringFenceEnforced, task.carerOnSite, task.category, task.preferredWindow);
    if (!eligible.length) {
      db.audit.push(auditEvent("dispatch.blocked", "No eligible trader matched safeguarding, proximity, service and availability rules", { taskId }));
      return sendJson(res, 409, { error: "No eligible trader matched safeguarding, proximity, service and availability rules", ringFenceEnforced: task.ringFenceEnforced });
    }
    const trader = eligible[0];
    const receipt = await dispatchToMarketplace(task, serviceUser, trader);
    task.assignedTraderId = trader.id;
    task.status = "Dispatched";
    task.marketplace = trader.source;
    task.dispatchReceipt = receipt.receiptId;
    task.token = signVisitToken(task.id, trader.id);
    task.supervisedVisitRequired = Boolean(task.ringFenceEnforced && task.carerOnSite);
    task.assignmentStatus = "Assigned";
    task.paymentStatus = "Authorised";
    agency.monthlyCommittedSpend = Number((Number(agency.monthlyCommittedSpend || 0) + Number(task.estimatedCustomerCharge || 0)).toFixed(2));
    db.audit.push(auditEvent("task.dispatched", `${admin.name} approved handyman assignment via ${trader.source} private pool`, { taskId, traderId: trader.id, receipt: receipt.receiptId, adminId: admin.id, capCheck }));
    return sendJson(res, 200, { task, trader, receipt, smsLink: `/visit/${task.id}?token=${encodeURIComponent(task.token)}` });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/visit\/[^/]+\/check-in$/)) {
    const taskId = pathname.split("/")[3];
    const task = db.tasks.get(taskId);
    const body = await readJson(req);
    if (!verifyVisitToken(params.get("token"), task)) return sendJson(res, 403, { error: "Invalid or expired visit token" });
    const serviceUser = db.serviceUsers.get(task.serviceUserId);
    const miles = haversineMiles(serviceUser.lat, serviceUser.lng, Number(body.lat), Number(body.lng));
    if (miles > 0.25) return sendJson(res, 422, { error: "Check-in outside approved geofence", miles: Number(miles.toFixed(3)) });
    task.status = "Checked-In";
    task.checkInTime = new Date().toISOString();
    task.checkInLat = Number(body.lat);
    task.checkInLng = Number(body.lng);
    db.audit.push(auditEvent("visit.checked_in", "Geofenced trader check-in accepted", { taskId, miles }));
    return sendJson(res, 200, { task, miles });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/visit\/[^/]+\/complete$/)) {
    const taskId = pathname.split("/")[3];
    const task = db.tasks.get(taskId);
    const body = await readJson(req);
    if (!verifyVisitToken(params.get("token"), task)) return sendJson(res, 403, { error: "Invalid or expired visit token" });
    task.status = "Awaiting Confirmation";
    task.afterPhotoUrl = body.afterPhotoUrl || "local-upload://after-photo-captured";
    task.checkOutTime = new Date().toISOString();
    task.completionConfirmationStatus = "Awaiting care confirmation";
    db.audit.push(auditEvent("visit.awaiting_confirmation", "Trader checkout received; care confirmation required before final closure", { taskId }));
    return sendJson(res, 200, { task, callback: "held_until_care_confirmation" });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/care\/tasks\/[^/]+\/confirm-completion$/)) {
    const body = await readJson(req);
    const manager = verifySessionToken(body.sessionToken, body.managerEmail);
    if (!manager) return sendJson(res, 401, { error: "Care or admin session not recognised" });
    const taskId = pathname.split("/")[4];
    const task = db.tasks.get(taskId);
    if (!task) return sendJson(res, 404, { error: "Task not found" });
    const serviceUser = db.serviceUsers.get(task.serviceUserId);
    if (manager.accessLevel !== "admin" && serviceUser.agencyId !== manager.agencyId) {
      return sendJson(res, 403, { error: "Cannot confirm a task outside your agency" });
    }
    if (task.status !== "Awaiting Confirmation") return sendJson(res, 409, { error: "Task is not awaiting care confirmation" });
    task.status = "Completed";
    task.completionConfirmationStatus = "Confirmed";
    task.confirmedBy = manager.id;
    task.confirmedAt = new Date().toISOString();
    const agency = db.agencies.get(serviceUser.agencyId);
    db.audit.push(auditEvent("visit.completed", "Care confirmation completed and webhook fired back to care agency", { taskId, agencyWebhook: agency.webhookUrl, managerId: manager.id }));
    return sendJson(res, 200, { task, callback: "queued" });
  }

  return sendJson(res, 404, { error: "Route not found" });
}

function sanitizeManager(manager) {
  const { password, ...safeManager } = manager;
  return safeManager;
}

function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

async function createAmiqusSession(trader) {
  if (!USE_REAL_PARTNER_APIS) {
    return {
      id: `amq_sess_${randomBytes(5).toString("hex")}`,
      mode: "mock",
      status: "created",
      subject: trader.name
    };
  }
  const response = await fetch("https://api.amiqus.co/v1/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.AMIQUS_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ subject: { name: trader.name, mobile: trader.mobile }, checks: ["enhanced_dbs"] })
  });
  if (!response.ok) throw new Error(`Amiqus API failed: ${response.status}`);
  return response.json();
}

async function dispatchToMarketplace(task, serviceUser, trader) {
  const payload = {
    restricted: true,
    trader_id: trader.marketplaceTraderId,
    category: task.category,
    notes: task.careWorkerNotes,
    approximate_location: { lat: serviceUser.lat, lng: serviceUser.lng },
    pii_policy: "client-contact-redacted-tokenized-twilio"
  };

  if (!USE_REAL_PARTNER_APIS) {
    return {
      mode: "mock",
      provider: trader.source,
      receiptId: `${trader.source}_booking_${randomBytes(3).toString("hex")}`,
      payload
    };
  }

  const url = trader.source === "checkatrade"
    ? "https://api.checkatrade.com/api/v1/dispatched-jobs"
    : "https://api.taskrabbit.co/v3/restricted-booking";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MARKETPLACE_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Marketplace API failed: ${response.status}`);
  const body = await response.json();
  return { provider: trader.source, receiptId: body.id || body.receiptId, payload };
}

function estimateTaskCharge(category) {
  const baseFees = {
    "Garden Path Clearing": 90,
    "Appliance Safety": 110,
    "Lock Repairs": 95,
    "Loose Rails": 120,
    "Deep Cleaning": 100,
    "Trip Hazard Removal": 85,
    "Lawn Mowing": 75,
    "Garden Clearance": 105,
    "Window Cleaning": 80
  };
  const handymanFee = baseFees[category] || 90;
  return Number((handymanFee * (1 + TASKBRIDGE_PLATFORM_FEE_RATE + AGENCY_SERVICE_FEE_RATE)).toFixed(2));
}

function checkAgencyPaymentCap(agency, amount) {
  const cap = Number(agency.monthlyCap || 0);
  const committed = Number(agency.monthlyCommittedSpend || 0);
  const projected = Number((committed + Number(amount || 0)).toFixed(2));
  return {
    allowed: !cap || projected <= cap,
    cap,
    committed,
    requested: Number(amount || 0),
    projected,
    remaining: Number(Math.max(0, cap - committed).toFixed(2))
  };
}

function hasActiveEnhancedDbs(trader) {
  if (trader.dbsStatus !== "Approved") return false;
  if (!trader.dbsExpiryDate) return false;
  return new Date(`${trader.dbsExpiryDate}T23:59:59.999Z`) >= new Date();
}

function hasVerifiedInsurance(trader) {
  if (trader.insuranceStatus !== "Verified") return false;
  if (!trader.insuranceExpiryDate) return false;
  return new Date(`${trader.insuranceExpiryDate}T23:59:59.999Z`) >= new Date();
}

function hasRequiredQualification(trader, category) {
  const requiredByCategory = {
    "Appliance Safety": "appliance-safety",
    "Lock Repairs": "minor-repairs",
    "Loose Rails": "minor-repairs"
  };
  const required = requiredByCategory[category];
  return !required || trader.qualifications?.includes(required);
}

function buildAiTaskPlan(serviceUser, body) {
  const notes = String(body.notes || "");
  const taskNotes = splitCareNoteIntoTasks(notes);
  const carerOnSite = Boolean(body.carerOnSite);
  const preferredWindow = body.preferredWindow || "Next available";
  const tasks = taskNotes.map((taskNote) => {
    const lower = taskNote.toLowerCase();
    const category = inferCategory(lower);
    return {
      summary: summarizeCareNote(taskNote, category),
      category,
      urgency: inferUrgency(lower),
      notes: taskNote,
      assignmentStatus: "Pending TaskBridge admin assignment"
    };
  });
  return {
    summary: tasks.length > 1 ? `${tasks.length} separate handyman tasks identified from the care note.` : tasks[0]?.summary || "No task identified.",
    category: tasks[0]?.category || "Trip Hazard Removal",
    urgency: tasks.some((task) => task.urgency === "High") ? "High" : tasks.some((task) => task.urgency === "Medium") ? "Medium" : "Low",
    tasks,
    preferredWindow,
    carerOnSite,
    safeguarding: serviceUser.isVulnerable
      ? carerOnSite
        ? "Vulnerable adult: TaskBridge admin approval is required. Enhanced DBS remains mandatory before assignment; carer-on-site supervision is recorded as an extra control."
        : "Vulnerable adult: TaskBridge admin approval is required and only active Enhanced DBS approved handymen can be assigned."
      : "TaskBridge admin approval is required before an eligible handyman is dispatched."
  };
}

function splitCareNoteIntoTasks(notes) {
  const cleaned = String(notes || "").trim();
  if (!cleaned) return ["Home safety task requires assessment and remediation."];
  const parts = cleaned
    .split(/\s*(?:\n+|;|\.\s+|,\s+and\s+|\s+and\s+also\s+|\s+also\s+|\s+plus\s+)\s*/i)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter((part) => part.length > 8);
  const merged = [];
  for (const part of parts.length ? parts : [cleaned]) {
    const category = inferCategory(part.toLowerCase());
    const existing = merged.find((item) => inferCategory(item.toLowerCase()) === category);
    existing ? merged[merged.indexOf(existing)] = `${existing}. ${part}` : merged.push(part);
  }
  return merged.slice(0, 6);
}

function inferCategory(lower) {
  const rules = [
    ["Window Cleaning", ["window", "glass", "sill"]],
    ["Lawn Mowing", ["lawn", "grass", "mowing", "overgrown"]],
    ["Garden Path Clearing", ["garden", "path", "moss", "leaf", "leaves", "weed", "hedge"]],
    ["Loose Rails", ["rail", "handrail", "grab rail", "banister"]],
    ["Lock Repairs", ["lock", "key", "door"]],
    ["Appliance Safety", ["oven", "fridge", "appliance", "smoke", "carbon monoxide"]],
    ["Deep Cleaning", ["clean", "grease", "clutter"]],
    ["Trip Hazard Removal", ["trip", "fall", "carpet", "rug", "threshold", "floor"]]
  ];
  return rules.find(([, terms]) => terms.some((term) => lower.includes(term)))?.[0] || "Trip Hazard Removal";
}

function inferUrgency(lower) {
  if (["urgent", "fell", "fall", "unsafe", "immediate", "today", "blocked"].some((term) => lower.includes(term))) return "High";
  if (["soon", "risk", "loose", "slippery", "smoke"].some((term) => lower.includes(term))) return "Medium";
  return "Low";
}

function summarizeCareNote(notes, category) {
  const cleaned = notes.trim().replace(/\s+/g, " ");
  const shortNote = cleaned.length > 130 ? `${cleaned.slice(0, 127)}...` : cleaned;
  return `${category}: ${shortNote || "Home safety task requires assessment and remediation."}`;
}

function findEligibleTraders(serviceUser, ringFenceEnforced, carerOnSite = false, category = "", preferredWindow = "") {
  return [...db.traders.values()]
    .map((trader) => ({
      ...trader,
      distanceMiles: haversineMiles(serviceUser.lat, serviceUser.lng, trader.lat, trader.lng),
      serviceFit: trader.services?.includes(category) ? 1 : 0,
      activeEnhancedDbs: hasActiveEnhancedDbs(trader),
      insuranceVerified: hasVerifiedInsurance(trader),
      qualifiedForTask: hasRequiredQualification(trader, category)
    }))
    .filter((trader) => trader.distanceMiles < 15)
    .filter((trader) => trader.serviceFit === 1)
    .filter((trader) => trader.insuranceVerified)
    .filter((trader) => trader.qualifiedForTask)
    .filter((trader) => !ringFenceEnforced || trader.activeEnhancedDbs)
    .sort((a, b) => {
      const dbsScore = (b.activeEnhancedDbs ? 1 : 0) - (a.activeEnhancedDbs ? 1 : 0);
      if (dbsScore) return dbsScore;
      const serviceScore = b.serviceFit - a.serviceFit;
      if (serviceScore) return serviceScore;
      const qualityScore = Number(b.qualityScore || 0) - Number(a.qualityScore || 0);
      if (qualityScore) return qualityScore;
      const availabilityScore = availabilityRank(a.nextAvailable, preferredWindow) - availabilityRank(b.nextAvailable, preferredWindow);
      if (availabilityScore) return availabilityScore;
      const priceScore = a.hourlyRate - b.hourlyRate;
      if (priceScore) return priceScore;
      return a.distanceMiles - b.distanceMiles;
    });
}

function availabilityRank(nextAvailable, preferredWindow) {
  const preferred = String(preferredWindow || "").toLowerCase();
  const next = String(nextAvailable || "").toLowerCase();
  if (preferred.includes("today") && next.includes("today")) return 3;
  if (preferred.includes("tomorrow") && next.includes("tomorrow")) return 3;
  if (next.includes("today")) return 2;
  if (next.includes("tomorrow")) return 1;
  return 0;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" || pathname.startsWith("/visit/") || !extname(pathname)) pathname = "/index.html";
  const candidate = normalize(join(__dirname, "public", pathname));
  const publicRoot = normalize(join(__dirname, "public"));
  if (!candidate.startsWith(publicRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(candidate);
    res.writeHead(200, { "content-type": mimeTypes[extname(candidate)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) return await handleApi(req, res);
    return await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Internal server error", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`TaskBridge running at http://localhost:${PORT}`);
});

