import "dotenv/config";
import pg from "pg";
import { createOpaqueToken, encryptField, hashPassword, hashToken } from "../server/security.js";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error("Set ALLOW_DEMO_SEED=true to load development seed data");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const coordinatorPassword = process.env.SEED_COORDINATOR_PASSWORD || "CoordinatorDemo!2026";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminDemo!2026";
const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || "SuperAdminDemo!2026";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const agency = await client.query<{ id: string }>(
    `INSERT INTO tenant.agencies
      (public_id, name, slug, primary_contact_name, primary_contact_email, work_email_domain, status)
     VALUES ('agc_primrose', 'Primrose Care Services', 'primrose-care-services', 'Sarah Jenkins',
             'sarah.jenkins@primrose.org', 'primrose.org', 'active')
     ON CONFLICT (slug) DO UPDATE SET status = 'active'
     RETURNING id::text`
  );
  const agencyId = agency.rows[0].id;
  await client.query("INSERT INTO tenant.agency_settings (agency_id) VALUES ($1) ON CONFLICT (agency_id) DO NOTHING", [agencyId]);
  const demoAgencyApiKey = `tb_demo_${createOpaqueToken(32)}`;
  await client.query(
    `INSERT INTO tenant.agency_api_keys
      (agency_id, name, key_prefix, key_hash, key_length, scopes)
     VALUES ($1, 'Demo integration key', 'tb_demo_primrose', $2, $3, ARRAY['tasks:write']::text[])
     ON CONFLICT (key_prefix) DO UPDATE SET
       key_hash = EXCLUDED.key_hash, key_length = EXCLUDED.key_length, revoked_at = NULL`,
    [agencyId, hashToken(demoAgencyApiKey), demoAgencyApiKey.length]
  );
  await client.query(
    `INSERT INTO auth.users (agency_id, full_name, email, password_hash, role, status)
     VALUES ($1, 'Sarah Jenkins', 'sarah.jenkins@primrose.org', $2, 'care_coordinator', 'active')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'`,
    [agencyId, await hashPassword(coordinatorPassword)]
  );
  await client.query(
    `INSERT INTO auth.users (full_name, email, password_hash, role, status)
     VALUES ('James Carter', 'james.carter@taskbridge.co.uk', $1, 'taskbridge_admin', 'active')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'`,
    [await hashPassword(adminPassword)]
  );
  await client.query(
    `INSERT INTO auth.users (full_name, email, password_hash, role, status)
     VALUES ('Alex Morgan', 'alex.morgan@taskbridge.co.uk', $1, 'taskbridge_super_admin', 'active')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'`,
    [await hashPassword(superAdminPassword)]
  );

  const residents = [
    { externalId: "SU-1001", name: "Margaret Knowles", address: "104 Orchard Lane", town: "London", county: "Greater London", postcode: "SW1A 1AA", risk: "vulnerable_adult", lat: 51.5014, lng: -0.1419 },
    { externalId: "SU-1002", name: "Ronald Sutherland", address: "22 Meadow Close", town: "London", county: "Greater London", postcode: "SW1Y 4QQ", risk: "standard", lat: 51.5074, lng: -0.1278 }
  ];
  for (const resident of residents) {
    await client.query(
      `INSERT INTO care.service_users
        (agency_id, external_service_user_id, encrypted_name, encrypted_address, postcode_hash,
         town_ciphertext, county_ciphertext, postcode_ciphertext, latitude, longitude, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (agency_id, external_service_user_id) DO UPDATE SET
         encrypted_name = EXCLUDED.encrypted_name,
         encrypted_address = EXCLUDED.encrypted_address,
         town_ciphertext = EXCLUDED.town_ciphertext,
         county_ciphertext = EXCLUDED.county_ciphertext,
         postcode_ciphertext = EXCLUDED.postcode_ciphertext,
         postcode_hash = EXCLUDED.postcode_hash,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         risk_level = EXCLUDED.risk_level`,
      [agencyId, resident.externalId, encryptField(resident.name), encryptField(resident.address),
        hashToken(resident.postcode.replace(/\s+/g, "")), encryptField(resident.town), encryptField(resident.county),
        encryptField(resident.postcode), resident.lat, resident.lng, resident.risk]
    );
  }

  let network = await client.query<{ id: string }>("SELECT id::text FROM trader.networks WHERE name = 'TaskBridge Vetted Local Network'");
  if (!network.rows[0]) {
    network = await client.query<{ id: string }>(
      "INSERT INTO trader.networks (name, external_reference) VALUES ('TaskBridge Vetted Local Network', 'demo-network') RETURNING id::text"
    );
  }
  const networkId = network.rows[0].id;
  const traders = [
    { externalId: "TRD-001", name: "David Miller", mobile: "+447700900077", lat: 51.502, lng: -0.139, rate: 42, quality: 96, dbs: "approved", dbsExpiry: "2028-04-12", insurance: "verified", insuranceExpiry: "2028-05-31", services: ["Path clearing", "Trip hazard removal", "Garden clearance"] },
    { externalId: "TRD-002", name: "George Sterling", mobile: "+447700900188", lat: 51.509, lng: -0.134, rate: 36, quality: 91, dbs: "pending", dbsExpiry: null, insurance: "verified", insuranceExpiry: "2027-09-30", services: ["Loose rail repair", "Lock repairs"] },
    { externalId: "TRD-003", name: "Nadia Clarke", mobile: "+447700900244", lat: 51.495, lng: -0.151, rate: 39, quality: 94, dbs: "approved", dbsExpiry: "2027-12-22", insurance: "verified", insuranceExpiry: "2027-12-31", services: ["Lawn mowing", "Garden clearance", "Window cleaning"] }
  ];
  for (const trader of traders) {
    const traderResult = await client.query<{ id: string }>(
      `INSERT INTO trader.traders
        (network_id, external_trader_id, display_name, encrypted_full_name, encrypted_mobile,
         latitude, longitude, postcode_area, hourly_rate, quality_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SW1', $8, $9, 'active')
       ON CONFLICT (network_id, external_trader_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         encrypted_mobile = EXCLUDED.encrypted_mobile,
         hourly_rate = EXCLUDED.hourly_rate,
         quality_score = EXCLUDED.quality_score,
         status = 'active'
       RETURNING id::text`,
      [networkId, trader.externalId, trader.name, encryptField(trader.name), encryptField(trader.mobile),
        trader.lat, trader.lng, trader.rate, trader.quality]
    );
    const traderId = traderResult.rows[0].id;
    for (const service of trader.services) {
      await client.query(
        "INSERT INTO trader.trader_services (trader_id, service_category) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [traderId, service]
      );
    }
    const latestDbs = await client.query("SELECT 1 FROM trader.dbs_verifications WHERE trader_id = $1", [traderId]);
    if (!latestDbs.rowCount) {
      await client.query(
        `INSERT INTO trader.dbs_verifications (trader_id, status, expiry_date, checked_at)
         VALUES ($1, $2::trader.dbs_status, $3,
                 CASE WHEN $2::text = 'approved' THEN clock_timestamp() ELSE NULL END)`,
        [traderId, trader.dbs, trader.dbsExpiry]
      );
    }
    const latestInsurance = await client.query("SELECT 1 FROM trader.insurance_records WHERE trader_id = $1", [traderId]);
    if (!latestInsurance.rowCount) {
      await client.query(
        `INSERT INTO trader.insurance_records (trader_id, status, expiry_date, verified_at)
         VALUES ($1, $2, $3, clock_timestamp())`,
        [traderId, trader.insurance, trader.insuranceExpiry]
      );
    }
    await client.query(
      `INSERT INTO trader.trader_availability (trader_id, available_from, available_to)
       SELECT $1, clock_timestamp() - interval '1 hour', clock_timestamp() + interval '14 days'
       WHERE NOT EXISTS (
         SELECT 1 FROM trader.trader_availability WHERE trader_id = $1 AND available_to > clock_timestamp()
       )`,
      [traderId]
    );
  }

  const coordinator = await client.query<{ id: string }>(
    "SELECT id::text FROM auth.users WHERE email = 'sarah.jenkins@primrose.org'"
  );
  const residentRows = await client.query<{ id: string; external_service_user_id: string }>(
    `SELECT id::text, external_service_user_id FROM care.service_users
     WHERE agency_id = $1 AND external_service_user_id IN ('SU-1001', 'SU-1002')`,
    [agencyId]
  );
  const traderRows = await client.query<{ id: string; external_trader_id: string }>(
    `SELECT id::text, external_trader_id FROM trader.traders
     WHERE external_trader_id IN ('TRD-001', 'TRD-002', 'TRD-003')`
  );
  const residentIds = Object.fromEntries(residentRows.rows.map((row) => [row.external_service_user_id, row.id]));
  const traderIds = Object.fromEntries(traderRows.rows.map((row) => [row.external_trader_id, row.id]));
  const taskFixtures = [
    {
      publicId: "tsk_demo_path",
      resident: "SU-1001",
      category: "Path clearing",
      urgency: "high",
      status: "pending_taskbridge_assignment",
      summary: "Remove moss and clear the rear path to reduce the risk of a fall.",
      note: "The rear path is slippery with moss and needs clearing before the next home visit.",
      vulnerable: true,
      trader: null,
      visitStatus: null
    },
    {
      publicId: "tsk_demo_lock",
      resident: "SU-1002",
      category: "Lock repairs",
      urgency: "medium",
      status: "dispatched",
      summary: "Repair the sticking front-door lock and confirm safe operation.",
      note: "The front-door lock is sticking. Please arrange a repair during an afternoon visit.",
      vulnerable: false,
      trader: "TRD-002",
      visitStatus: "link_sent"
    },
    {
      publicId: "tsk_demo_window",
      resident: "SU-1001",
      category: "Window cleaning",
      urgency: "medium",
      status: "awaiting_care_confirmation",
      summary: "Clean the ground-floor windows and remove the external obstruction.",
      note: "The ground-floor windows have been cleaned. Completion evidence is ready for care-team review.",
      vulnerable: true,
      trader: "TRD-003",
      visitStatus: "evidence_submitted"
    },
    {
      publicId: "tsk_demo_garden",
      resident: "SU-1001",
      category: "Garden clearance",
      urgency: "low",
      status: "completed",
      summary: "Clear garden access around the rear step and remove loose cuttings.",
      note: "Garden access was cleared and confirmed by the care team.",
      vulnerable: true,
      trader: "TRD-001",
      visitStatus: "confirmed"
    }
  ];

  for (const fixture of taskFixtures) {
    const existing = await client.query("SELECT 1 FROM ops.tasks WHERE public_id = $1", [fixture.publicId]);
    if (existing.rowCount) continue;
    const note = await client.query<{ id: string }>(
      `INSERT INTO care.care_notes
        (agency_id, service_user_id, submitted_by_user_id, external_note_id, note_ciphertext, source, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, 'seed', $4)
       ON CONFLICT (agency_id, idempotency_key) DO UPDATE SET note_ciphertext = EXCLUDED.note_ciphertext
       RETURNING id::text`,
      [agencyId, residentIds[fixture.resident], coordinator.rows[0].id, `seed:${fixture.publicId}`, encryptField(fixture.note)]
    );
    const task = await client.query<{ id: string }>(
      `INSERT INTO ops.tasks
        (public_id, agency_id, service_user_id, care_note_id, created_by_user_id, category, urgency,
         status, summary, notes_ciphertext, preferred_window_start, preferred_window_end,
         carer_on_site, vulnerable_adult, ring_fence_required, after_photo_url, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::ops.task_status, $9, $10,
               clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day 2 hours',
               true, $11, $11, $12,
               CASE WHEN $8::text = 'completed' THEN clock_timestamp() ELSE NULL END)
       RETURNING id::text`,
      [fixture.publicId, agencyId, residentIds[fixture.resident], note.rows[0].id, coordinator.rows[0].id,
        fixture.category, fixture.urgency, fixture.status, fixture.summary, encryptField(fixture.note),
        fixture.vulnerable, fixture.status === "awaiting_care_confirmation" || fixture.status === "completed"
          ? `https://taskbridge.co.uk/demo-evidence/${fixture.publicId}.jpg`
          : null]
    );
    await client.query(
      `INSERT INTO ops.task_status_events (task_id, agency_id, new_status, changed_by_user_id, reason)
       VALUES ($1, $2, $3, $4, 'TaskBridge demonstration fixture')`,
      [task.rows[0].id, agencyId, fixture.status, coordinator.rows[0].id]
    );
    if (!fixture.trader || !fixture.visitStatus) continue;
    const assignment = await client.query<{ id: string }>(
      `INSERT INTO ops.assignments
        (task_id, agency_id, trader_id, status, selected_by_user_id, provider_booking_id,
         distance_miles, quoted_price, scheduled_start, scheduled_end, dispatched_at)
       VALUES ($1, $2, $3, 'dispatched', $4, $5, 2.4, 42,
               clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day 2 hours',
               clock_timestamp()) RETURNING id::text`,
      [task.rows[0].id, agencyId, traderIds[fixture.trader], coordinator.rows[0].id, `demo:${fixture.publicId}`]
    );
    await client.query(
      `INSERT INTO ops.visits
        (task_id, agency_id, assignment_id, trader_id, status, check_in_at, check_out_at,
         completion_notes, confirmed_by_user_id, confirmed_at)
       VALUES ($1, $2, $3, $4, $5::ops.visit_status,
               CASE WHEN $5::text IN ('evidence_submitted', 'confirmed') THEN clock_timestamp() - interval '2 hours' ELSE NULL END,
               CASE WHEN $5::text IN ('evidence_submitted', 'confirmed') THEN clock_timestamp() - interval '1 hour' ELSE NULL END,
               CASE WHEN $5::text IN ('evidence_submitted', 'confirmed') THEN $6 ELSE NULL END,
               CASE WHEN $5::text = 'confirmed' THEN $7::uuid ELSE NULL END,
               CASE WHEN $5::text = 'confirmed' THEN clock_timestamp() ELSE NULL END)`,
      [task.rows[0].id, agencyId, assignment.rows[0].id, traderIds[fixture.trader], fixture.visitStatus,
        fixture.note, coordinator.rows[0].id]
    );
  }

  await client.query("COMMIT");
  console.log("Development seed complete");
  console.log(`Coordinator: sarah.jenkins@primrose.org / ${coordinatorPassword}`);
  console.log(`Admin: james.carter@taskbridge.co.uk / ${adminPassword}`);
  console.log(`Super admin: alex.morgan@taskbridge.co.uk / ${superAdminPassword}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
