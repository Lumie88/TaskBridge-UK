import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

await pool.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
  name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
)`);

const directory = path.resolve("database/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const sql = await readFile(path.join(directory, file), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const existing = await pool.query<{ checksum: string }>("SELECT checksum FROM public.schema_migrations WHERE name = $1", [file]);
  if (existing.rows[0]) {
    if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration ${file} has changed`);
    console.log(`skip ${file}`);
    continue;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
    await client.query("COMMIT");
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
