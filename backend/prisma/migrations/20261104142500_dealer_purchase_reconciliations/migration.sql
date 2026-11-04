-- Historical owner-attested purchases with missing CarMazium Sale rows.
-- A distinct record type preserves the original auction outcome, buyer fees,
-- seller rewards, and the original dealer Stock listing state.
CREATE TABLE IF NOT EXISTS public.dealer_purchase_reconciliations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "buyerId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "stockListingId" TEXT NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  "sourceListingId" TEXT REFERENCES public.listings(id) ON DELETE SET NULL,
  "vehicleVrm" TEXT NOT NULL,
  "collectedAt" DATE NOT NULL,
  "purchasePrice" NUMERIC(12,2),
  provenance TEXT NOT NULL DEFAULT 'OWNER_CONFIRMED',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dealer_purchase_reconciliations_buyer_stock_key UNIQUE ("buyerId","stockListingId"),
  CONSTRAINT dealer_purchase_reconciliations_status_check CHECK (status = 'COMPLETED'),
  CONSTRAINT dealer_purchase_reconciliations_price_check CHECK ("purchasePrice" IS NULL OR "purchasePrice" >= 0)
);
CREATE INDEX IF NOT EXISTS dealer_purchase_reconciliations_buyer_collected_idx
  ON public.dealer_purchase_reconciliations ("buyerId","collectedAt");
ALTER TABLE public.dealer_purchase_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dealer_purchase_reconciliations FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.dealer_purchase_reconciliations IS
 'Owner-confirmed recovered purchases; independent of auction winner, fees, rewards and sale proceeds.';
