-- ==============================================================================
-- MIGRACIÓN SUPABASE: ESQUEMA AISLADO mia_flowmind (BY TONI)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS mia_flowmind;
GRANT USAGE ON SCHEMA mia_flowmind TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA mia_flowmind TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mia_flowmind TO anon, authenticated, service_role, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA mia_flowmind GRANT ALL ON TABLES TO anon, authenticated, service_role, authenticator;

CREATE TABLE IF NOT EXISTS mia_flowmind.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  voz_preferida TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mia_flowmind.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estado_emocional TEXT NOT NULL,
  tipo_checkin TEXT NOT NULL,
  energia INTEGER,
  foco_dia TEXT,
  gratitud TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mia_flowmind.saved_meditations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  objetivo TEXT,
  metodologia TEXT NOT NULL,
  duracion_minutos INTEGER NOT NULL,
  audio_url TEXT,
  guion_texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mia_flowmind.vital_soundtrack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cancion TEXT NOT NULL,
  artista TEXT,
  categoria_momento TEXT NOT NULL,
  url_enlace TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mia_flowmind.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_flowmind.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_flowmind.saved_meditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_flowmind.vital_soundtrack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for profiles" ON mia_flowmind.profiles;
DROP POLICY IF EXISTS "Allow all for check_ins" ON mia_flowmind.check_ins;
DROP POLICY IF EXISTS "Allow all for saved_meditations" ON mia_flowmind.saved_meditations;
DROP POLICY IF EXISTS "Allow all for vital_soundtrack" ON mia_flowmind.vital_soundtrack;

CREATE POLICY "Allow all for profiles" ON mia_flowmind.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for check_ins" ON mia_flowmind.check_ins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for saved_meditations" ON mia_flowmind.saved_meditations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vital_soundtrack" ON mia_flowmind.vital_soundtrack FOR ALL USING (true) WITH CHECK (true);
