-- ============================================================
-- Beauty Parlour Chatbot — Rollback Script v2.0
-- Use ONLY if migration fails and you need to revert
-- ============================================================
-- 
-- WARNING: This will destroy all v2 structures
-- Backup your data first!
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS appointments_status_log ON appointments;
DROP TRIGGER IF EXISTS salons_updated_at ON salons;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP TRIGGER IF EXISTS salon_channels_updated_at ON salon_channels;
DROP TRIGGER IF EXISTS salon_services_updated_at ON salon_services;
DROP TRIGGER IF EXISTS customers_updated_at ON customers;
DROP TRIGGER IF EXISTS notification_jobs_updated_at ON notification_jobs;
DROP TRIGGER IF EXISTS salon_closures_updated_at ON salon_closures;

-- ============================================================
-- 2. DROP FUNCTIONS
-- ============================================================
DROP FUNCTION IF EXISTS log_appointment_status_change();
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS current_user_role();
DROP FUNCTION IF EXISTS current_user_salon_id();

-- ============================================================
-- 3. DROP ALL RLS POLICIES
-- ============================================================
-- Salons
DROP POLICY IF EXISTS salons_select ON salons;
DROP POLICY IF EXISTS salons_insert ON salons;
DROP POLICY IF EXISTS salons_update ON salons;
DROP POLICY IF EXISTS salons_delete ON salons;

-- Users
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
DROP POLICY IF EXISTS users_delete ON users;

-- Salon Channels
DROP POLICY IF EXISTS salon_channels_select ON salon_channels;
DROP POLICY IF EXISTS salon_channels_insert ON salon_channels;
DROP POLICY IF EXISTS salon_channels_update ON salon_channels;
DROP POLICY IF EXISTS salon_channels_delete ON salon_channels;

-- Salon Services
DROP POLICY IF EXISTS salon_services_select ON salon_services;
DROP POLICY IF EXISTS salon_services_insert ON salon_services;
DROP POLICY IF EXISTS salon_services_update ON salon_services;
DROP POLICY IF EXISTS salon_services_delete ON salon_services;

-- Customers
DROP POLICY IF EXISTS customers_select ON customers;
DROP POLICY IF EXISTS customers_insert ON customers;
DROP POLICY IF EXISTS customers_update ON customers;
DROP POLICY IF EXISTS customers_delete ON customers;

-- Appointments
DROP POLICY IF EXISTS appointments_select ON appointments;
DROP POLICY IF EXISTS appointments_insert ON appointments;
DROP POLICY IF EXISTS appointments_update ON appointments;
DROP POLICY IF EXISTS appointments_delete ON appointments;

-- Notification Jobs
DROP POLICY IF EXISTS notification_jobs_select ON notification_jobs;
DROP POLICY IF EXISTS notification_jobs_insert ON notification_jobs;
DROP POLICY IF EXISTS notification_jobs_update ON notification_jobs;
DROP POLICY IF EXISTS notification_jobs_delete ON notification_jobs;

-- Salon Closures
DROP POLICY IF EXISTS salon_closures_select ON salon_closures;
DROP POLICY IF EXISTS salon_closures_insert ON salon_closures;
DROP POLICY IF EXISTS salon_closures_update ON salon_closures;
DROP POLICY IF EXISTS salon_closures_delete ON salon_closures;

-- Appointment Status Log
DROP POLICY IF EXISTS appointment_status_log_select ON appointment_status_log;
DROP POLICY IF EXISTS appointment_status_log_insert ON appointment_status_log;

-- Inbound Messages
DROP POLICY IF EXISTS inbound_messages_select ON inbound_messages;
DROP POLICY IF EXISTS inbound_messages_insert ON inbound_messages;

-- Outbound Messages
DROP POLICY IF EXISTS outbound_messages_select ON outbound_messages;
DROP POLICY IF EXISTS outbound_messages_insert ON outbound_messages;

-- Salon Notification Contacts
DROP POLICY IF EXISTS salon_contacts_select ON salon_notification_contacts;
DROP POLICY IF EXISTS salon_contacts_insert ON salon_notification_contacts;
DROP POLICY IF EXISTS salon_contacts_update ON salon_notification_contacts;
DROP POLICY IF EXISTS salon_contacts_delete ON salon_notification_contacts;

-- ============================================================
-- 4. DISABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE salons                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE users                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE salon_channels          DISABLE ROW LEVEL SECURITY;
ALTER TABLE salon_services          DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers               DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments            DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE salon_closures          DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_log  DISABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages        DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_messages       DISABLE ROW LEVEL SECURITY;
ALTER TABLE salon_notification_contacts DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. DROP NEW TABLES (v2 only)
-- ============================================================
-- WARNING: This deletes all data in these tables
DROP TABLE IF EXISTS appointment_status_log CASCADE;
DROP TABLE IF EXISTS salon_closures CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- 6. REMOVE V2 COLUMNS FROM EXISTING TABLES
-- ============================================================
-- Note: PostgreSQL doesn't support DROP COLUMN IF EXISTS with CASCADE easily
-- Run these only if you want to fully revert to v1 schema

-- Appointments
ALTER TABLE appointments DROP COLUMN IF EXISTS cancelled_by_user_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS status_updated_at;

-- Notification Jobs
ALTER TABLE notification_jobs DROP COLUMN IF EXISTS salon_id;

-- Salons
ALTER TABLE salons DROP COLUMN IF EXISTS opening_time;
ALTER TABLE salons DROP COLUMN IF EXISTS closing_time;
ALTER TABLE salons DROP COLUMN IF EXISTS is_temporarily_closed;
ALTER TABLE salons DROP COLUMN IF EXISTS closure_reason;
ALTER TABLE salons DROP COLUMN IF EXISTS closed_from;
ALTER TABLE salons DROP COLUMN IF EXISTS closed_until;
ALTER TABLE salons DROP COLUMN IF EXISTS digest_preference;
ALTER TABLE salons DROP COLUMN IF EXISTS digest_time;
ALTER TABLE salons DROP COLUMN IF EXISTS currency;

-- Salon Services
ALTER TABLE salon_services DROP COLUMN IF EXISTS price;
ALTER TABLE salon_services DROP COLUMN IF EXISTS discount_price;

-- ============================================================
-- 7. DROP INDEXES (v2 additions)
-- ============================================================
DROP INDEX IF EXISTS idx_appointments_worker_queries;
DROP INDEX IF EXISTS idx_notification_jobs_due_at;
DROP INDEX IF EXISTS idx_users_salon_id;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_salon_closures_salon_id;
DROP INDEX IF EXISTS idx_salon_closures_dates;
DROP INDEX IF EXISTS idx_status_log_appointment_id;

-- Recreate v1 index
CREATE INDEX IF NOT EXISTS idx_notification_jobs_due_status ON notification_jobs(status, due_at);

-- ============================================================
-- 8. DROP MIGRATION TRACKING
-- ============================================================
DROP TABLE IF EXISTS schema_migrations;

-- ============================================================
-- 9. REMOVE COMMENTS
-- ============================================================
COMMENT ON TABLE users IS NULL;
COMMENT ON TABLE salon_closures IS NULL;
COMMENT ON TABLE appointment_status_log IS NULL;
COMMENT ON TABLE notification_jobs IS NULL;
COMMENT ON FUNCTION current_user_role() IS NULL;
COMMENT ON FUNCTION current_user_salon_id() IS NULL;

-- ============================================================
-- IMPORTANT NOTES
-- ============================================================
-- 1. ENUM values CANNOT be removed without recreating the type
--    To fully revert enums, you would need to:
--    - Drop all tables using the enums
--    - DROP TYPE enum_name
--    - Recreate the type with v1 values
--    - Recreate all tables
--
-- 2. All data in users, salon_closures, appointment_status_log is lost
--
-- 3. Backend code expecting v2 schema will fail after rollback
--
-- 4. You must update backend .env to remove SUPABASE_* variables
-- ============================================================

COMMIT;

-- ============================================================
-- POST-ROLLBACK: Verify v1 schema is intact
-- ============================================================
-- Run verification:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- 
-- Expected tables (v1):
-- salons, salon_channels, salon_services, customers, appointments,
-- notification_jobs, inbound_messages, outbound_messages,
-- salon_notification_contacts
-- ============================================================
