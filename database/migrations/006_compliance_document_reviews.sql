ALTER TABLE trader.onboarding_documents
  ADD COLUMN review_notes TEXT;

CREATE INDEX onboarding_documents_pending_review_idx
  ON trader.onboarding_documents(created_at DESC)
  WHERE review_status = 'pending';
