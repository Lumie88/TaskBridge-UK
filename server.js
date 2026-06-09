import { createServer } from "node:http";
import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const ENCRYPTION_KEY = Buffer.from(process.env.TASKBRIDGE_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef");
const SIGNING_SECRET = process.env.TASKBRIDGE_SIGNING_SECRET || "dev-taskbridge-signing-secret";
const USE_REAL_PARTNER_APIS = process.env.USE_REAL_PARTNER_APIS === "true";

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
    webhookUrl: "https://partner.example.local/birdie/webhooks/TaskBridge"
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
      marketplace: "taskrabbit"
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
      marketplace: null
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
          password: "demo12345",
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
          password: "admin12345",
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

function publicState() {
  const serviceUsers = [...db.serviceUsers.values()].map((user) => ({
    ...user,
    name: decryptField(user.name),
    address: decryptField(user.address)
  }));
  const tasks = [...db.tasks.values()].map((task) => {
    const serviceUser = serviceUsers.find((user) => user.id === task.serviceUserId);
    const trader = db.traders.get(task.assignedTraderId);
    return {
      ...task,
      serviceUser,
      assignedTrader: trader || null,
      tokenUrl: task.assignedTraderId ? `/visit/${task.id}?token=${encodeURIComponent(task.token)}` : null
    };
  });
  const vulnerableCases = serviceUsers.filter((user) => user.isVulnerable).length;
  return {
    agencies: [...db.agencies.values()].map(({ apiKey, ...agency }) => agency),
    serviceUsers,
    traders: [...db.traders.values()],
    tasks,
    audit: db.audit.slice(-12).reverse(),
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
    marketplace: null
  };
  task.token = signVisitToken(task.id, "unassigned");
  db.tasks.set(task.id, task);
  db.audit.push(auditEvent("task.triaged", `Care manager task accepted from ${agency.name}`, { taskId: task.id, ringFence: task.ringFenceEnforced }));
  await autoAssignTask(task, serviceUser);
  results.push(task);
  }
  return {
    task: results[0],
    tasks: results,
    safeguard: results[0].ringFenceEnforced
      ? results[0].supervisedVisitRequired
        ? "Digital Ring-Fence active: Enhanced DBS preferred; non-DBS requires carer-on-site supervised appointment"
        : "Digital Ring-Fence active: Enhanced DBS required"
      : "Standard marketplace rules",
    assignmentSummary: results.map((task) => ({
      taskId: task.id,
      status: task.status === "Dispatched" ? "Assigned" : "Pending assignment",
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
    return sendJson(res, 200, publicState());
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
    if (db.careManagers.has(email)) return sendJson(res, 409, { error: "An account already exists for this email" });
    const agencyId = String(body.agencyId || "birdie-london");
    const agency = db.agencies.get(agencyId) || [...db.agencies.values()][0];
    const manager = {
      id: `cm_${randomBytes(3).toString("hex")}`,
      name: String(body.name || "Care Manager").slice(0, 120),
      email,
      password: String(body.password).slice(0, 120),
      role: ["Care Manager", "Care Coordinator"].includes(body.role) ? body.role : "Care Coordinator",
      accessLevel: "care",
      agencyId: agency.id
    };
    db.careManagers.set(email, manager);
    db.audit.push(auditEvent("auth.signup", `${manager.name} joined ${agency.name}`, { managerId: manager.id }));
    return sendJson(res, 201, { user: sanitizeManager(manager), agency: { id: agency.id, name: agency.name } });
  }

  if (req.method === "POST" && pathname === "/api/auth/signin") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const manager = db.careManagers.get(email);
    if (!manager || manager.password !== String(body.password || "")) return sendJson(res, 401, { error: "Invalid care manager credentials" });
    if (manager.accessLevel !== "care") return sendJson(res, 403, { error: "Use the TaskBridge admin access point" });
    const agency = db.agencies.get(manager.agencyId);
    db.audit.push(auditEvent("auth.signin", `${manager.name} signed in`, { managerId: manager.id }));
    return sendJson(res, 200, { user: sanitizeManager(manager), agency: { id: agency.id, name: agency.name } });
  }

  if (req.method === "POST" && pathname === "/api/auth/admin-signin") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const admin = db.careManagers.get(email);
    if (!admin || admin.password !== String(body.password || "") || admin.accessLevel !== "admin") {
      return sendJson(res, 401, { error: "Invalid TaskBridge admin credentials" });
    }
    const agency = db.agencies.get(admin.agencyId);
    db.audit.push(auditEvent("auth.admin_signin", `${admin.name} signed in to admin`, { adminId: admin.id }));
    return sendJson(res, 200, { user: sanitizeManager(admin), agency: { id: agency.id, name: agency.name } });
  }

  if (req.method === "POST" && pathname === "/api/ai/task-plan") {
    const body = await readJson(req);
    const manager = db.careManagers.get(String(body.managerEmail || "").trim().toLowerCase());
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
    const manager = db.careManagers.get(String(body.managerEmail || "").trim().toLowerCase());
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
    if (!trader) return sendJson(res, 404, { error: "Amiqus session not mapped to a trader" });
    trader.dbsStatus = body.outcome === "clear" ? "Approved" : "Rejected";
    trader.dbsExpiryDate = trader.dbsStatus === "Approved" ? body.expires_at || oneYearFromNow() : null;
    trader.lastCheckedAt = new Date().toISOString();
    db.audit.push(auditEvent("dbs.updated", `${trader.name} marked ${trader.dbsStatus} via Amiqus callback`, { traderId: trader.id }));
    return sendJson(res, 200, { trader });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/traders\/[^/]+\/amiqus-check$/)) {
    const body = await readJson(req);
    const admin = requireTaskBridgeAdmin(body.actorEmail);
    if (!admin) return sendJson(res, 403, { error: "TaskBridge admin access required to trigger DBS checks" });
    const traderId = pathname.split("/")[3];
    const trader = db.traders.get(traderId);
    if (!trader) return sendJson(res, 404, { error: "Trader not found" });
    const session = await createAmiqusSession(trader);
    trader.amiqusSessionId = session.id;
    trader.dbsStatus = "Pending";
    trader.lastCheckedAt = new Date().toISOString();
    db.audit.push(auditEvent("amiqus.session.created", `Amiqus check triggered for ${trader.name} by ${admin.name}`, { traderId, sessionId: session.id, adminId: admin.id }));
    return sendJson(res, 200, { trader, session });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/admin\/traders\/[^/]+\/approve-dbs$/)) {
    const body = await readJson(req);
    const admin = requireTaskBridgeAdmin(body.actorEmail);
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
    const admin = requireTaskBridgeAdmin(body.actorEmail);
    if (!admin) return sendJson(res, 403, { error: "TaskBridge admin access required to approve handyman assignment" });
    const taskId = pathname.split("/")[4];
    const task = db.tasks.get(taskId);
    if (!task) return sendJson(res, 404, { error: "Task not found" });
    const serviceUser = db.serviceUsers.get(task.serviceUserId);
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
    task.supervisedVisitRequired = Boolean(task.ringFenceEnforced && trader.dbsStatus !== "Approved");
    db.audit.push(auditEvent("task.dispatched", `${admin.name} approved handyman assignment via ${trader.source} private pool`, { taskId, traderId: trader.id, receipt: receipt.receiptId, adminId: admin.id }));
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
    task.status = "Completed";
    task.afterPhotoUrl = body.afterPhotoUrl || "local-upload://after-photo-captured";
    task.checkOutTime = new Date().toISOString();
    db.audit.push(auditEvent("visit.completed", "Completion webhook fired back to care agency", { taskId, agencyWebhook: db.agencies.get(db.serviceUsers.get(task.serviceUserId).agencyId).webhookUrl }));
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

async function autoAssignTask(task, serviceUser) {
  const eligible = findEligibleTraders(serviceUser, task.ringFenceEnforced, task.carerOnSite, task.category, task.preferredWindow);
  if (!eligible.length) {
    task.assignmentStatus = "Pending assignment";
    db.audit.push(auditEvent("assignment.pending", "Automated assignment could not find an eligible handyman", { taskId: task.id }));
    return task;
  }
  const trader = eligible[0];
  const receipt = await dispatchToMarketplace(task, serviceUser, trader);
  task.assignedTraderId = trader.id;
  task.status = "Dispatched";
  task.marketplace = trader.source;
  task.dispatchReceipt = receipt.receiptId;
  task.token = signVisitToken(task.id, trader.id);
  task.supervisedVisitRequired = Boolean(task.ringFenceEnforced && trader.dbsStatus !== "Approved");
  task.assignmentStatus = "Assigned";
  db.audit.push(auditEvent("assignment.automated", `Automated assignment selected ${trader.name}`, { taskId: task.id, traderId: trader.id, receipt: receipt.receiptId }));
  return task;
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
      assignmentStatus: "Pending automated assignment"
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
        ? "Vulnerable adult: TaskBridge will automate assignment. Enhanced DBS is preferred; a non-DBS trader is only permitted when a carer is on site for the whole visit."
        : "Vulnerable adult: TaskBridge will only auto-assign an Enhanced DBS approved handyman."
      : "TaskBridge will automatically assign an eligible handyman."
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
      supervisedException: Boolean(ringFenceEnforced && trader.dbsStatus !== "Approved" && carerOnSite)
    }))
    .filter((trader) => trader.distanceMiles < 15)
    .filter((trader) => !ringFenceEnforced || trader.dbsStatus === "Approved" || (carerOnSite && trader.dbsStatus !== "Rejected"))
    .sort((a, b) => {
      const dbsScore = (b.dbsStatus === "Approved" ? 1 : 0) - (a.dbsStatus === "Approved" ? 1 : 0);
      if (dbsScore) return dbsScore;
      const serviceScore = b.serviceFit - a.serviceFit;
      if (serviceScore) return serviceScore;
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

