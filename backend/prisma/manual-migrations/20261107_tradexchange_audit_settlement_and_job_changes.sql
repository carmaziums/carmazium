-- TradeXchange audit: additive settlement recovery and participant requests.
-- No role grants or RLS changes. Apply before deploying the corresponding API.
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS "changeRequest" jsonb;
ALTER TABLE public.service_payments
  ADD COLUMN IF NOT EXISTS "settlementStartedAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "settlementTransferId" text,
  ADD COLUMN IF NOT EXISTS "stripeRefundId" text,
  ADD COLUMN IF NOT EXISTS "stripeRefundStatus" text,
  ADD COLUMN IF NOT EXISTS "refundAmountPence" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "originalTransferId" text,
  ADD COLUMN IF NOT EXISTS "stripeReversalId" text,
  ADD COLUMN IF NOT EXISTS "externalDisputeId" text,
  ADD COLUMN IF NOT EXISTS "externalDisputeStatus" text;
CREATE UNIQUE INDEX IF NOT EXISTS "service_payments_stripeRefundId_key" ON public.service_payments ("stripeRefundId");
ALTER TABLE public.service_jobs DROP CONSTRAINT IF EXISTS service_jobs_purchase_source_delivery_only;
ALTER TABLE public.service_jobs ADD CONSTRAINT service_jobs_purchase_source_service_type CHECK (
 ("sourceOfferId" IS NULL AND "sourceAuctionId" IS NULL)
 OR "serviceType"::text = 'DELIVERY'
 OR ("serviceType"::text = 'INSPECTION' AND "sourceAuctionId" IS NOT NULL AND "sourceOfferId" IS NULL)
);
DROP INDEX IF EXISTS public.service_jobs_active_source_offer_uidx;
DROP INDEX IF EXISTS public.service_jobs_active_source_auction_uidx;
CREATE UNIQUE INDEX service_jobs_active_source_offer_uidx ON public.service_jobs ("sourceOfferId", "serviceType")
 WHERE "sourceOfferId" IS NOT NULL AND status NOT IN ('CANCELLED', 'EXPIRED');
CREATE UNIQUE INDEX service_jobs_active_source_auction_uidx ON public.service_jobs ("sourceAuctionId", "serviceType")
 WHERE "sourceAuctionId" IS NOT NULL AND status NOT IN ('CANCELLED', 'EXPIRED');
ALTER TABLE public.service_settlement_operations DROP CONSTRAINT IF EXISTS service_settlement_operations_outcome_check;
ALTER TABLE public.service_settlement_operations ADD CONSTRAINT service_settlement_operations_outcome_check CHECK (outcome IN ('RELEASE', 'REFUND', 'PARTIAL_REFUND'));
