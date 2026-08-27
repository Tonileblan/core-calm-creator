CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  voz_preferida text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado_emocional text NOT NULL,
  tipo_checkin text NOT NULL CHECK (tipo_checkin IN ('emergencia','rutina_manana','rutina_noche')),
  energia integer,
  foco_dia text,
  gratitud text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own check_ins" ON public.check_ins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX check_ins_user_created_idx ON public.check_ins (user_id, created_at DESC);

CREATE TABLE public.saved_meditations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  titulo text NOT NULL,
  objetivo text,
  metodologia text NOT NULL,
  duracion_minutos integer NOT NULL,
  audio_url text,
  guion_texto text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_meditations TO authenticated;
GRANT ALL ON public.saved_meditations TO service_role;
ALTER TABLE public.saved_meditations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meditations" ON public.saved_meditations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.vital_soundtrack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nombre_cancion text NOT NULL,
  artista text,
  categoria_momento text NOT NULL CHECK (categoria_momento IN ('celebrar','despertar','relajacion','dormir')),
  url_enlace text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vital_soundtrack TO authenticated;
GRANT ALL ON public.vital_soundtrack TO service_role;
ALTER TABLE public.vital_soundtrack ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own soundtrack" ON public.vital_soundtrack FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alarms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo_alarma text NOT NULL,
  hora_programada time NOT NULL,
  dias_semana text[] NOT NULL DEFAULT '{}',
  accion_vinculada text,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarms_settings TO authenticated;
GRANT ALL ON public.alarms_settings TO service_role;
ALTER TABLE public.alarms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alarms" ON public.alarms_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mental_gym_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo_ejercicio text NOT NULL,
  duracion_minutos integer NOT NULL DEFAULT 0,
  completado boolean NOT NULL DEFAULT true,
  detalle jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mental_gym_stats TO authenticated;
GRANT ALL ON public.mental_gym_stats TO service_role;
ALTER TABLE public.mental_gym_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gym stats" ON public.mental_gym_stats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX mental_gym_user_created_idx ON public.mental_gym_stats (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();