ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS "clientMessageId" text;

CREATE UNIQUE INDEX IF NOT EXISTS "messages_senderId_clientMessageId_key"
  ON public.messages ("senderId", "clientMessageId");

DROP INDEX IF EXISTS public."messages_chatRoomId_createdAt_idx";

CREATE INDEX IF NOT EXISTS "messages_chatRoomId_createdAt_id_idx"
  ON public.messages ("chatRoomId", "createdAt" DESC, id DESC);
