-- 1. Asegurar que el bucket soundtrack exista en Supabase Storage con acceso público y límites adecuados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'soundtrack',
  'soundtrack',
  true,
  104857600,
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/flac', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/flac', 'video/mp4'];

-- 2. Políticas de acceso para lectura pública y gestión por usuario
DROP POLICY IF EXISTS "soundtrack public select" ON storage.objects;
DROP POLICY IF EXISTS "soundtrack own files select" ON storage.objects;
CREATE POLICY "soundtrack public select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'soundtrack');

DROP POLICY IF EXISTS "soundtrack own files insert" ON storage.objects;
CREATE POLICY "soundtrack own files insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "soundtrack own files update" ON storage.objects;
CREATE POLICY "soundtrack own files update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "soundtrack own files delete" ON storage.objects;
CREATE POLICY "soundtrack own files delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);
