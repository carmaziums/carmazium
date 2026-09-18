ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS "attachmentPath" text,
  ADD COLUMN IF NOT EXISTS "attachmentName" text,
  ADD COLUMN IF NOT EXISTS "attachmentMime" text,
  ADD COLUMN IF NOT EXISTS "attachmentSize" integer;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
