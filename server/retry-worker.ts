import type { PoolClient } from "pg";
import { postCarePlatformCompletionCallback } from "./care-platform-clients.js";
import type { CarePlatformProvider } from "./care-platform-adapters.js";
import { cancelHandymanNetworkBooking } from "./integrations.js";
import { decryptField } from "./security.js";

interface RetryJobRow {
  id: string;
  webhook_log_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export async function processRetryQueue(client: PoolClient, limit = 10) {
  const jobs = await client.query<RetryJobRow>(
    `SELECT id::text, webhook_log_id::text, job_type, payload, attempts, max_attempts
     FROM integration.retry_queue
     WHERE completed_at IS NULL AND failed_at IS NULL AND next_run_at <= clock_timestamp()
     ORDER BY next_run_at ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit]
  );
  const results: Array<{ id: string; status: "completed" | "retrying" | "failed"; error?: string }> = [];
  for (const job of jobs.rows) {
    try {
      await runJob(client, job);
      await client.query("UPDATE integration.retry_queue SET completed_at = clock_timestamp(), attempts = attempts + 1 WHERE id = $1", [job.id]);
      await client.query(
        "UPDATE integration.webhook_logs SET status = 'processed', processed_at = clock_timestamp(), error_message = NULL WHERE id = $1",
        [job.webhook_log_id]
      );
      results.push({ id: job.id, status: "completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry job failed";
      const nextAttempts = job.attempts + 1;
      const failed = nextAttempts >= job.max_attempts;
      await client.query(
        `UPDATE integration.retry_queue
         SET attempts = attempts + 1,
             failed_at = CASE WHEN $2 THEN clock_timestamp() ELSE failed_at END,
             next_run_at = CASE WHEN $2 THEN next_run_at ELSE clock_timestamp() + (($3 || ' minutes')::interval) END,
             error_message = $4
         WHERE id = $1`,
        [job.id, failed, Math.min(240, 2 ** nextAttempts), message]
      );
      await client.query(
        `UPDATE integration.webhook_logs
         SET status = $2, retry_count = retry_count + 1, error_message = $3,
             next_retry_at = CASE WHEN $2 = 'retrying' THEN clock_timestamp() + (($4 || ' minutes')::interval) ELSE NULL END
         WHERE id = $1`,
        [job.webhook_log_id, failed ? "failed" : "retrying", message, Math.min(240, 2 ** nextAttempts)]
      );
      results.push({ id: job.id, status: failed ? "failed" : "retrying", error: message });
    }
  }
  return results;
}

async function runJob(client: PoolClient, job: RetryJobRow) {
  if (job.job_type === "care_completion_callback") {
    const taskId = String(job.payload.taskId || "");
    if (!taskId) throw new Error("Missing taskId for care completion callback");
    const target = await client.query<{
      callback_url: string | null;
      secret_ciphertext: string | null;
      integration_callback_url: string | null;
      integration_secret_ciphertext: string | null;
      integration_provider: CarePlatformProvider | null;
      public_id: string;
      status: string;
      summary: string;
      after_photo_url: string | null;
      completed_at: string | null;
    }>(
      `SELECT cfg.callback_url, cfg.secret_ciphertext,
              care_integration.settings->>'callbackUrl' AS integration_callback_url,
              care_integration.settings->>'callbackSigningSecretCiphertext' AS integration_secret_ciphertext,
              care_integration.provider AS integration_provider,
              t.public_id, t.status::text, t.summary, t.after_photo_url, t.completed_at::text
       FROM ops.tasks t
       LEFT JOIN LATERAL (
         SELECT ai.settings, pc.name AS provider
         FROM integration.agency_integrations ai
         JOIN integration.provider_configs pc ON pc.id = ai.provider_config_id
         WHERE ai.agency_id = t.agency_id
           AND pc.provider_type = 'care_management'
           AND ai.enabled
           AND NULLIF(ai.settings->>'callbackUrl', '') IS NOT NULL
         ORDER BY ai.updated_at DESC LIMIT 1
       ) care_integration ON true
       LEFT JOIN tenant.agency_webhook_configs cfg ON cfg.agency_id = t.agency_id AND cfg.enabled
       WHERE t.public_id = $1 AND t.deleted_at IS NULL
       ORDER BY cfg.created_at DESC LIMIT 1`,
      [taskId]
    );
    const row = target.rows[0];
    if (!row) throw new Error("Task was not found for care completion callback");
    const callbackUrl = row.integration_callback_url || row.callback_url;
    const secretCiphertext = row.integration_secret_ciphertext || row.secret_ciphertext;
    if (!callbackUrl || !secretCiphertext) throw new Error("No enabled agency callback URL is configured");
    const payload = {
      event: "task.completed",
      taskId: row.public_id,
      status: row.status,
      summary: row.summary,
      afterPhotoUrl: row.after_photo_url,
      completedAt: row.completed_at
    };
    const secret = decryptField(secretCiphertext);
    await postCarePlatformCompletionCallback(row.integration_provider || "generic", callbackUrl, secret, payload);
    return;
  }
  if (job.job_type === "handyman_assignment_cancellation") {
    const result = await cancelHandymanNetworkBooking(job.payload);
    if (String(result.status || "").includes("failed")) throw new Error("Handyman network cancellation failed");
    return;
  }
  throw new Error(`Unsupported retry job type: ${job.job_type}`);
}
