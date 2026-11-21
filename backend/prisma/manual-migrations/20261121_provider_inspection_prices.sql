-- Each inspection provider owns its published price list. No platform-wide defaults.
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS "inspectionPrices" JSONB;
-- Existing providers start without published prices, rather than copying GDN rates.
