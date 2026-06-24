import "dotenv/config";
import pg from "pg";
import { hashPassword, isWorkEmail } from "../server/security.js";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME?.trim();
const role = process.env.ADMIN_ROLE === "taskbridge_admin" ? "taskbridge_admin" : "taskbridge_super_admin";

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!email || !isWorkEmail(email)) throw new Error("ADMIN_EMAIL must be a work email address");
if (!password || password.length < 16) throw new Error("ADMIN_PASSWORD must contain at least 16 characters");
if (!fullName || fullName.length < 2) throw new Error("ADMIN_NAME is required");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

const passwordHash = await hashPassword(password);
const result = await pool.query(
  `INSERT INTO auth.users (full_name, email, password_hash, role, status)
   VALUES ($1, $2, $3, $4, 'active')
   ON CONFLICT (email) DO NOTHING
   RETURNING id::text`,
  [fullName, email, passwordHash, role]
);
await pool.end();
if (!result.rows[0]) throw new Error("An account already exists for ADMIN_EMAIL");
console.log(`Created ${role} account for ${email}`);
