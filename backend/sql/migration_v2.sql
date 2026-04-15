-- ============================================================
-- Beauty Parlour Chatbot — Database Schema Migration v2.0
-- Supabase / PostgreSQL 15+
-- Production-Ready with Auth, RLS, Audit Trails
-- ============================================================
-- 
-- IMPORTANT: Run this script in a single transaction
-- If any step fails, the entire migration will rollback
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. ENUMS (Migration-Safe)
-- ============================================================

-- User roles for dashboard authentication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'salon_owner', 'reception');
    END IF;
END $$;

-- Communication channels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
        CREATE TYPE channel_type AS ENUM ('whatsapp', 'telegram');
    END IF;
END $$;

-- Appointment lifecycle statuses (extended from v1)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM (
            'pending',
            'confirmed',
            'cancelled_by_client',
            'cancelled_by_user',
            'cancelled_by_salon',
            'cancelled_by_reception',
            'cancelled_closure',
            'completed',
            'no_show'
        );
    ELSE
        -- Add missing values for v1 → v2 migration
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_salon';
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_reception';
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_closure';
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'completed';
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show';
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_user';
    END IF;
END $$;

-- Notification job types (extended from v1)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_job_type') THEN
        CREATE TYPE notification_job_type AS ENUM (
            'reminder_24h',
            'reminder_1h',
            'salon_daily_digest',
            'salon_opening_digest',
            'salon_per_appointment',
            'closure_cancellation',
            'reminder_15m'
        );
    ELSE
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'reminder_24h';
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'reminder_1h';
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'salon_daily_digest';
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'salon_opening_digest';
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'salon_per_appointment';
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'closure_cancellation';
        ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'reminder_15m';
    END IF;
END $$;

-- Notification job execution status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_job_status') THEN
        CREATE TYPE notification_job_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'skipped');
    ELSE
        ALTER TYPE notification_job_status ADD VALUE IF NOT EXISTS 'skipped';
    END IF;
END $$;

-- Salon digest preferences
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'digest_preference') THEN
        CREATE TYPE digest_preference AS ENUM ('daily', 'opening', 'per_appointment');
    END IF;
END $$;

-- ============================================================
-- 3. TABLES (Creation Order Respects Foreign Keys)
-- ============================================================

-- SALONS — Extended with closure tracking, business hours, digest config
CREATE TABLE IF NOT EXISTS salons (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    slug                    TEXT UNIQUE NOT NULL,
    timezone                TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    flow_config             JSONB DEFAULT '{}',
    
    -- Business hours (for opening digest)
    opening_time            TIME,
    closing_time            TIME,
    
    -- Closure tracking
    is_temporarily_closed   BOOLEAN NOT NULL DEFAULT FALSE,
    closure_reason          TEXT,
    closed_from             TIMESTAMPTZ,
    closed_until            TIMESTAMPTZ,
    
    -- Digest / notification preferences
    digest_preference       digest_preference NOT NULL DEFAULT 'daily',
    digest_time             TIME DEFAULT '09:00:00',
    
    -- Pricing
    currency                TEXT NOT NULL DEFAULT 'INR',
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USERS — Dashboard authentication (links to Supabase Auth)
-- NOTE: id must be manually set to match auth.users.id from Supabase Auth
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY,  -- Must match auth.uid() from Supabase Auth
    email           TEXT UNIQUE NOT NULL,
    full_name       TEXT,
    role            user_role NOT NULL,
    salon_id        UUID REFERENCES salons(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraint: admin can have NULL salon_id; salon_owner/reception MUST have salon_id
    CONSTRAINT role_salon_required CHECK (
        role = 'admin' OR salon_id IS NOT NULL
    )
);

-- SALON CHANNELS — WhatsApp/Telegram configuration
CREATE TABLE IF NOT EXISTS salon_channels (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id          UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    channel           channel_type NOT NULL,
    provider_config   JSONB NOT NULL DEFAULT '{}',
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (salon_id, channel)
);

-- SALON SERVICES — Extended with pricing
CREATE TABLE IF NOT EXISTS salon_services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id            UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    duration_minutes    INTEGER NOT NULL DEFAULT 60,
    price               NUMERIC(10, 2) CHECK (price >= 0),
    discount_price      NUMERIC(10, 2) CHECK (discount_price >= 0),
    sample_image_urls   JSONB DEFAULT '[]',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (salon_id, code)
);

-- CUSTOMERS — User profiles from WhatsApp/Telegram
CREATE TABLE IF NOT EXISTS customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id            UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    channel             channel_type NOT NULL,
    external_user_id    TEXT NOT NULL,
    phone_number        TEXT,
    telegram_chat_id    TEXT,
    name                TEXT,
    language_preference TEXT DEFAULT 'english',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (salon_id, channel, external_user_id)
);

-- APPOINTMENTS — Extended with cancellation tracking
CREATE TABLE IF NOT EXISTS appointments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id              UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    service_id            UUID REFERENCES salon_services(id) ON DELETE SET NULL,  -- Keep nullable for migration safety
    booking_reference     TEXT UNIQUE NOT NULL DEFAULT 'BP-' || upper(substring(translate(gen_random_uuid()::text, '-', ''), 1, 8)),
    appointment_at        TIMESTAMPTZ NOT NULL,
    status                appointment_status NOT NULL DEFAULT 'pending',
    
    -- Cancellation tracking
    cancelled_by_user_id  UUID REFERENCES users(id),
    cancellation_reason   TEXT,
    status_updated_at     TIMESTAMPTZ,
    
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATION JOBS — Extended with salon_id for digest jobs
CREATE TABLE IF NOT EXISTS notification_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
    salon_id        UUID REFERENCES salons(id) ON DELETE CASCADE,  -- For digest jobs (no single appointment)
    job_type        notification_job_type NOT NULL,
    status          notification_job_status NOT NULL DEFAULT 'pending',
    due_at          TIMESTAMPTZ NOT NULL,
    locked_at       TIMESTAMPTZ,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_appointment_job_type UNIQUE (appointment_id, job_type)
);

-- Ensure new columns exist for previously created databases
ALTER TABLE IF EXISTS notification_jobs
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- SALON CLOSURES — Audit log of all closures (NEW in v2)
CREATE TABLE IF NOT EXISTS salon_closures (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id            UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    closed_from         TIMESTAMPTZ NOT NULL,
    closed_until        TIMESTAMPTZ,
    reason              TEXT,
    created_by          UUID REFERENCES users(id),
    notifications_queued BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- APPOINTMENT STATUS LOG — Full audit trail (NEW in v2)
CREATE TABLE IF NOT EXISTS appointment_status_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    old_status      appointment_status,
    new_status      appointment_status NOT NULL,
    changed_by      UUID REFERENCES users(id),  -- NULL = system/worker
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INBOUND MESSAGES — Message log
CREATE TABLE IF NOT EXISTS inbound_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id            UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel             channel_type NOT NULL,
    provider_message_id TEXT,
    external_user_id    TEXT NOT NULL,
    text                TEXT,
    payload             JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OUTBOUND MESSAGES — Message log
CREATE TABLE IF NOT EXISTS outbound_messages (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id              UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel               channel_type NOT NULL,
    text                  TEXT,
    provider_message_id   TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SALON NOTIFICATION CONTACTS — Staff contacts for digests
CREATE TABLE IF NOT EXISTS salon_notification_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    channel         channel_type NOT NULL,
    destination     TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (salon_id, channel, destination)
);

-- ============================================================
-- 4. INDEXES (Optimized for Query Patterns)
-- ============================================================

-- Appointments — Common query patterns
CREATE INDEX IF NOT EXISTS idx_appointments_salon_id         ON appointments(salon_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id      ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_at   ON appointments(appointment_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status           ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_salon_date       ON appointments(salon_id, appointment_at);
CREATE INDEX IF NOT EXISTS idx_appointments_worker_queries   ON appointments(salon_id, status, appointment_at);

-- Notification jobs — Partial index for efficient polling
DROP INDEX IF EXISTS idx_notification_jobs_due_status;
CREATE INDEX IF NOT EXISTS idx_notification_jobs_due_at      ON notification_jobs(due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_jobs_salon_id    ON notification_jobs(salon_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_salon_id                ON users(salon_id);
CREATE INDEX IF NOT EXISTS idx_users_role                    ON users(role);

-- Salon closures
CREATE INDEX IF NOT EXISTS idx_salon_closures_salon_id       ON salon_closures(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_closures_dates          ON salon_closures(salon_id, closed_from, closed_until);

-- Appointment status log
CREATE INDEX IF NOT EXISTS idx_status_log_appointment_id     ON appointment_status_log(appointment_id);

-- Other tables
CREATE INDEX IF NOT EXISTS idx_salon_channels_salon_id       ON salon_channels(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_services_salon_id       ON salon_services(salon_id);
CREATE INDEX IF NOT EXISTS idx_customers_salon_channel_user  ON customers(salon_id, channel, external_user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_salon        ON inbound_messages(salon_id);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_salon       ON outbound_messages(salon_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on ALL 13 tables
ALTER TABLE salons                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_closures          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_notification_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's salon_id
CREATE OR REPLACE FUNCTION current_user_salon_id()
RETURNS UUID AS $$
    SELECT salon_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. RLS POLICIES (Complete Coverage)
-- ============================================================

-- SALONS
DROP POLICY IF EXISTS salons_select ON salons;
DROP POLICY IF EXISTS salons_insert ON salons;
DROP POLICY IF EXISTS salons_update ON salons;
DROP POLICY IF EXISTS salons_delete ON salons;

CREATE POLICY salons_select ON salons FOR SELECT USING (
    current_user_role() = 'admin'
    OR id = current_user_salon_id()
);
CREATE POLICY salons_insert ON salons FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
);
CREATE POLICY salons_update ON salons FOR UPDATE USING (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND id = current_user_salon_id())
);
CREATE POLICY salons_delete ON salons FOR DELETE USING (
    current_user_role() = 'admin'
);

-- USERS
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
DROP POLICY IF EXISTS users_delete ON users;

CREATE POLICY users_select ON users FOR SELECT USING (
    current_user_role() = 'admin'
    OR id = auth.uid()
);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
);
CREATE POLICY users_update ON users FOR UPDATE USING (
    current_user_role() = 'admin'
    OR id = auth.uid()
);
CREATE POLICY users_delete ON users FOR DELETE USING (
    current_user_role() = 'admin'
);

-- SALON CHANNELS
DROP POLICY IF EXISTS salon_channels_select ON salon_channels;
DROP POLICY IF EXISTS salon_channels_insert ON salon_channels;
DROP POLICY IF EXISTS salon_channels_update ON salon_channels;
DROP POLICY IF EXISTS salon_channels_delete ON salon_channels;

CREATE POLICY salon_channels_select ON salon_channels FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY salon_channels_insert ON salon_channels FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_channels_update ON salon_channels FOR UPDATE USING (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_channels_delete ON salon_channels FOR DELETE USING (
    current_user_role() = 'admin'
);

-- SALON SERVICES
DROP POLICY IF EXISTS salon_services_select ON salon_services;
DROP POLICY IF EXISTS salon_services_insert ON salon_services;
DROP POLICY IF EXISTS salon_services_update ON salon_services;
DROP POLICY IF EXISTS salon_services_delete ON salon_services;

CREATE POLICY salon_services_select ON salon_services FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY salon_services_insert ON salon_services FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_services_update ON salon_services FOR UPDATE USING (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_services_delete ON salon_services FOR DELETE USING (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);

-- CUSTOMERS
DROP POLICY IF EXISTS customers_select ON customers;
DROP POLICY IF EXISTS customers_insert ON customers;
DROP POLICY IF EXISTS customers_update ON customers;
DROP POLICY IF EXISTS customers_delete ON customers;

CREATE POLICY customers_select ON customers FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR current_user_role() = 'salon_owner'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY customers_update ON customers FOR UPDATE USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY customers_delete ON customers FOR DELETE USING (
    current_user_role() = 'admin'
);

-- APPOINTMENTS
DROP POLICY IF EXISTS appointments_select ON appointments;
DROP POLICY IF EXISTS appointments_insert ON appointments;
DROP POLICY IF EXISTS appointments_update ON appointments;
DROP POLICY IF EXISTS appointments_delete ON appointments;

CREATE POLICY appointments_select ON appointments FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY appointments_insert ON appointments FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR current_user_role() = 'salon_owner'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY appointments_update ON appointments FOR UPDATE USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY appointments_delete ON appointments FOR DELETE USING (
    current_user_role() = 'admin'
);

-- NOTIFICATION JOBS
DROP POLICY IF EXISTS notification_jobs_select ON notification_jobs;
DROP POLICY IF EXISTS notification_jobs_insert ON notification_jobs;
DROP POLICY IF EXISTS notification_jobs_update ON notification_jobs;
DROP POLICY IF EXISTS notification_jobs_delete ON notification_jobs;

CREATE POLICY notification_jobs_select ON notification_jobs FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
    OR EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.id = appointment_id
        AND a.salon_id = current_user_salon_id()
    )
);
CREATE POLICY notification_jobs_insert ON notification_jobs FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR current_user_role() = 'salon_owner'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY notification_jobs_update ON notification_jobs FOR UPDATE USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY notification_jobs_delete ON notification_jobs FOR DELETE USING (
    current_user_role() = 'admin'
);

-- SALON CLOSURES
DROP POLICY IF EXISTS salon_closures_select ON salon_closures;
DROP POLICY IF EXISTS salon_closures_insert ON salon_closures;
DROP POLICY IF EXISTS salon_closures_update ON salon_closures;
DROP POLICY IF EXISTS salon_closures_delete ON salon_closures;

CREATE POLICY salon_closures_select ON salon_closures FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY salon_closures_insert ON salon_closures FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_closures_update ON salon_closures FOR UPDATE USING (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_closures_delete ON salon_closures FOR DELETE USING (
    current_user_role() = 'admin'
);

-- APPOINTMENT STATUS LOG
DROP POLICY IF EXISTS appointment_status_log_select ON appointment_status_log;
DROP POLICY IF EXISTS appointment_status_log_insert ON appointment_status_log;

CREATE POLICY appointment_status_log_select ON appointment_status_log FOR SELECT USING (
    current_user_role() = 'admin'
    OR EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.id = appointment_id
        AND a.salon_id = current_user_salon_id()
    )
);
-- Note: INSERT is handled by trigger (SECURITY DEFINER bypasses RLS)

-- INBOUND MESSAGES
DROP POLICY IF EXISTS inbound_messages_select ON inbound_messages;
DROP POLICY IF EXISTS inbound_messages_insert ON inbound_messages;

CREATE POLICY inbound_messages_select ON inbound_messages FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY inbound_messages_insert ON inbound_messages FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR current_user_role() = 'salon_owner'
    OR salon_id = current_user_salon_id()
);

-- OUTBOUND MESSAGES
DROP POLICY IF EXISTS outbound_messages_select ON outbound_messages;
DROP POLICY IF EXISTS outbound_messages_insert ON outbound_messages;

CREATE POLICY outbound_messages_select ON outbound_messages FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY outbound_messages_insert ON outbound_messages FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR current_user_role() = 'salon_owner'
    OR salon_id = current_user_salon_id()
);

-- SALON NOTIFICATION CONTACTS
DROP POLICY IF EXISTS salon_contacts_select ON salon_notification_contacts;
DROP POLICY IF EXISTS salon_contacts_insert ON salon_notification_contacts;
DROP POLICY IF EXISTS salon_contacts_update ON salon_notification_contacts;
DROP POLICY IF EXISTS salon_contacts_delete ON salon_notification_contacts;

CREATE POLICY salon_contacts_select ON salon_notification_contacts FOR SELECT USING (
    current_user_role() = 'admin'
    OR salon_id = current_user_salon_id()
);
CREATE POLICY salon_contacts_insert ON salon_notification_contacts FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_contacts_update ON salon_notification_contacts FOR UPDATE USING (
    current_user_role() = 'admin'
    OR (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
);
CREATE POLICY salon_contacts_delete ON salon_notification_contacts FOR DELETE USING (
    current_user_role() = 'admin'
);

-- ============================================================
-- 8. TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salons_updated_at ON salons;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP TRIGGER IF EXISTS salon_channels_updated_at ON salon_channels;
DROP TRIGGER IF EXISTS salon_services_updated_at ON salon_services;
DROP TRIGGER IF EXISTS customers_updated_at ON customers;
DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
DROP TRIGGER IF EXISTS notification_jobs_updated_at ON notification_jobs;
DROP TRIGGER IF EXISTS salon_closures_updated_at ON salon_closures;

CREATE TRIGGER salons_updated_at         BEFORE UPDATE ON salons          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at          BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER salon_channels_updated_at BEFORE UPDATE ON salon_channels  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER salon_services_updated_at BEFORE UPDATE ON salon_services  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER customers_updated_at      BEFORE UPDATE ON customers       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER appointments_updated_at   BEFORE UPDATE ON appointments    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER notification_jobs_updated_at BEFORE UPDATE ON notification_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER salon_closures_updated_at BEFORE UPDATE ON salon_closures  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-log appointment status changes (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION log_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO appointment_status_log (
            appointment_id,
            old_status,
            new_status,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.cancelled_by_user_id,
            NEW.cancellation_reason
        );
        NEW.status_updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS appointments_status_log ON appointments;

CREATE TRIGGER appointments_status_log
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_appointment_status_change();

-- ============================================================
-- 9. DOCUMENTATION COMMENTS
-- ============================================================

COMMENT ON TABLE users IS 'Dashboard users linked to Supabase Auth (users.id = auth.users.id)';
COMMENT ON TABLE salon_closures IS 'Audit log of salon closure periods with cancellation tracking';
COMMENT ON TABLE appointment_status_log IS 'Immutable audit trail of all appointment status changes';
COMMENT ON TABLE notification_jobs IS 'Worker-safe queue for appointment reminders and digests';
COMMENT ON FUNCTION current_user_role() IS 'Returns role of currently authenticated Supabase user';
COMMENT ON FUNCTION current_user_salon_id() IS 'Returns salon_id of currently authenticated user';

-- ============================================================
-- 10. MIGRATION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now(),
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES (2, 'Supabase RLS migration with auth, audit trails, closure management')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- END OF MIGRATION
-- ============================================================

COMMIT;

-- ============================================================
-- POST-MIGRATION: Create first admin user
-- ============================================================
-- IMPORTANT: Run this AFTER creating user in Supabase Auth dashboard
-- 
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Create new user (email/password)
-- 3. Copy the User ID (UUID)
-- 4. Run:
--
-- INSERT INTO users (id, email, full_name, role, salon_id, is_active, created_by)
-- VALUES (
--     '<uuid-from-auth-users>',
--     'admin@salon.com',
--     'Admin User',
--     'admin',
--     NULL,  -- NULL for admin; salon_owner/reception need salon_id
--     TRUE,
--     NULL
-- );
-- ============================================================
