DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'broadcast_email_status'
  ) THEN
    CREATE TYPE public.broadcast_email_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
  END IF;
END
$$;

ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS "emailSent" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "emailFailed" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "emailSkipped" integer NOT NULL DEFAULT 0;

ALTER TABLE public.broadcast_deliveries
  ADD COLUMN IF NOT EXISTS "emailStatus" public.broadcast_email_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "emailMessageId" text,
  ADD COLUMN IF NOT EXISTS "emailError" text,
  ADD COLUMN IF NOT EXISTS "emailSentAt" timestamp(3);

CREATE INDEX IF NOT EXISTS "broadcast_deliveries_campaignId_emailStatus_idx"
  ON public.broadcast_deliveries ("campaignId", "emailStatus");
