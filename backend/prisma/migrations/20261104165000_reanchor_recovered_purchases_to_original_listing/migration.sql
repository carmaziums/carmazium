-- Restore the original seller's auction listing as the purchase source.
-- The dealer's later retail stock advert must never be required for purchase
-- history, and deleting it must not erase the original acquisition reference.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dealer_purchase_reconciliations
    WHERE "sourceListingId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Missing original seller listing: resolve before applying purchase reconciliation migration';
  END IF;
END $$;
ALTER TABLE public.dealer_purchase_reconciliations
  ALTER COLUMN "stockListingId" DROP NOT NULL,
  ALTER COLUMN "sourceListingId" SET NOT NULL;
ALTER TABLE public.dealer_purchase_reconciliations
  DROP CONSTRAINT IF EXISTS "dealer_purchase_reconciliations_sourceListingId_fkey";
ALTER TABLE public.dealer_purchase_reconciliations
  ADD CONSTRAINT "dealer_purchase_reconciliations_sourceListingId_fkey"
    FOREIGN KEY ("sourceListingId") REFERENCES public.listings(id) ON DELETE RESTRICT;
ALTER TABLE public.dealer_purchase_reconciliations
  DROP CONSTRAINT IF EXISTS "dealer_purchase_reconciliations_stockListingId_fkey";
ALTER TABLE public.dealer_purchase_reconciliations
  ADD CONSTRAINT "dealer_purchase_reconciliations_stockListingId_fkey"
    FOREIGN KEY ("stockListingId") REFERENCES public.listings(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "dealer_purchase_reconciliations_buyer_source_key"
  ON public.dealer_purchase_reconciliations ("buyerId", "sourceListingId");
COMMENT ON TABLE public.dealer_purchase_reconciliations IS
 'Owner-confirmed purchases from original seller auction listings; never sourced from subsequent retail stock adverts. No platform Sale, fee or reward is inferred.';
