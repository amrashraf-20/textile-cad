-- 0001_init.sql — core schema
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE plan_tier AS ENUM ('free','pro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email            citext NOT NULL UNIQUE,
    password_hash    text NOT NULL,
    full_name        text NOT NULL,
    role             user_role NOT NULL DEFAULT 'user',
    plan             plan_tier NOT NULL DEFAULT 'free',
    locale           text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar','en')),
    email_verified_at timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    locale        text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar','en')),
    theme         text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
    currency      text NOT NULL DEFAULT 'EGP' CHECK (currency IN ('EGP','USD')),
    notifications jsonb NOT NULL DEFAULT '{"product":true,"security":true}'::jsonb,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  bytea NOT NULL UNIQUE,
    user_agent  text NOT NULL DEFAULT '',
    ip          inet,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    replaced_by uuid,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS designs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    description  text NOT NULL DEFAULT '',
    warp_ends    int NOT NULL CHECK (warp_ends BETWEEN 2 AND 100),
    weft_picks   int NOT NULL CHECK (weft_picks BETWEEN 2 AND 100),
    weave_data   jsonb NOT NULL DEFAULT '[]'::jsonb,
    cell_colors  jsonb NOT NULL DEFAULT '[]'::jsonb,
    warp_colors  jsonb NOT NULL DEFAULT '[]'::jsonb,
    weft_colors  jsonb NOT NULL DEFAULT '[]'::jsonb,
    settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
    thumbnail    text,
    version      int NOT NULL DEFAULT 1,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS designs_user_updated_idx ON designs(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS design_versions (
    id         bigserial PRIMARY KEY,
    design_id  uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    version    int NOT NULL,
    snapshot   jsonb NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS design_versions_design_idx ON design_versions(design_id, version DESC);

CREATE TABLE IF NOT EXISTS yarns (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
    name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    system     text NOT NULL CHECK (system IN ('ne','tex','denier')),
    count      numeric(10,3) NOT NULL CHECK (count > 0),
    material   text NOT NULL DEFAULT '',
    price_egp  numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_egp >= 0),
    is_global  boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS yarns_owner_name_idx ON yarns (user_id, lower(name)) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS yarns_global_idx ON yarns(is_global) WHERE is_global;

CREATE TABLE IF NOT EXISTS price_rates (
    key        text PRIMARY KEY,
    value      numeric(14,4) NOT NULL,
    unit       text NOT NULL DEFAULT '',
    source     text NOT NULL DEFAULT '',
    fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    design_id  uuid REFERENCES designs(id) ON DELETE SET NULL,
    kind       text NOT NULL CHECK (kind IN ('consumption','erp','sample','loom','density')),
    input      jsonb NOT NULL,
    result     jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_user_idx ON quotes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS share_links (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id  uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    view_count int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_design_idx ON share_links(design_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         bigserial PRIMARY KEY,
    user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    action     text NOT NULL,
    entity     text NOT NULL DEFAULT '',
    entity_id  text NOT NULL DEFAULT '',
    ip         inet,
    user_agent text NOT NULL DEFAULT '',
    meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan         plan_tier NOT NULL,
    status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','expired')),
    provider     text NOT NULL DEFAULT 'manual',
    provider_ref text NOT NULL DEFAULT '',
    started_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS designs_set_updated_at ON designs;
CREATE TRIGGER designs_set_updated_at BEFORE UPDATE ON designs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS yarns_set_updated_at ON yarns;
CREATE TRIGGER yarns_set_updated_at BEFORE UPDATE ON yarns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
