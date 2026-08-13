ALTER TABLE tenant.agency_settings
  ALTER COLUMN go_live_status SET DEFAULT 'pilot_live';

UPDATE tenant.agencies
SET name = 'Demo'
WHERE public_id = 'agc_primrose'
   OR slug = 'primrose-care-services'
   OR name = 'Primrose Care Services';

UPDATE tenant.agency_settings settings
SET go_live_status = 'pilot_live',
    health_analytics_enabled = true,
    rota_planner_enabled = true,
    care_os_enabled = true
FROM tenant.agencies agency
WHERE settings.agency_id = agency.id
  AND (agency.public_id = 'agc_primrose' OR agency.slug = 'primrose-care-services' OR agency.name = 'Demo')
  AND (
    settings.go_live_status = 'pilot_setup'
    OR settings.health_analytics_enabled = false
    OR settings.rota_planner_enabled = false
    OR settings.care_os_enabled = false
  );
