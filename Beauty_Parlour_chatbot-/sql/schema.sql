-- Beauty Parlour Chatbot Database Schema v2.0
-- Supabase/PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'salon_owner', 'reception');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE channel_type AS ENUM ('whatsapp', 'telegram');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE appointment_status AS ENUM (
        'pending',
        'confirmed',
        'cancelled_by_client',
        'cancelled_by_salon',
        'cancelled_by_reception',
        'cancelled_closure',
        'completed',
        'no_show'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE notification_job_type AS ENUM (
        'reminder_24h',
        'reminder_1h',
        'salon_daily_digest',
        'salon_opening_digest',
        'salon_per_appointment',
        'closure_cancellation'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE notification_job_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE digest_preference AS ENUM ('daily', 'opening', 'per_appointment');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure required enum values exist (safe for partially migrated DBs)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'salon_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'reception';

ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'telegram';

ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_client';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_salon';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_reception';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_closure';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show';

ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'reminder_24h';
ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'reminder_1h';
ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'salon_daily_digest';
ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'salon_opening_digest';
ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'salon_per_appointment';
ALTER TYPE notification_job_type ADD VALUE IF NOT EXISTS 'closure_cancellation';

ALTER TYPE notification_job_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE notification_job_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE notification_job_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE notification_job_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE notification_job_status ADD VALUE IF NOT EXISTS 'skipped';

ALTER TYPE digest_preference ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE digest_preference ADD VALUE IF NOT EXISTS 'opening';
ALTER TYPE digest_preference ADD VALUE IF NOT EXISTS 'per_appointment';

-- Tables
CREATE TABLE IF NOT EXISTS salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
    default_language VARCHAR(40) NOT NULL DEFAULT 'english',
    flow_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    entry_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    opening_time TIME,
    closing_time TIME,
    is_temporarily_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closure_reason TEXT,
    closed_from TIMESTAMPTZ,
    closed_until TIMESTAMPTZ,
    digest_preference digest_preference,
    digest_time TIME,
    currency VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role user_role NOT NULL,
    salon_id UUID REFERENCES salons(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_role_salon_check CHECK (role = 'admin' OR salon_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS salon_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    inbound_identifier VARCHAR(255),
    provider_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    webhook_secret VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_salon_channel UNIQUE (salon_id, channel)
);

CREATE TABLE IF NOT EXISTS salon_notification_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    channel channel_type NOT NULL,
    destination VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_salon_contact_destination UNIQUE (salon_id, channel, destination)
);

CREATE TABLE IF NOT EXISTS salon_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    price NUMERIC(10, 2),
    discount_price NUMERIC(10, 2),
    sample_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    service_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_salon_service_code UNIQUE (salon_id, code)
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    external_user_id VARCHAR(255) NOT NULL,
    phone_number VARCHAR(30),
    telegram_chat_id VARCHAR(60),
    display_name VARCHAR(255),
    preferred_language VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_external_user UNIQUE (salon_id, channel, external_user_id)
);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES salon_services(id) ON DELETE SET NULL,
    booking_reference VARCHAR(30) NOT NULL UNIQUE,
    channel channel_type NOT NULL,
    status appointment_status NOT NULL DEFAULT 'confirmed',
    language VARCHAR(40) NOT NULL,
    marriage_type VARCHAR(40) NOT NULL,
    service_name_snapshot VARCHAR(255) NOT NULL,
    appointment_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    cancellation_reason TEXT,
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    booking_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel channel_type NOT NULL,
    provider_message_id VARCHAR(255),
    external_user_id VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel channel_type NOT NULL,
    destination VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    provider_message_id VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    job_type notification_job_type NOT NULL,
    status notification_job_status NOT NULL DEFAULT 'pending',
    due_at TIMESTAMPTZ NOT NULL,
    locked_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_appointment_job_type UNIQUE (appointment_id, job_type)
);

CREATE TABLE IF NOT EXISTS salon_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    closed_from TIMESTAMPTZ NOT NULL,
    closed_until TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notifications_queued BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    old_status appointment_status NOT NULL,
    new_status appointment_status NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safe column additions for partially migrated databases
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS opening_time TIME;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS closing_time TIME;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS is_temporarily_closed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS closure_reason TEXT;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS closed_from TIMESTAMPTZ;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS closed_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS digest_preference digest_preference;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS digest_time TIME;
ALTER TABLE IF EXISTS salons ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

ALTER TABLE IF EXISTS salon_services ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE IF EXISTS salon_services ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10, 2);

ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS notification_jobs ADD COLUMN IF NOT EXISTS salon_id UUID;

-- Ensure new foreign keys and constraints exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_appointments_cancelled_by_user'
    ) THEN
        ALTER TABLE IF EXISTS appointments
            ADD CONSTRAINT fk_appointments_cancelled_by_user
            FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_notification_jobs_salon'
    ) THEN
        ALTER TABLE IF EXISTS notification_jobs
            ADD CONSTRAINT fk_notification_jobs_salon
            FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_salon_check'
    ) THEN
        ALTER TABLE IF EXISTS users
            ADD CONSTRAINT users_role_salon_check CHECK (role = 'admin' OR salon_id IS NOT NULL);
    END IF;
END $$;

-- Indexes (including required FK indexes)
CREATE INDEX IF NOT EXISTS idx_users_salon_id ON users (salon_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users (created_by);

CREATE INDEX IF NOT EXISTS idx_salon_channels_salon_id ON salon_channels (salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_contacts_salon_id ON salon_notification_contacts (salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_services_salon_id ON salon_services (salon_id);
CREATE INDEX IF NOT EXISTS idx_customers_salon_id ON customers (salon_id);

CREATE INDEX IF NOT EXISTS idx_appointments_worker_queries ON appointments (salon_id, status, appointment_at);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments (service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_cancelled_by_user_id ON appointments (cancelled_by_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_due_at ON notification_jobs (due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_jobs_appointment_id ON notification_jobs (appointment_id);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_salon_id ON notification_jobs (salon_id);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_salon_id ON inbound_messages (salon_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_customer_id ON inbound_messages (customer_id);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_salon_id ON outbound_messages (salon_id);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_customer_id ON outbound_messages (customer_id);

CREATE INDEX IF NOT EXISTS idx_salon_closures_salon_id ON salon_closures (salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_closures_created_by ON salon_closures (created_by);

CREATE INDEX IF NOT EXISTS idx_status_log_appointment_id ON appointment_status_log (appointment_id);
CREATE INDEX IF NOT EXISTS idx_status_log_changed_by ON appointment_status_log (changed_by);

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_salon_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT salon_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- Enable Row Level Security
ALTER TABLE IF EXISTS salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS salon_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS salon_notification_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS salon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS salon_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointment_status_log ENABLE ROW LEVEL SECURITY;

-- Policies: Admin full access
DROP POLICY IF EXISTS admin_all_salons ON salons;
CREATE POLICY admin_all_salons ON salons
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_users ON users;
CREATE POLICY admin_all_users ON users
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_salon_channels ON salon_channels;
CREATE POLICY admin_all_salon_channels ON salon_channels
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_salon_contacts ON salon_notification_contacts;
CREATE POLICY admin_all_salon_contacts ON salon_notification_contacts
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_salon_services ON salon_services;
CREATE POLICY admin_all_salon_services ON salon_services
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_customers ON customers;
CREATE POLICY admin_all_customers ON customers
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_appointments ON appointments;
CREATE POLICY admin_all_appointments ON appointments
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_notification_jobs ON notification_jobs;
CREATE POLICY admin_all_notification_jobs ON notification_jobs
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_inbound_messages ON inbound_messages;
CREATE POLICY admin_all_inbound_messages ON inbound_messages
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_outbound_messages ON outbound_messages;
CREATE POLICY admin_all_outbound_messages ON outbound_messages
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_salon_closures ON salon_closures;
CREATE POLICY admin_all_salon_closures ON salon_closures
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_status_logs ON appointment_status_log;
CREATE POLICY admin_all_status_logs ON appointment_status_log
FOR ALL
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

-- Policies: Salon owner access (own salon only)
DROP POLICY IF EXISTS owner_select_salons ON salons;
CREATE POLICY owner_select_salons ON salons
FOR SELECT
USING (current_user_role() = 'salon_owner' AND id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_salons ON salons;
CREATE POLICY owner_update_salons ON salons
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_salon_channels ON salon_channels;
CREATE POLICY owner_select_salon_channels ON salon_channels
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_salon_channels ON salon_channels;
CREATE POLICY owner_update_salon_channels ON salon_channels
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_salon_contacts ON salon_notification_contacts;
CREATE POLICY owner_select_salon_contacts ON salon_notification_contacts
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_salon_contacts ON salon_notification_contacts;
CREATE POLICY owner_update_salon_contacts ON salon_notification_contacts
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_salon_services ON salon_services;
CREATE POLICY owner_select_salon_services ON salon_services
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_salon_services ON salon_services;
CREATE POLICY owner_update_salon_services ON salon_services
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_customers ON customers;
CREATE POLICY owner_select_customers ON customers
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_customers ON customers;
CREATE POLICY owner_update_customers ON customers
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_appointments ON appointments;
CREATE POLICY owner_select_appointments ON appointments
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_appointments ON appointments;
CREATE POLICY owner_update_appointments ON appointments
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_notification_jobs ON notification_jobs;
CREATE POLICY owner_select_notification_jobs ON notification_jobs
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_notification_jobs ON notification_jobs;
CREATE POLICY owner_update_notification_jobs ON notification_jobs
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_inbound_messages ON inbound_messages;
CREATE POLICY owner_select_inbound_messages ON inbound_messages
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_inbound_messages ON inbound_messages;
CREATE POLICY owner_update_inbound_messages ON inbound_messages
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_outbound_messages ON outbound_messages;
CREATE POLICY owner_select_outbound_messages ON outbound_messages
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_outbound_messages ON outbound_messages;
CREATE POLICY owner_update_outbound_messages ON outbound_messages
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_salon_closures ON salon_closures;
CREATE POLICY owner_select_salon_closures ON salon_closures
FOR SELECT
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_update_salon_closures ON salon_closures;
CREATE POLICY owner_update_salon_closures ON salon_closures
FOR UPDATE
USING (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'salon_owner' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS owner_select_status_logs ON appointment_status_log;
CREATE POLICY owner_select_status_logs ON appointment_status_log
FOR SELECT
USING (
    current_user_role() = 'salon_owner'
    AND EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.id = appointment_status_log.appointment_id
          AND a.salon_id = current_user_salon_id()
    )
);

-- Policies: Reception access (appointments/services only)
DROP POLICY IF EXISTS reception_select_appointments ON appointments;
CREATE POLICY reception_select_appointments ON appointments
FOR SELECT
USING (current_user_role() = 'reception' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS reception_update_appointments ON appointments;
CREATE POLICY reception_update_appointments ON appointments
FOR UPDATE
USING (current_user_role() = 'reception' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'reception' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS reception_select_salon_services ON salon_services;
CREATE POLICY reception_select_salon_services ON salon_services
FOR SELECT
USING (current_user_role() = 'reception' AND salon_id = current_user_salon_id());

DROP POLICY IF EXISTS reception_update_salon_services ON salon_services;
CREATE POLICY reception_update_salon_services ON salon_services
FOR UPDATE
USING (current_user_role() = 'reception' AND salon_id = current_user_salon_id())
WITH CHECK (current_user_role() = 'reception' AND salon_id = current_user_salon_id());

-- Policies: Users can read their own user record
DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
FOR SELECT
USING (id = auth.uid());

-- Triggers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_on_salons ON salons;
CREATE TRIGGER set_updated_at_on_salons
BEFORE UPDATE ON salons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_users ON users;
CREATE TRIGGER set_updated_at_on_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_salon_channels ON salon_channels;
CREATE TRIGGER set_updated_at_on_salon_channels
BEFORE UPDATE ON salon_channels
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_salon_contacts ON salon_notification_contacts;
CREATE TRIGGER set_updated_at_on_salon_contacts
BEFORE UPDATE ON salon_notification_contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_salon_services ON salon_services;
CREATE TRIGGER set_updated_at_on_salon_services
BEFORE UPDATE ON salon_services
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_customers ON customers;
CREATE TRIGGER set_updated_at_on_customers
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_appointments ON appointments;
CREATE TRIGGER set_updated_at_on_appointments
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_inbound_messages ON inbound_messages;
CREATE TRIGGER set_updated_at_on_inbound_messages
BEFORE UPDATE ON inbound_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_outbound_messages ON outbound_messages;
CREATE TRIGGER set_updated_at_on_outbound_messages
BEFORE UPDATE ON outbound_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_notification_jobs ON notification_jobs;
CREATE TRIGGER set_updated_at_on_notification_jobs
BEFORE UPDATE ON notification_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO appointment_status_log (
            appointment_id,
            old_status,
            new_status,
            changed_by,
            reason,
            created_at
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.cancelled_by_user_id,
            NEW.cancellation_reason,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_appointment_status_change ON appointments;
CREATE TRIGGER trg_log_appointment_status_change
AFTER UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION log_appointment_status_change();

-- Seed data (manual)
-- Insert the first admin user manually, using their Supabase Auth UUID.
-- Example:
-- INSERT INTO users (id, email, full_name, role, is_active)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin@example.com', 'Admin User', 'admin', true);
