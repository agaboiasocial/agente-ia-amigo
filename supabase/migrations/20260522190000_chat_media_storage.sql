-- Public bucket used by IAS chat attachments before sending them through Evolution API.
-- The app uploads files directly from authenticated users and stores the public URL in messages.media_url.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/zip',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "chat_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_authenticated_delete" ON storage.objects;

CREATE POLICY "chat_media_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

CREATE POLICY "chat_media_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "chat_media_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-media')
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "chat_media_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media');
