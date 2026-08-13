INSERT INTO tenant.agency_settings (
  agency_id,
  health_analytics_enabled,
  rota_planner_enabled,
  care_os_enabled,
  go_live_status
)
SELECT DISTINCT a.id, true, true, true, 'pilot_live'
FROM tenant.agencies a
LEFT JOIN auth.users u ON u.agency_id = a.id
WHERE a.public_id = 'agc_primrose'
   OR a.slug = 'primrose-care-services'
   OR a.name IN ('Primrose Care Services', 'Demo')
   OR lower(u.email) = 'sarah.jenkins@primrose.org'
ON CONFLICT (agency_id) DO UPDATE SET
  health_analytics_enabled = true,
  rota_planner_enabled = true,
  care_os_enabled = true,
  go_live_status = 'pilot_live';

UPDATE tenant.agencies a
SET name = 'Demo'
WHERE a.public_id = 'agc_primrose'
   OR a.slug = 'primrose-care-services'
   OR a.name = 'Primrose Care Services'
   OR EXISTS (
     SELECT 1
     FROM auth.users u
     WHERE u.agency_id = a.id
       AND lower(u.email) = 'sarah.jenkins@primrose.org'
   );
