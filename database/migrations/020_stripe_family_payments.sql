CREATE UNIQUE INDEX IF NOT EXISTS family_payment_sessions_stripe_session_idx
  ON billing.family_payment_sessions(provider_session_id)
  WHERE provider = 'stripe' AND provider_session_id IS NOT NULL;
