ALTER TABLE public.chat_rooms
  ALTER COLUMN context SET DEFAULT 'LEGACY'::"chat_context",
  ALTER COLUMN "conversationKey" SET DEFAULT ('LEGACY:' || gen_random_uuid()::text);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_rooms_initiatorId_participantId_key"
  ON public.chat_rooms ("initiatorId", "participantId");
