ALTER TYPE public.broadcast_campaign_status
  ADD VALUE IF NOT EXISTS 'SCHEDULED' BEFORE 'SENDING';

ALTER TYPE public.broadcast_campaign_status
  ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS "scheduledAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "startedAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" timestamp(3);

CREATE INDEX IF NOT EXISTS "broadcast_campaigns_status_scheduledAt_idx"
  ON public.broadcast_campaigns (status, "scheduledAt");
