-- Remove the unused pre-marketplace direct service request model.
--
-- `service_requests` predates the canonical TradeXchange marketplace based on
-- service_jobs / service_quotes / service_payments. Production was verified to
-- contain zero rows before this migration was authored.
--
-- Fail closed if data appears before deployment. Do not silently destroy it.
DO $$
BEGIN
  IF to_regclass('public.service_requests') IS NOT NULL
     AND EXISTS (SELECT 1 FROM "service_requests" LIMIT 1) THEN
    RAISE EXCEPTION 'service_requests is not empty; aborting legacy TradeXchange cleanup';
  END IF;
END $$;

DROP TABLE IF EXISTS "service_requests";
DROP TYPE IF EXISTS "service_status";
