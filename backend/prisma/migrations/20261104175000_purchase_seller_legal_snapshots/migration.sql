-- Private buyer accounting evidence: never expose through public PostgREST.
-- Collecting identifying seller data requires current seller notice, a justified
-- retention schedule and documented deletion/rectification policy before
-- PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED is switched on.
CREATE TABLE IF NOT EXISTS public.purchase_seller_legal_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "saleId" TEXT NOT NULL UNIQUE,
  "listingId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "saleRecordedAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS purchase_seller_legal_snapshots_buyer_sale_idx
  ON public.purchase_seller_legal_snapshots ("buyerId", "saleId");
ALTER TABLE public.purchase_seller_legal_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_seller_legal_snapshots FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.purchase_seller_legal_snapshots IS
 'Private immutable-on-create seller identity as at capture time for authorised purchase receipts. Must be managed by an approved data retention/rectification procedure. Never copy bank or KYC ID files.';
