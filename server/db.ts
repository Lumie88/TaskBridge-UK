import pg, { type PoolClient, type QueryResultRow } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "./config.js";
import type { AuthContext } from "./types.js";

const { Pool } = pg;
const dbContext = new AsyncLocalStorage<{ client: PoolClient }>();

export const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", { message: error.message });
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not configured");
  const context = dbContext.getStore();
  if (context) return context.client.query<T>(text, values);
  return pool.query<T>(text, values);
}

export async function databaseReady() {
  if (!config.databaseUrl) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function withTransaction<T>(auth: AuthContext | null, work: (client: PoolClient) => Promise<T>) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (auth) {
      await client.query("SELECT set_config('app.current_role', $1, true)", [auth.role]);
      await client.query("SELECT set_config('app.current_agency_id', $1, true)", [auth.agencyId || ""]);
    }
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withRequestDbContext<T>(auth: AuthContext, work: () => Promise<T>) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not configured");
  const client = await pool.connect();
  try {
    await setRlsContext(client, auth);
    return await dbContext.run({ client }, work);
  } finally {
    await clearRlsContext(client).catch(() => undefined);
    client.release();
  }
}

async function setRlsContext(client: PoolClient, auth: AuthContext) {
  await client.query("SELECT set_config('app.current_role', $1, false)", [auth.role]);
  await client.query("SELECT set_config('app.current_agency_id', $1, false)", [auth.agencyId || ""]);
}

async function clearRlsContext(client: PoolClient) {
  await client.query("SELECT set_config('app.current_role', '', false)");
  await client.query("SELECT set_config('app.current_agency_id', '', false)");
}
