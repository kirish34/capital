-- =========================================================
--  EXTENSIONS (optional, depending on your Postgres setup)
-- =========================================================
-- Uncomment if you want UUIDs instead of BIGSERIAL
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
--  CORE ENTITIES
-- =========================================================

CREATE TABLE landlords (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    landlord_type   TEXT DEFAULT 'individual',
    company_name    TEXT,
    company_contact_name TEXT,
    company_contact_phone TEXT,
    id_number       TEXT,
    kra_pin         TEXT,
    contract_url    TEXT,
    contract_notes  TEXT,
    password_hash   TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE properties (
    id              BIGSERIAL PRIMARY KEY,
    landlord_id     BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    location        VARCHAR(255),
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE caretakers (
    id              BIGSERIAL PRIMARY KEY,
    landlord_id     BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    password_hash   TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE caretaker_properties (
    id              BIGSERIAL PRIMARY KEY,
    caretaker_id    BIGINT NOT NULL REFERENCES caretakers(id) ON DELETE CASCADE,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    UNIQUE (caretaker_id, property_id)
);

-- =========================================================
--  SYSTEM ADMINS & PAYBILLS
-- =========================================================

CREATE TABLE IF NOT EXISTS system_admins (
    id             BIGSERIAL PRIMARY KEY,
    auth_user_id   UUID UNIQUE NOT NULL,
    full_name      TEXT NOT NULL,
    email          TEXT NOT NULL,
    phone          TEXT,
    is_super       BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paybills (
    id                 BIGSERIAL PRIMARY KEY,
    shortcode          TEXT NOT NULL,
    name               TEXT NOT NULL,
    account_type       TEXT NOT NULL DEFAULT 'wallet_per_tenancy',
    provider           TEXT NOT NULL DEFAULT 'safaricom',
    is_active          BOOLEAN DEFAULT TRUE,
    owner_landlord_id  BIGINT REFERENCES landlords(id) ON DELETE SET NULL,
    created_by_admin   BIGINT REFERENCES system_admins(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shortcode)
);

CREATE TABLE tenants (
    id                  BIGSERIAL PRIMARY KEY,
    full_name           VARCHAR(255) NOT NULL,
    phone               VARCHAR(50) NOT NULL,
    email               VARCHAR(255),
    id_number           VARCHAR(100),
    next_of_kin_name    VARCHAR(255),
    next_of_kin_phone   VARCHAR(50),
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE units (
    id              BIGSERIAL PRIMARY KEY,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_code       VARCHAR(50) NOT NULL,
    floor           VARCHAR(50),
    type            VARCHAR(50),
    base_rent       NUMERIC(12,2) NOT NULL DEFAULT 0,
    waste_fee       NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'vacant',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, unit_code)
);

-- =========================================================
--  TENANCIES (link tenant <-> unit)
-- =========================================================

CREATE TABLE tenancies (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    unit_id         BIGINT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    landlord_id     BIGINT NOT NULL REFERENCES landlords(id) ON DELETE RESTRICT,
    start_date      DATE NOT NULL,
    end_date        DATE,
    rent_amount     NUMERIC(12,2) NOT NULL,
    deposit_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    billing_day     INT NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    agreement_url   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenancies_active
    ON tenancies (status, start_date, end_date);

-- =========================================================
--  WALLET SYSTEM (per tenancy/unit)
-- =========================================================

CREATE TABLE wallet_accounts (
    id                  BIGSERIAL PRIMARY KEY,
    tenancy_id          BIGINT NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    landlord_id         BIGINT REFERENCES landlords(id) ON DELETE SET NULL,
    paybill_id          BIGINT REFERENCES paybills(id) ON DELETE SET NULL,
    account_reference   VARCHAR(100) NOT NULL,
    balance             NUMERIC(12,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_reference),
    UNIQUE (tenancy_id)
);

CREATE TABLE wallet_transactions (
    id                  BIGSERIAL PRIMARY KEY,
    wallet_id           BIGINT NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    tenancy_id          BIGINT NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    landlord_id         BIGINT REFERENCES landlords(id) ON DELETE SET NULL,
    paybill_id          BIGINT REFERENCES paybills(id) ON DELETE SET NULL,
    type                VARCHAR(10) NOT NULL,
    source              VARCHAR(50) NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    mpesa_receipt       VARCHAR(100),
    phone               VARCHAR(50),
    narration           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_wallet
    ON wallet_transactions (wallet_id, created_at DESC);

-- =========================================================
--  BILLS & PAYMENTS
-- =========================================================

CREATE TABLE bills (
    id              BIGSERIAL PRIMARY KEY,
    tenancy_id      BIGINT NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    billing_period  VARCHAR(7) NOT NULL,
    rent_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    water_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    waste_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    penalty_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_charges   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    due_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenancy_id, billing_period)
);

CREATE INDEX idx_bills_status
    ON bills (status, due_date);

CREATE TABLE payments (
    id              BIGSERIAL PRIMARY KEY,
    bill_id         BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    tenancy_id      BIGINT NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    wallet_id       BIGINT NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    method          VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'successful',
    paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_bill
    ON payments (bill_id);

-- =========================================================
--  APPLICATIONS (rental applications)
-- =========================================================

CREATE TABLE applications (
    id                  BIGSERIAL PRIMARY KEY,
    property_id         BIGINT REFERENCES properties(id) ON DELETE SET NULL,
    unit_id             BIGINT REFERENCES units(id) ON DELETE SET NULL,
    full_name           VARCHAR(255) NOT NULL,
    phone               VARCHAR(50) NOT NULL,
    email               VARCHAR(255),
    id_number           VARCHAR(100),
    employment_info     TEXT,
    monthly_income      NUMERIC(12,2),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
--  WATER METER LOGS
-- =========================================================

CREATE TABLE water_meter_logs (
    id                      BIGSERIAL PRIMARY KEY,
    property_id             BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id                 BIGINT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenancy_id              BIGINT REFERENCES tenancies(id) ON DELETE SET NULL,
    caretaker_id            BIGINT REFERENCES caretakers(id) ON DELETE SET NULL,
    reading_date            DATE NOT NULL,
    reading_value           NUMERIC(12,2) NOT NULL,
    previous_reading_value  NUMERIC(12,2),
    units_used              NUMERIC(12,2),
    price_per_unit          NUMERIC(12,4),
    amount                  NUMERIC(12,2),
    billing_period          VARCHAR(7),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_water_logs_unit_period
    ON water_meter_logs (unit_id, billing_period);

-- =========================================================
--  TICKETS (issues/maintenance)
-- =========================================================

CREATE TABLE tickets (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
    tenancy_id      BIGINT REFERENCES tenancies(id) ON DELETE SET NULL,
    property_id     BIGINT REFERENCES properties(id) ON DELETE SET NULL,
    unit_id         BIGINT REFERENCES units(id) ON DELETE SET NULL,
    caretaker_id    BIGINT REFERENCES caretakers(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
    created_by      VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE ticket_messages (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sender_type     VARCHAR(20) NOT NULL,
    sender_id       BIGINT NOT NULL,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
--  ANNOUNCEMENTS
-- =========================================================

CREATE TABLE announcements (
    id              BIGSERIAL PRIMARY KEY,
    landlord_id     BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    property_id     BIGINT REFERENCES properties(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    target_type     VARCHAR(30) NOT NULL DEFAULT 'property',
    unit_id         BIGINT REFERENCES units(id) ON DELETE SET NULL,
    tenant_id       BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
    visible_from    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visible_to      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
--  DOCUMENTS (IDs, agreements, uploads)
-- =========================================================

CREATE TABLE documents (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
    tenancy_id      BIGINT REFERENCES tenancies(id) ON DELETE SET NULL,
    application_id  BIGINT REFERENCES applications(id) ON DELETE SET NULL,
    type            VARCHAR(50) NOT NULL,
    file_url        TEXT NOT NULL,
    uploaded_by     VARCHAR(20) NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
--  VACATE REQUESTS
-- =========================================================

CREATE TABLE vacate_requests (
    id                      BIGSERIAL PRIMARY KEY,
    tenancy_id              BIGINT NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    tenant_id               BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requested_move_out_date DATE NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    reason                  TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
--  PUBLIC LISTINGS (vacant units for website)
-- =========================================================

CREATE TABLE public_listings (
    id              BIGSERIAL PRIMARY KEY,
    unit_id         BIGINT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    rent_amount     NUMERIC(12,2) NOT NULL,
    photos          JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    listed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at      TIMESTAMPTZ
);

-- =========================================================
--  NOTIFICATIONS (in-app)
-- =========================================================

CREATE TABLE notifications (
    id                  BIGSERIAL PRIMARY KEY,
    user_type           VARCHAR(20) NOT NULL,
    user_id             BIGINT NOT NULL,
    title               VARCHAR(255) NOT NULL,
    message             TEXT NOT NULL,
    type                VARCHAR(50) NOT NULL,
    related_tenancy_id  BIGINT REFERENCES tenancies(id) ON DELETE SET NULL,
    related_bill_id     BIGINT REFERENCES bills(id) ON DELETE SET NULL,
    related_ticket_id   BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user
    ON notifications (user_type, user_id, created_at DESC);

-- =========================================================
--  SMS LOGS
-- =========================================================

CREATE TABLE sms_logs (
    id                  BIGSERIAL PRIMARY KEY,
    recipient_phone     VARCHAR(50) NOT NULL,
    recipient_type      VARCHAR(20),
    related_tenancy_id  BIGINT REFERENCES tenancies(id) ON DELETE SET NULL,
    related_bill_id     BIGINT REFERENCES bills(id) ON DELETE SET NULL,
    related_wallet_id   BIGINT REFERENCES wallet_accounts(id) ON DELETE SET NULL,
    related_ticket_id   BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    template_code       VARCHAR(100),
    message_text        TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'queued',
    provider_response   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ
);

CREATE INDEX idx_sms_logs_phone
    ON sms_logs (recipient_phone, created_at DESC);

-- =========================================================
--  TENANT LEADS (caretaker -> landlord approval)
-- =========================================================

CREATE TABLE IF NOT EXISTS tenant_leads (
    id             BIGSERIAL PRIMARY KEY,
    caretaker_id   BIGINT REFERENCES caretakers(id) ON DELETE SET NULL,
    landlord_id    BIGINT REFERENCES landlords(id) ON DELETE CASCADE,
    property_id    BIGINT REFERENCES properties(id) ON DELETE CASCADE,
    unit_id        BIGINT REFERENCES units(id) ON DELETE SET NULL,
    tenant_id      BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
    tenancy_id     BIGINT REFERENCES tenancies(id) ON DELETE SET NULL,
    full_name      TEXT NOT NULL,
    phone          TEXT NOT NULL,
    email          TEXT,
    notes          TEXT,
    status         TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
--  AUTH USER LINKS / PAYBILL FK
-- =========================================================

ALTER TABLE landlords
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

ALTER TABLE landlords
    ADD COLUMN IF NOT EXISTS landlord_type TEXT DEFAULT 'individual';

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

ALTER TABLE caretakers
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

ALTER TABLE landlords
    ADD COLUMN IF NOT EXISTS paybill_id bigint REFERENCES paybills(id);

ALTER TABLE wallet_accounts
    ADD COLUMN IF NOT EXISTS paybill_id bigint REFERENCES paybills(id),
    ADD COLUMN IF NOT EXISTS landlord_id bigint REFERENCES landlords(id);

ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS paybill_id bigint REFERENCES paybills(id),
    ADD COLUMN IF NOT EXISTS landlord_id bigint REFERENCES landlords(id);
