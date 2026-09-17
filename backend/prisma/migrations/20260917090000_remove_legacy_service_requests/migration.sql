-- Remove the unused pre-marketplace direct service request model.
--
-- `service_requests` predates the canonical TradeXchange marketplace based on
-- service_jobs / service_quotes / service_payments. Production was verified to
-- contain zero rows before this migration was authored.
--
-- Fail closed if data appears before deployment. Do not silently destroy it.
-- Keep the guard and destructive cleanup in one transaction so a later failure
-- cannot leave production in a partially-applied legacy-cleanup state.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.service_requests') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.service_requests LIMIT 1) THEN
    RAISE EXCEPTION 'service_requests is not empty; aborting legacy TradeXchange cleanup';
  END IF;
END $$;

DROP TABLE IF EXISTS public.service_requests;
DROP TYPE IF EXISTS public.service_status;

COMMIT;
