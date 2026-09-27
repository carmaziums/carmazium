-- Block 8 historical auction-data cleanup (27 September 2026)
--
-- This is intentionally a narrow, evidence-backed repair. It does not rewrite
-- bids, reserve prices, winning prices, Sales, payment Transactions,
-- cancellation history, handover evidence, seller payouts or seller counters.
--
-- Production audit immediately before this migration:
--
-- 1) 13 closed auctions were created under the legacy pricing bug with
--    buyItNowPrice < reservePrice. All 13 have:
--      * status ENDED or CANCELLED
--      * no winner / winning amount
--      * no paid £125 buyer fee
--      * no Sale row
--      * no completed COMMISSION transaction
--      * no handover / seller bonus / payout
--    Two contain ordinary bid history, which is preserved unchanged.
--    The safest repair is therefore to remove only the impossible legacy BIN
--    option (set buyItNowPrice = NULL), not invent a different historical price.
--
-- 2) Two closed auctions retain wonAt despite having no winner or winning
--    amount. Clear only the stale wonAt marker.
--
-- 3) 23 ENDED auctions with a winner but wonAt = NULL are deliberately NOT
--    changed. They all pre-date the 6 August 2026 introduction of the current
--    72-hour unpaid-winner expiry, and every one has a Sale whose buyer/price
--    exactly matches the auction winner/winning amount. Backfilling wonAt would
--    make the current expiry cron retroactively unwind grandfathered history.
--
-- 4) AUCTION/DRAFT listings without an Auction row are deliberately NOT
--    changed. Existing migration 20260925_reconcile_legacy_auction_listing_links.sql
--    documents these as valid pre-scheduling vehicle shells.
--
-- The guards below abort the whole transaction if production no longer matches
-- the audited safe set.

BEGIN;

DO $$
DECLARE
    invalid_bin_candidates integer;
    stale_won_at_candidates integer;
    unsafe_open_invalid_bin integer;
    post_feature_missing_won_at integer;
    grandfathered_winner_rows integer;
    grandfathered_sale_mismatches integer;
BEGIN
    SELECT count(*)
    INTO invalid_bin_candidates
    FROM public.auctions a
    JOIN (
        VALUES
            ('b0213c0a-3565-4787-be9b-bbc1b4ac8bef'::text, 'ENDED'::text,     25000.00::numeric, 23000.00::numeric),
            ('14af5bc7-fcb6-42db-b42e-cd2e24775e7e'::text, 'ENDED'::text,     23500.00::numeric, 23100.00::numeric),
            ('c88f91ee-142c-430b-b534-17f4494f08b6'::text, 'ENDED'::text,     21200.00::numeric, 20900.00::numeric),
            ('7c78b130-366c-48e1-ab4a-9076c2f62e1d'::text, 'ENDED'::text,     19000.00::numeric, 18250.00::numeric),
            ('4297ded8-7497-4118-9f79-e51e19cba2c4'::text, 'ENDED'::text,     13000.00::numeric, 10500.00::numeric),
            ('fdfc526d-da87-4f43-805c-7a0078ffdca2'::text, 'ENDED'::text,     11000.00::numeric, 10800.00::numeric),
            ('69da57d1-1358-4001-8b4f-e5bf9a6d44e6'::text, 'ENDED'::text,      3000.00::numeric,  2500.00::numeric),
            ('cf4e84fd-229d-4cbf-a8c7-204f3ac4365d'::text, 'ENDED'::text,      3500.00::numeric,  3000.00::numeric),
            ('636a41ee-5be5-42eb-ab10-a36652030f07'::text, 'CANCELLED'::text, 10000.00::numeric,  9250.00::numeric),
            ('3bb6133b-23cf-4011-bf8a-f16e03bb5081'::text, 'ENDED'::text,      2400.00::numeric,  2200.00::numeric),
            ('bdf556dc-b6c9-4429-987b-b08e06ef91b1'::text, 'ENDED'::text,       900.00::numeric,   800.00::numeric),
            ('33361836-ca2b-43ae-ac64-5fbc4c6ef0c5'::text, 'ENDED'::text,      3500.00::numeric,  3250.00::numeric),
            ('7d070c97-ac5d-4e17-a3a9-c14f50d7fc6e'::text, 'CANCELLED'::text, 14000.00::numeric, 13800.00::numeric)
    ) expected(id, status_text, reserve_price, bin_price)
      ON expected.id = a.id
    WHERE a."deletedAt" IS NULL
      AND a.status::text = expected.status_text
      AND a."reservePrice" = expected.reserve_price
      AND a."buyItNowPrice" = expected.bin_price
      AND a."buyItNowPrice" < a."reservePrice"
      AND a."winnerId" IS NULL
      AND a."winningBidAmount" IS NULL
      AND a."buyerFeePaid" = false
      AND a."buyerFeeTransactionId" IS NULL
      AND a."handoverSubmittedAt" IS NULL
      AND a."sellerBonusReleased" = false
      AND a."sellerBonusReleasedAt" IS NULL
      AND a."stripePayoutTransferId" IS NULL
      AND a."manualPayoutConfirmedAt" IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s."listingId" = a."listingId"
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.transactions t
          WHERE t."listingId" = a."listingId"
            AND t."deletedAt" IS NULL
            AND t.type::text = 'COMMISSION'
            AND t.status::text = 'COMPLETED'
      );

    IF invalid_bin_candidates <> 13 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: expected 13 safe legacy BIN rows, found %',
            invalid_bin_candidates;
    END IF;

    SELECT count(*)
    INTO unsafe_open_invalid_bin
    FROM public.auctions a
    WHERE a."deletedAt" IS NULL
      AND a.status::text IN ('ACTIVE', 'SCHEDULED')
      AND a."buyItNowPrice" IS NOT NULL
      AND a."buyItNowPrice" < a."reservePrice";

    IF unsafe_open_invalid_bin <> 0 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: found % open auctions with BIN below reserve',
            unsafe_open_invalid_bin;
    END IF;

    SELECT count(*)
    INTO stale_won_at_candidates
    FROM public.auctions a
    JOIN (
        VALUES
            ('fdfc526d-da87-4f43-805c-7a0078ffdca2'::text, timestamp '2026-08-30 11:16:00.148'),
            ('44c84c3b-4864-4534-b37a-36203cf87970'::text, timestamp '2026-08-31 10:10:00.219')
    ) expected(id, won_at)
      ON expected.id = a.id
    WHERE a."deletedAt" IS NULL
      AND a.status::text = 'ENDED'
      AND a."winnerId" IS NULL
      AND a."winningBidAmount" IS NULL
      AND a."wonAt" = expected.won_at
      AND a."buyerFeePaid" = false
      AND a."buyerFeeTransactionId" IS NULL
      AND a."handoverSubmittedAt" IS NULL
      AND a."sellerBonusReleased" = false
      AND a."sellerBonusReleasedAt" IS NULL
      AND a."stripePayoutTransferId" IS NULL
      AND a."manualPayoutConfirmedAt" IS NULL;

    IF stale_won_at_candidates <> 2 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: expected 2 stale no-winner wonAt rows, found %',
            stale_won_at_candidates;
    END IF;

    -- Any winner created after the unpaid-win expiry feature went live must
    -- carry wonAt. This must remain zero before we touch historical rows.
    SELECT count(*)
    INTO post_feature_missing_won_at
    FROM public.auctions a
    WHERE a."deletedAt" IS NULL
      AND a."winnerId" IS NOT NULL
      AND a."wonAt" IS NULL
      AND a."createdAt" >= timestamp '2026-08-06 00:00:00';

    IF post_feature_missing_won_at <> 0 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: found % post-feature winners missing wonAt',
            post_feature_missing_won_at;
    END IF;

    -- Grandfathered pre-feature winners remain valid only while their canonical
    -- Sale buyer and amount agree with auction history.
    SELECT count(*)
    INTO grandfathered_winner_rows
    FROM public.auctions a
    WHERE a."deletedAt" IS NULL
      AND a.status::text = 'ENDED'
      AND a."winnerId" IS NOT NULL
      AND a."wonAt" IS NULL
      AND a."createdAt" < timestamp '2026-08-06 00:00:00';

    IF grandfathered_winner_rows <> 23 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: expected 23 grandfathered winner rows, found %',
            grandfathered_winner_rows;
    END IF;

    SELECT count(*)
    INTO grandfathered_sale_mismatches
    FROM public.auctions a
    LEFT JOIN public.sales s ON s."listingId" = a."listingId"
    WHERE a."deletedAt" IS NULL
      AND a.status::text = 'ENDED'
      AND a."winnerId" IS NOT NULL
      AND a."wonAt" IS NULL
      AND a."createdAt" < timestamp '2026-08-06 00:00:00'
      AND (
          s.id IS NULL
          OR s."buyerId" IS DISTINCT FROM a."winnerId"
          OR s."soldPrice" IS DISTINCT FROM a."winningBidAmount"
      );

    IF grandfathered_sale_mismatches <> 0 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: % grandfathered winners do not match canonical Sale history',
            grandfathered_sale_mismatches;
    END IF;
END
$$;

-- Remove only the impossible legacy Buy It Now option. Reserve, starting bid,
-- real bids and all financial/history rows remain untouched.
UPDATE public.auctions
SET "buyItNowPrice" = NULL
WHERE id IN (
    'b0213c0a-3565-4787-be9b-bbc1b4ac8bef',
    '14af5bc7-fcb6-42db-b42e-cd2e24775e7e',
    'c88f91ee-142c-430b-b534-17f4494f08b6',
    '7c78b130-366c-48e1-ab4a-9076c2f62e1d',
    '4297ded8-7497-4118-9f79-e51e19cba2c4',
    'fdfc526d-da87-4f43-805c-7a0078ffdca2',
    '69da57d1-1358-4001-8b4f-e5bf9a6d44e6',
    'cf4e84fd-229d-4cbf-a8c7-204f3ac4365d',
    '636a41ee-5be5-42eb-ab10-a36652030f07',
    '3bb6133b-23cf-4011-bf8a-f16e03bb5081',
    'bdf556dc-b6c9-4429-987b-b08e06ef91b1',
    '33361836-ca2b-43ae-ac64-5fbc4c6ef0c5',
    '7d070c97-ac5d-4e17-a3a9-c14f50d7fc6e'
)
  AND "deletedAt" IS NULL
  AND status::text IN ('ENDED', 'CANCELLED')
  AND "winnerId" IS NULL
  AND "winningBidAmount" IS NULL
  AND "buyItNowPrice" < "reservePrice";

-- Remove only stale lifecycle timestamps that claim a win happened when the
-- auction currently has no winner/winning amount.
UPDATE public.auctions
SET "wonAt" = NULL
WHERE id IN (
    'fdfc526d-da87-4f43-805c-7a0078ffdca2',
    '44c84c3b-4864-4534-b37a-36203cf87970'
)
  AND "deletedAt" IS NULL
  AND status::text = 'ENDED'
  AND "winnerId" IS NULL
  AND "winningBidAmount" IS NULL;

DO $$
DECLARE
    remaining_invalid_bin integer;
    remaining_no_winner_won_at integer;
    remaining_post_feature_missing_won_at integer;
BEGIN
    SELECT count(*)
    INTO remaining_invalid_bin
    FROM public.auctions a
    WHERE a."deletedAt" IS NULL
      AND a."buyItNowPrice" IS NOT NULL
      AND a."buyItNowPrice" < a."reservePrice";

    IF remaining_invalid_bin <> 0 THEN
        RAISE EXCEPTION
            'Block 8 postcondition failed: % auctions still have BIN below reserve',
            remaining_invalid_bin;
    END IF;

    SELECT count(*)
    INTO remaining_no_winner_won_at
    FROM public.auctions a
    WHERE a."deletedAt" IS NULL
      AND a."winnerId" IS NULL
      AND a."wonAt" IS NOT NULL;

    IF remaining_no_winner_won_at <> 0 THEN
        RAISE EXCEPTION
            'Block 8 postcondition failed: % no-winner auctions still have wonAt',
            remaining_no_winner_won_at;
    END IF;

    SELECT count(*)
    INTO remaining_post_feature_missing_won_at
    FROM public.auctions a
    WHERE a."deletedAt" IS NULL
      AND a."winnerId" IS NOT NULL
      AND a."wonAt" IS NULL
      AND a."createdAt" >= timestamp '2026-08-06 00:00:00';

    IF remaining_post_feature_missing_won_at <> 0 THEN
        RAISE EXCEPTION
            'Block 8 postcondition failed: % post-feature winners are missing wonAt',
            remaining_post_feature_missing_won_at;
    END IF;
END
$$;

COMMIT;
