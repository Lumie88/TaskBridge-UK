INSERT INTO integration.provider_configs (provider_type, name, enabled)
VALUES
  ('care_management', 'birdie', true),
  ('care_management', 'pass', true),
  ('care_management', 'cera', true),
  ('care_management', 'generic', true)
ON CONFLICT (provider_type, name) DO UPDATE
SET enabled = true,
    updated_at = clock_timestamp();
