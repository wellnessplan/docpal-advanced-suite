-- Storage policies for patient-files bucket
CREATE POLICY "Authenticated users can upload patient files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Authenticated users can view patient files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'patient-files');

CREATE POLICY "Authenticated users can update patient files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'patient-files');

CREATE POLICY "Authenticated users can delete patient files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'patient-files');
