-- Ensure the evidence bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence', 'evidence', true, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Allow public to upload files to evidence bucket
DROP POLICY IF EXISTS "Anon can upload evidence" ON storage.objects;
CREATE POLICY "Anon can upload evidence" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'evidence');

-- Allow public to read files from evidence bucket
DROP POLICY IF EXISTS "Anon can read evidence" ON storage.objects;
CREATE POLICY "Anon can read evidence" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'evidence');

-- Allow public to update (the agent might retry or overwrite)
DROP POLICY IF EXISTS "Anon can update evidence" ON storage.objects;
CREATE POLICY "Anon can update evidence" ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'evidence');
