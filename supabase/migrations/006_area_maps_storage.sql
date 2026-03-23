-- Create storage bucket for area map images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'area-maps',
    'area-maps',
    true,
    524288, -- 500KB max file size
    ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for area maps (emails, browser)
CREATE POLICY "Public read access for area maps"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'area-maps');

-- Service role can manage area maps (upload, delete from server)
CREATE POLICY "Service role can manage area maps"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'area-maps')
WITH CHECK (bucket_id = 'area-maps');
