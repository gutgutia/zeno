-- Migration: Add storage bucket for workspace logos
-- This enables direct logo uploads instead of relying on external URLs

-- Create the logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,  -- Public bucket so logos can be displayed without auth
  2097152,  -- 2MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Allow authenticated users to upload to their workspace's folder
CREATE POLICY "Users can upload logos to their workspace"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' AND
  -- Path format: {workspace_id}/logo.{ext}
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- Allow authenticated users to update/replace their workspace logos
CREATE POLICY "Users can update their workspace logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- Allow authenticated users to delete their workspace logos
CREATE POLICY "Users can delete their workspace logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- Allow public read access to all logos (since bucket is public)
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');
