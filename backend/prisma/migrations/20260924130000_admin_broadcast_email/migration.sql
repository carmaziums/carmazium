CREATE TYPE public.broadcast_email_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE public.broadcast_campaigns
  ADD COLUMN "emailSent" integer NOT NULL DEFAULT 0,
  ADD COLUMN "emailFailed" integer NOT NULL DEFAULT 0,
  ADD COLUMN "emailSkipped" integer NOT NULL DEFAULT 0;

ALTER TABLE public.broadcast_deliveries
  ADD COLUMN "emailStatus" public.broadcast_email_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "emailMessageId" text,
  ADD COLUMN "emailError" text,
  ADD COLUMN "emailSentAt" timestamp(3);

CREATE INDEX "broadcast_deliveries_campaignId_emailStatus_idx"
  ON public.broadcast_deliveries ("campaignId", "emailStatus");
