ALTER TYPE public.chat_context
  ADD VALUE IF NOT EXISTS 'SERVICE_JOB';

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS "serviceJobId" text;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_rooms_serviceJobId_key"
  ON public.chat_rooms ("serviceJobId");

DO $$
BEGIN
  ALTER TABLE public.chat_rooms
    ADD CONSTRAINT "chat_rooms_serviceJobId_fkey"
    FOREIGN KEY ("serviceJobId")
    REFERENCES public.service_jobs(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
