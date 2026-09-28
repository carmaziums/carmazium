-- Block 8 follow-up: archive legacy bids from previous auction runs
-- 28 September 2026
--
-- Production audit found 17 unarchived, non-cancelled bids across 8 ENDED
-- auctions where bid.createdAt < auction.startTime. Those bids belong to
-- earlier auction runs and must not participate in the current run's bid
-- history/ranking. Current application code already archives prior-run bids
-- whenever an existing auction is restarted.
--
-- This repair preserves all bid rows and only stamps archivedAt. It does not
-- modify bidder, amount, winner, winningBidAmount, Sale, payment, handover,
-- cancellation, reserve or payout history.
--
-- AUCTION/DRAFT listings without Auction rows are intentionally untouched.
-- Current workflow uses those rows as valid pre-scheduling vehicle shells.

BEGIN;

DO $$
DECLARE
    candidate_count integer;
    affected_auction_count integer;
    unsafe_open_auction_count integer;
    draft_shell_corruption_count integer;
    current_winner_mismatch_count integer;
BEGIN
    SELECT count(*), count(DISTINCT a.id)
    INTO candidate_count, affected_auction_count
    FROM public.auctions a
    JOIN public.bids b ON b."listingId" = a."listingId"
    WHERE b.id IN (
        'b45339ee-f0a9-4d5d-bd78-4dbb7a5b4d6a',
        '9bb724de-36e4-461f-9bfc-4f6f41f95c5c',
        'df7f8632-036a-43d0-9d40-acdd5c5966af',
        '44086376-31e8-46b3-80e0-ca87d85c015f',
        'ac227d0a-dda6-4aec-9fc8-5da89d814dbf',
        '7442b80b-34e0-45ef-aff4-2f9bd6a48a37',
        '2bad3e43-f8a3-409a-8321-2afd383a0ca3',
        '8bd33af5-16d7-497d-bbd3-0bd930d2b63f',
        'a7cf0e8f-22f1-416b-a05b-9ef45550ba73',
        '4edc0a87-569e-4601-9d27-abfdf1cc1256',
        '70709d3d-ccf0-46ee-be15-80b4e756e67c',
        'cac0d5d9-d461-401b-afea-bb72df4069ed',
        '1c5f00c0-7fe8-489a-b235-508d016e984d',
        'afea67bc-9368-4bb8-93d9-a9e253e78b77',
        '75bb95dd-b398-422e-a2ff-762898d34f6e',
        '1cc18d2b-b4b7-43e9-a202-644eca40f395',
        '85f44de0-cb46-42ed-abaa-cfcb21adaf0e'
    )
      AND a."deletedAt" IS NULL
      AND a.status::text = 'ENDED'
      AND b."deletedAt" IS NULL
      AND b."cancelledAt" IS NULL
      AND b."archivedAt" IS NULL
      AND b."createdAt" < a."startTime";

    IF candidate_count <> 17 OR affected_auction_count <> 8 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: expected 17 bids across 8 ended auctions, found % bids across % auctions',
            candidate_count,
            affected_auction_count;
    END IF;

    SELECT count(*)
    INTO unsafe_open_auction_count
    FROM public.auctions a
    JOIN public.bids b ON b."listingId" = a."listingId"
    WHERE a."deletedAt" IS NULL
      AND a.status::text IN ('ACTIVE', 'SCHEDULED')
      AND b."deletedAt" IS NULL
      AND b."cancelledAt" IS NULL
      AND b."archivedAt" IS NULL
      AND b."createdAt" < a."startTime";

    IF unsafe_open_auction_count <> 0 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: found % pre-run bids on open auctions',
            unsafe_open_auction_count;
    END IF;

    -- Draft AUCTION rows without Auction children are valid pre-scheduling
    -- shells only while they have no bid/sale/auction-fee history.
    SELECT count(*)
    INTO draft_shell_corruption_count
    FROM public.listings l
    LEFT JOIN public.auctions a
      ON a."listingId" = l.id
     AND a."deletedAt" IS NULL
    WHERE l."deletedAt" IS NULL
      AND l.type::text = 'AUCTION'
      AND l.status::text = 'DRAFT'
      AND a.id IS NULL
      AND (
          EXISTS (
              SELECT 1
              FROM public.bids b
              WHERE b."listingId" = l.id
                AND b."deletedAt" IS NULL
          )
          OR EXISTS (
              SELECT 1
              FROM public.sales s
              WHERE s."listingId" = l.id
          )
          OR EXISTS (
              SELECT 1
              FROM public.transactions t
              WHERE t."listingId" = l.id
                AND t."deletedAt" IS NULL
                AND t.type::text = 'COMMISSION'
          )
      );

    IF draft_shell_corruption_count <> 0 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: found % AUCTION/DRAFT shells with auction history',
            draft_shell_corruption_count;
    END IF;

    -- The only affected auction with a current-run winner must still agree
    -- with its canonical Sale and current-run highest bid.
    SELECT count(*)
    INTO current_winner_mismatch_count
    FROM public.auctions a
    LEFT JOIN public.sales s ON s."listingId" = a."listingId"
    WHERE a.id = '4e618c05-eb4c-4965-9c5f-c0377f2ff1a5'
      AND (
          a."winnerId" IS NULL
          OR a."winningBidAmount" IS NULL
          OR s.id IS NULL
          OR s."buyerId" IS DISTINCT FROM a."winnerId"
          OR s."soldPrice" IS DISTINCT FROM a."winningBidAmount"
          OR (
              SELECT max(b.amount)
              FROM public.bids b
              WHERE b."listingId" = a."listingId"
                AND b."deletedAt" IS NULL
                AND b."cancelledAt" IS NULL
                AND b."archivedAt" IS NULL
                AND b."createdAt" >= a."startTime"
          ) IS DISTINCT FROM a."winningBidAmount"
      );

    IF current_winner_mismatch_count <> 0 THEN
        RAISE EXCEPTION
            'Block 8 repair aborted: current winner/Sale history no longer matches the audited safe state';
    END IF;
END
$$;

UPDATE public.bids AS b
SET "archivedAt" = a."startTime"
FROM public.auctions AS a
WHERE b.id IN (
    'b45339ee-f0a9-4d5d-bd78-4dbb7a5b4d6a',
    '9bb724de-36e4-461f-9bfc-4f6f41f95c5c',
    'df7f8632-036a-43d0-9d40-acdd5c5966af',
    '44086376-31e8-46b3-80e0-ca87d85c015f',
    'ac227d0a-dda6-4aec-9fc8-5da89d814dbf',
    '7442b80b-34e0-45ef-aff4-2f9bd6a48a37',
    '2bad3e43-f8a3-409a-8321-2afd383a0ca3',
    '8bd33af5-16d7-497d-bbd3-0bd930d2b63f',
    'a7cf0e8f-22f1-416b-a05b-9ef45550ba73',
    '4edc0a87-569e-4601-9d27-abfdf1cc1256',
    '70709d3d-ccf0-46ee-be15-80b4e756e67c',
    'cac0d5d9-d461-401b-afea-bb72df4069ed',
    '1c5f00c0-7fe8-489a-b235-508d016e984d',
    'afea67bc-9368-4bb8-93d9-a9e253e78b77',
    '75bb95dd-b398-422e-a2ff-762898d34f6e',
    '1cc18d2b-b4b7-43e9-a202-644eca40f395',
    '85f44de0-cb46-42ed-abaa-cfcb21adaf0e'
)
  AND a."listingId" = b."listingId"
  AND a."deletedAt" IS NULL
  AND a.status::text = 'ENDED'
  AND b."deletedAt" IS NULL
  AND b."cancelledAt" IS NULL
  AND b."archivedAt" IS NULL
  AND b."createdAt" < a."startTime";

DO $$
DECLARE
    remaining_pre_run_bids integer;
BEGIN
    SELECT count(*)
    INTO remaining_pre_run_bids
    FROM public.auctions a
    JOIN public.bids b ON b."listingId" = a."listingId"
    WHERE a."deletedAt" IS NULL
      AND b."deletedAt" IS NULL
      AND b."cancelledAt" IS NULL
      AND b."archivedAt" IS NULL
      AND b."createdAt" < a."startTime";

    IF remaining_pre_run_bids <> 0 THEN
        RAISE EXCEPTION
            'Block 8 postcondition failed: % unarchived pre-run bids remain',
            remaining_pre_run_bids;
    END IF;
END
$$;

COMMIT;
