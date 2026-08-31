DROP POLICY IF EXISTS "soundtrack own files select" ON storage.objects;
DROP POLICY IF EXISTS "soundtrack own files insert" ON storage.objects;
DROP POLICY IF EXISTS "soundtrack own files update" ON storage.objects;
DROP POLICY IF EXISTS "soundtrack own files delete" ON storage.objects;

CREATE POLICY "soundtrack own files select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "soundtrack own files insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "soundtrack own files update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "soundtrack own files delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'soundtrack' AND (storage.foldername(name))[1] = auth.uid()::text);