-- Auction handover proof moves to private storage.
--
-- WHY: the seller's handover proof — photographs of the vehicle changing hands
-- and, in at least one live case, a signed PDF handover document carrying both
-- parties' names and addresses — was uploaded straight from the browser into
-- the PUBLIC `listings` bucket under `handover/<auctionId>/`, and the permanent
-- public URL was stored on the auction. Any holder of a link could read it.
-- It is also the evidence that releases a £100 payout.
--
-- PR #97 removed anonymous enumeration of the bucket and blocked client-side
-- deletes, but deliberately kept public delivery as "temporary legacy
-- compatibility" for already-released mobile clients. That compatibility is
-- still needed for the mobile app, so this migration closes the web path only
-- and leaves the mobile upload prefix working. See the policy note in step 4.
--
-- Additive: existing rows keep their public URL in `handoverProofUrl` so
-- nothing an admin can currently open disappears. New web uploads write an
-- object key to `handoverProofPath` and are served as 10-minute signed URLs.
--
-- Apply with:
--   psql "$DIRECT_URL" -f prisma/migrations/auction_handover_private_documents.sql
--
-- Safe to run more than once.

-- 1. Private bucket. Not public, 10 MB, documents and images only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'auction-handover-documents',
    'auction-handover-documents',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public             = FALSE,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. No anon/authenticated policies for this bucket, on purpose. With RLS on
--    and no policy, only the service-role key reads or writes it — which is
--    exactly the backend-only access this data needs.

-- 3. Private object key alongside the legacy public URL.
ALTER TABLE auctions
    ADD COLUMN IF NOT EXISTS "handoverProofPath" TEXT;

-- 4. Stop stale web browsers writing new proof into the public bucket.
--
--    This matches ONLY `handover/%`, the path the web app used. The released
--    mobile app uploads to `<userId>/handover/%`, which this does not match, so
--    shipped phones keep working — blocking them would break handover submission
--    for every user who has not updated. Remove that carve-out once the mobile
--    app ships against POST /auctions/:id/handover-proof/document.
DROP POLICY IF EXISTS "Block public handover uploads" ON storage.objects;
CREATE POLICY "Block public handover uploads"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id <> 'listings'
        OR name NOT LIKE 'handover/%'
    );

-- 5. Audit: how much handover proof is still sitting in public storage.
--    Covers both the web prefix and the mobile one.
--
--   SELECT count(*) AS legacy_public_handover_objects
--   FROM storage.objects
--   WHERE bucket_id = 'listings'
--     AND (name LIKE 'handover/%' OR name LIKE '%/handover/%');

-- ── Follow-up 2026-09-23 ───────────────────────────────────────────────────
-- The carve-out in step 4 existed for "already-released mobile clients". There
-- are none: the mobile app is still in development and has never shipped. The
-- app now uploads through POST /auctions/:id/handover-proof/document like the
-- web client, so nothing writes to the public bucket any more and the mobile
-- prefix can be blocked too.
--
-- Existing objects are untouched; only new inserts are refused.
DROP POLICY IF EXISTS "Block public handover uploads" ON storage.objects;
CREATE POLICY "Block public handover uploads"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id <> 'listings'
        OR (name NOT LIKE 'handover/%' AND name NOT LIKE '%/handover/%')
    );
