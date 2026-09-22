-- Dealer KYC documents move to private storage.
--
-- WHY: KycOverlayForm uploaded passports, driving licences, proof of address,
-- VAT certificates and Companies House certificates straight from the browser
-- into the PUBLIC `listings` bucket, and stored the permanent public URL. Any
-- holder of a link could read a customer's identity document, and no backend
-- code was involved at any point. TradeXchange documents and chat attachments
-- were already private; dealer KYC was never brought across.
--
-- This migration is additive. Existing rows keep their legacy public URLs in
-- the original columns so nothing an admin can currently open disappears; new
-- uploads write an object key to the matching *Path column and are served as
-- 10-minute signed URLs.
--
-- Apply with:
--   psql "$DIRECT_URL" -f prisma/migrations/dealer_kyc_private_documents.sql
--
-- Safe to run more than once.

-- 1. Private bucket. Not public, 10 MB, documents and images only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'dealer-kyc-documents',
    'dealer-kyc-documents',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public             = FALSE,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. No anon/authenticated policies are created for this bucket on purpose.
--    With RLS on and no policy, only the service-role key can read or write,
--    which is exactly the backend-only access this data needs.

-- 3. Private object keys alongside the legacy public URLs.
ALTER TABLE dealer_kycs
    ADD COLUMN IF NOT EXISTS "vatProofPath"                 TEXT,
    ADD COLUMN IF NOT EXISTS "companyRegistrationProofPath" TEXT,
    ADD COLUMN IF NOT EXISTS "directorIdProofPath"          TEXT,
    ADD COLUMN IF NOT EXISTS "proofOfAddressPath"           TEXT;

-- 4. Stop stale browsers writing new identity documents into the public
--    bucket. Mirrors how the TradeXchange folders were blocked. Existing
--    objects are untouched; only new inserts under `kyc/` are refused.
DROP POLICY IF EXISTS "Block public KYC uploads" ON storage.objects;
CREATE POLICY "Block public KYC uploads"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id <> 'listings'
        OR name NOT LIKE 'kyc/%'
    );

-- 5. Audit: how many identity documents are still sitting in public storage.
--    Run this after applying, and again after the backfill decision.
--
--   SELECT count(*) AS legacy_public_kyc_objects
--   FROM storage.objects
--   WHERE bucket_id = 'listings' AND name LIKE 'kyc/%';

-- ── Follow-up 2026-09-22 ───────────────────────────────────────────────────
-- The orphan audit found four `kyc/` objects referenced by paymentScreenshot,
-- a fifth column the first pass did not cover. These are bank-transfer
-- receipts from the pre-Stripe £1 KYC fee: they carry bank details and are
-- still rendered in admin review, so they move to private storage too.
ALTER TABLE dealer_kycs
    ADD COLUMN IF NOT EXISTS "paymentScreenshotPath" TEXT;
