-- ============================================================
-- VOLEIBOL EUSKADI — Base de Datos Completa
-- ============================================================
-- Este archivo contiene TODO el esquema de la base de datos.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    avatar_url TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: favorites
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL
        CHECK (entity_type IN ('team', 'competition', 'league', 'tournament', 'match')),
    entity_id VARCHAR(100) NOT NULL,
    entity_name TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_id)
);

ALTER TABLE favorites ADD COLUMN IF NOT EXISTS entity_name TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS update_favorites_updated_at ON favorites;
CREATE TRIGGER update_favorites_updated_at
    BEFORE UPDATE ON favorites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_favorites_user_order
    ON favorites (user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_entity ON favorites(entity_type, entity_id);

-- ============================================================
-- TABLA: push_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform VARCHAR(10) NOT NULL
        CHECK (platform IN ('ios', 'android', 'web')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active) WHERE active = true;

-- ============================================================
-- TABLA: sync_log
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL
        CHECK (action IN ('create', 'update', 'delete')),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_time ON sync_log(synced_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id);

-- ============================================================
-- TABLA: blocked_devices
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform VARCHAR(10) NOT NULL,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_devices_user ON blocked_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_devices_device ON blocked_devices(device_id);

-- ============================================================
-- TABLA: teams_data
-- ============================================================
CREATE TABLE IF NOT EXISTS teams_data (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    base_name TEXT NOT NULL UNIQUE,
    color TEXT,
    youtube_id TEXT,
    youtube_patterns JSONB DEFAULT '[]'::jsonb,
    youtube_name TEXT,
    youtube_priority BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_data_base_name ON teams_data(base_name);

-- ============================================================
-- DATOS: teams_data
-- ============================================================
INSERT INTO teams_data (base_name, color, youtube_id, youtube_patterns, youtube_name, youtube_priority) VALUES
  ('OCISA',       '#36906D', 'UC9bIaWAOGv4hGkGgN-FDnhQ', '["logrono","logroño"]',                           'Ocisa Logroño',         false),
  ('AIDEAN',      '#E65900', 'UChXUSuJD-XCLjmFZUYcCtVg', '["aidean"]',                                    'Aidean ZKE',            false),
  ('AIXERROTA',   '#8B0135', NULL, NULL, NULL, NULL),
  ('ARMENTIA',    '#F46B27', NULL, NULL, NULL, NULL),
  ('ARIZMENDI',   '#8C2377', NULL, NULL, NULL, NULL),
  ('BERA BERA',   '#3173C7', 'UCs8IABn1087s4X_xrHCHbJQ', '["bera bera","berabera"]',                     'Bera Bera',             false),
  ('CARMELITAS',  '#0B87DD', NULL, NULL, NULL, NULL),
  ('DIOS',        '#55B9E1', 'UCxGbXULdYqJJTn97vBhK8cw', '["madre de dios","madi","deusto"]',            'Madre de Dios Deusto',  false),
  ('EGIBIDE',     '#80005D', NULL, NULL, NULL, NULL),
  ('EKIALDE',     '#5081D0', 'UCEeow14MIifOsTXS4uSCB5g', '["ekialde"]',                                   'Cafés Foronda Ekialde', false),
  ('FORTUNA',     '#FA6D28', NULL, NULL, NULL, NULL),
  ('GALDAKAO',    '#0277B7', 'UCheRHnoAnFsI7Ogd9xSYAFQ', '["galdakao"]',                                 'Galdakao',              false),
  ('GALLARTA',    '#008300', 'UCi0OUunq4dpoeIDnrRnKaiw', '["gallarta"]',                                  'Gallartaren Ahotsa',    false),
  ('GETXO',       '#8B0135', 'UCYHKUaL8kC4QDe5Cx7TgMyg', '["getxo"]',                                   'Getxo',                 true),
  ('HERNANI',     '#2F2F2F', NULL, NULL, NULL, NULL),
  ('HRV',         '#003261', NULL, NULL, NULL, NULL),
  ('JATORKIDE',   '#592e77', 'UCDv0NQL_EFWtPC3i5v_Drbw', '["jatorkide"]',                                'Jatorkide',             true),
  ('KOLDO',       '#EEE300', NULL, NULL, NULL, NULL),
  ('LEKEITIO',    '#EC990D', NULL, NULL, NULL, NULL),
  ('LOGROÑO',     '#941109', NULL, NULL, NULL, NULL),
  ('MARIANISTAS', '#E02512', NULL, NULL, NULL, NULL),
  ('MENDEBALDEA', '#743409', NULL, NULL, NULL, NULL),
  ('MERCEDARIAS', '#253769', NULL, NULL, NULL, NULL),
  ('NAVARVOLEY',  '#DF2F2F', 'UC_utcf6nsss9TBzw0IkTs2w', '["navar"]',                                   'Navarvoley',            false),
  ('OSTADAR',     '#7A5F38', NULL, NULL, NULL, NULL),
  ('OTSOKUMEAK',  '#515151', NULL, NULL, NULL, NULL),
  ('REKALDE',     '#032A75', NULL, NULL, NULL, NULL),
  ('SANTANDER',   '#C20E1A', NULL, NULL, NULL, NULL),
  ('SESTAO',      '#0D5427', 'UC0RH2gitr2hjNYHhCENpzLg', '["sestao"]',                                  'C.V.Sestao',            false),
  ('UNAMUNO',     NULL, NULL, NULL, NULL, NULL),
  ('ZABALGANA',   '#743409', NULL, NULL, NULL, NULL),
  ('TOLOBOLEI',   NULL, 'UC0e86MqCMbNFoJBCWbLyPxQ', '["tolobolei"]',                                   'Tolobolei',             false)
ON CONFLICT (base_name) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY: DESACTIVADO
-- ============================================================
-- Sin Supabase Auth, auth.uid() es siempre null.
-- RLS bloquea toda operación, por lo que se desactiva.

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams_data DISABLE ROW LEVEL SECURITY;

-- Limpiar políticas huérfanas por si existieran
DROP POLICY IF EXISTS users_select_public ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS users_insert_trigger ON users;
DROP POLICY IF EXISTS favorites_select_own ON favorites;
DROP POLICY IF EXISTS favorites_insert_own ON favorites;
DROP POLICY IF EXISTS favorites_delete_own ON favorites;
DROP POLICY IF EXISTS push_tokens_select_own ON push_tokens;
DROP POLICY IF EXISTS push_tokens_insert_own ON push_tokens;
DROP POLICY IF EXISTS push_tokens_update_own ON push_tokens;
DROP POLICY IF EXISTS push_tokens_delete_own ON push_tokens;
DROP POLICY IF EXISTS sync_log_select_auth ON sync_log;
DROP POLICY IF EXISTS blocked_devices_admin_all ON blocked_devices;
DROP POLICY IF EXISTS blocked_devices_insert_own ON blocked_devices;
DROP POLICY IF EXISTS "Allow public SELECT" ON teams_data;

-- ============================================================
-- FUNCIONES Y VISTAS
-- ============================================================

-- Vista: usuarios bloqueados
CREATE OR REPLACE VIEW blocked_users_view AS
SELECT u.id, u.username, u.email, u.is_blocked, u.blocked_at, u.blocked_reason,
       (SELECT COUNT(*) FROM blocked_devices bd WHERE bd.user_id = u.id) as devices_count
FROM users u
WHERE u.is_blocked = true;

-- Función: verificar si un usuario está bloqueado
CREATE OR REPLACE FUNCTION check_user_blocked(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    blocked BOOLEAN;
BEGIN
    SELECT is_blocked INTO blocked FROM users WHERE id = check_user_id;
    RETURN COALESCE(blocked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'Base de datos completa creada' AS status;

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'favorites', 'push_tokens', 'sync_log', 'blocked_devices', 'teams_data')
ORDER BY table_name;
