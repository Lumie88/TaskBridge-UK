-- Optional demo seed for TaskBridge.
-- Replace hashes/secrets with real production values before live use.

INSERT INTO agencies (id, name, api_key_hash, primary_contact, webhook_url)
VALUES (
  'birdie-london',
  'Birdie London',
  'demo-api-key-hash-replace-me',
  'Maya Shah',
  'https://partner.example.local/birdie/webhooks/taskbridge'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO care_users (id, agency_id, name, email, password_hash, role, access_level)
VALUES
  ('cm_001', 'birdie-london', 'Maya Shah', 'maya@birdie.example', 'demo-password-hash-replace-me', 'Care Coordinator', 'care'),
  ('adm_001', 'birdie-london', 'Alex Reid', 'admin@taskbridge.example', 'demo-password-hash-replace-me', 'TaskBridge Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO service_users (id, agency_id, encrypted_name, encrypted_address, lat, lng, is_vulnerable)
VALUES
  ('su_1001', 'birdie-london', 'encrypted:Eleanor Price', 'encrypted:18 Rowan Court, Hackney, London', 51.545, -0.055, true),
  ('su_1002', 'birdie-london', 'encrypted:Gareth Morgan', 'encrypted:4 Heathfield Road, Islington, London', 51.544, -0.103, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO traders (
  id, source, marketplace_trader_id, name, mobile, amiqus_session_id,
  dbs_status, dbs_expiry_date, lat, lng, hourly_rate, next_available, services, last_checked_at
)
VALUES
  ('trd_001', 'taskrabbit', 'taskr_88A', 'Nadia Clarke', '+447700900101', 'amq_sess_ok_001', 'Approved', '2027-04-12', 51.55, -0.07, 38, 'Today 14:00-16:00', ARRAY['Garden Path Clearing','Trip Hazard Removal','Lawn Mowing','Window Cleaning'], now()),
  ('trd_002', 'checkatrade', 'chk_member_204', 'Oliver Bennett', '+447700900202', 'amq_sess_pending_002', 'Pending', NULL, 51.515, -0.141, 29, 'Today 11:00-13:00', ARRAY['Loose Rails','Lock Repairs','Window Cleaning','Garden Clearance'], now()),
  ('trd_003', 'airtasker', 'air_7731', 'Priya Nair', '+447700900303', 'amq_sess_ok_003', 'Approved', '2026-12-22', 51.49, -0.082, 34, 'Tomorrow 09:00-11:00', ARRAY['Appliance Safety','Deep Cleaning','Trip Hazard Removal','Garden Path Clearing'], now())
ON CONFLICT (id) DO NOTHING;
