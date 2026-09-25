-- Block 4 data repair: reconcile legacy retail offers, Sale rows and two
-- legacy unpaid auction wins that pre-date the current controlled lifecycle.
--
-- This script is deliberately guarded. If production no longer matches the
-- audited record sets, it aborts before changing anything.
--
-- It does NOT guess ambiguous historical buyers or prices:
--   * SOLD retail listings with multiple accepted offers are left untouched.
--   * SOLD listings without authoritative offer/auction evidence are untouched.
--   * A SOLD retail counterpart whose linked auction owns the canonical Sale is
--     left untouched to avoid double-counting one vehicle sale.

BEGIN;

DO $$
DECLARE
    stale_sales integer;
    stale_accepted_offers integer;
    safe_sale_backfills integer;
    stale_unpaid_auction_wins integer;
BEGIN
    SELECT count(*)
    INTO stale_sales
    FROM public.sales s
    JOIN public.listings l ON l.id = s."listingId"
    WHERE s.id IN (
        '77c0437c-e097-41a9-8e7f-a0daff0f84df',
        'a50af704-6e20-4936-bd20-d4646bcb4096',
        'c3a705a6-2f16-41ec-88bd-24c73fae9019',
        'c5f00059-6f25-405c-b9f0-f4ac7a0747f3',
        'd2cbc885-3baa-40c5-b627-a03a2a2ee0d8',
        'd55daf8b-6a53-46b0-85df-076154417628',
        'f17587e3-fdde-4e75-a1ad-327d96ebcdb8',
        'f244b0cd-f981-4c30-98ec-48320ded82d5'
    )
      AND l."deletedAt" IS NULL
      AND l.status::text <> 'SOLD';

    IF stale_sales <> 8 THEN
        RAISE EXCEPTION
            'Block 4 repair aborted: expected 8 stale Sale rows on non-SOLD listings, found %',
            stale_sales;
    END IF;

    SELECT count(*)
    INTO stale_accepted_offers
    FROM public.offers o
    JOIN public.listings l ON l.id = o."listingId"
    WHERE o.id IN (
        '0cf5912e-7e54-484b-98fa-c90a27b61bb7',
        '0da47ae8-e81e-424f-bde5-05e3eeeaa462',
        '4ba5d21e-b4e7-48cf-b149-0ba75a074202',
        '66ca6868-d722-4fa5-8304-ea02fcc2f0ed',
        'a39fa4a8-8016-4236-9072-7b3b25af0611',
        'a47adc7b-e502-4afe-802a-cad2dfeb74ce',
        'b656282f-1e41-474f-a50c-16af94fd56ff',
        'b96f977b-c800-4cc3-88ef-7b3590d9b0f4'
    )
      AND o.status::text = 'ACCEPTED'
      AND l."deletedAt" IS NULL
      AND l.status::text NOT IN ('OFFER_ACCEPTED', 'SOLD');

    IF stale_accepted_offers <> 8 THEN
        RAISE EXCEPTION
            'Block 4 repair aborted: expected 8 stale accepted offers, found %',
            stale_accepted_offers;
    END IF;

    SELECT count(*)
    INTO safe_sale_backfills
    FROM public.listings l
    LEFT JOIN public.sales s ON s."listingId" = l.id
    JOIN public.offers o
      ON o."listingId" = l.id
     AND o.status::text = 'ACCEPTED'
    JOIN public.users u ON u.id = o."buyerId"
    WHERE l.id IN (
        '0ff2795f-7cc5-42e8-adab-5038fed69686',
        '15768ecd-92b9-4086-9f80-d2b4a25ad815',
        '19f67cba-ebaf-4cf9-9030-d56f47269e2f',
        '25148ea5-434f-4fa1-87a6-0a2a41f942af',
        '2839a31c-325b-421a-a30c-7c52a88eabd8',
        '3ff385f2-95ff-46f4-8959-ba04b0fe8eec',
        '60ea67f2-9ffc-4b86-9125-9d1cb1b74194',
        '6490e1a2-3c0f-44bf-93e3-55cc06d0adab',
        '66d578c6-8cfc-4e89-ae85-49682f7e81d0',
        '86826229-6493-4653-b423-aba53724c715',
        'a2690e91-cbbb-47e5-a71f-4813635b7fa5',
        'a4e78207-59d7-46c9-b0cd-759e15e1dbb8',
        'd7fa041d-0f39-4b32-91bb-42dfd90319f8',
        'db94be9e-3a17-4aed-8354-73dfbffaccf1',
        'eb2c7325-cba3-4c40-a2c1-0986cc73418a'
    )
      AND l."deletedAt" IS NULL
      AND l.status::text = 'SOLD'
      AND l.type::text = 'CLASSIFIED'
      AND l."linkedListingId" IS NULL
      AND s.id IS NULL
      AND (
          SELECT count(*)
          FROM public.offers only_accepted
          WHERE only_accepted."listingId" = l.id
            AND only_accepted.status::text = 'ACCEPTED'
      ) = 1;

    IF safe_sale_backfills <> 15 THEN
        RAISE EXCEPTION
            'Block 4 repair aborted: expected 15 unambiguous Sale backfills, found %',
            safe_sale_backfills;
    END IF;

    SELECT count(*)
    INTO stale_unpaid_auction_wins
    FROM public.auctions a
    JOIN public.listings l ON l.id = a."listingId"
    WHERE a.id IN (
        '9cbbed3b-0115-436d-9aee-19c98e502a8a',
        '2ab7a1fe-b348-40aa-b914-22fca72d3c27'
    )
      AND a."deletedAt" IS NULL
      AND a.status::text = 'ENDED'
      AND a."winnerId" IS NOT NULL
      AND a."winningBidAmount" IS NOT NULL
      AND a."wonAt" IS NULL
      AND a."buyerFeePaid" = false
      AND a."buyerFeeTransactionId" IS NULL
      AND l."deletedAt" IS NULL
      AND l.status::text = 'SOLD';

    IF stale_unpaid_auction_wins <> 2 THEN
        RAISE EXCEPTION
            'Block 4 repair aborted: expected 2 legacy unpaid auction wins, found %',
            stale_unpaid_auction_wins;
    END IF;
END
$$;

-- These Sale rows survived old relist/reopen paths. In the current lifecycle a
-- non-SOLD listing cannot retain a canonical Sale row.
DELETE FROM public.sales
WHERE id IN (
    '77c0437c-e097-41a9-8e7f-a0daff0f84df',
    'a50af704-6e20-4936-bd20-d4646bcb4096',
    'c3a705a6-2f16-41ec-88bd-24c73fae9019',
    'c5f00059-6f25-405c-b9f0-f4ac7a0747f3',
    'd2cbc885-3baa-40c5-b627-a03a2a2ee0d8',
    'd55daf8b-6a53-46b0-85df-076154417628',
    'f17587e3-fdde-4e75-a1ad-327d96ebcdb8',
    'f244b0cd-f981-4c30-98ec-48320ded82d5'
);

-- An accepted negotiation is actionable only while its Listing is
-- OFFER_ACCEPTED (sale pending) or SOLD (completed history). These legacy rows
-- belong to listings that were independently returned to ACTIVE/DRAFT.
UPDATE public.offers
SET
    status = 'CANCELLED',
    "counterExpiresAt" = NULL,
    "updatedAt" = now()
WHERE id IN (
    '0cf5912e-7e54-484b-98fa-c90a27b61bb7',
    '0da47ae8-e81e-424f-bde5-05e3eeeaa462',
    '4ba5d21e-b4e7-48cf-b149-0ba75a074202',
    '66ca6868-d722-4fa5-8304-ea02fcc2f0ed',
    'a39fa4a8-8016-4236-9072-7b3b25af0611',
    'a47adc7b-e502-4afe-802a-cad2dfeb74ce',
    'b656282f-1e41-474f-a50c-16af94fd56ff',
    'b96f977b-c800-4cc3-88ef-7b3590d9b0f4'
)
  AND status::text = 'ACCEPTED';

-- Rebuild only SOLD retail Sale rows where exactly one accepted offer proves
-- both the buyer and the negotiated amount. The historical accepted-offer time
-- is used as the reconstructed Sale timestamp; no current-time sale is invented.
INSERT INTO public.sales (
    id,
    "listingId",
    "sellerId",
    "buyerId",
    "buyerName",
    "buyerEmail",
    "buyerPostcode",
    "soldPrice",
    "purchaseStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    l.id,
    l."sellerId",
    o."buyerId",
    NULLIF(trim(concat_ws(' ', u."firstName", u."lastName")), ''),
    u.email,
    NULL,
    COALESCE(o."finalAmount", o."counterAmount", o.amount),
    'AWAITING_CONFIRMATION'::purchase_status,
    o."updatedAt",
    o."updatedAt"
FROM public.listings l
JOIN public.offers o
  ON o."listingId" = l.id
 AND o.status::text = 'ACCEPTED'
JOIN public.users u ON u.id = o."buyerId"
LEFT JOIN public.sales existing_sale ON existing_sale."listingId" = l.id
WHERE l.id IN (
    '0ff2795f-7cc5-42e8-adab-5038fed69686',
    '15768ecd-92b9-4086-9f80-d2b4a25ad815',
    '19f67cba-ebaf-4cf9-9030-d56f47269e2f',
    '25148ea5-434f-4fa1-87a6-0a2a41f942af',
    '2839a31c-325b-421a-a30c-7c52a88eabd8',
    '3ff385f2-95ff-46f4-8959-ba04b0fe8eec',
    '60ea67f2-9ffc-4b86-9125-9d1cb1b74194',
    '6490e1a2-3c0f-44bf-93e3-55cc06d0adab',
    '66d578c6-8cfc-4e89-ae85-49682f7e81d0',
    '86826229-6493-4653-b423-aba53724c715',
    'a2690e91-cbbb-47e5-a71f-4813635b7fa5',
    'a4e78207-59d7-46c9-b0cd-759e15e1dbb8',
    'd7fa041d-0f39-4b32-91bb-42dfd90319f8',
    'db94be9e-3a17-4aed-8354-73dfbffaccf1',
    'eb2c7325-cba3-4c40-a2c1-0986cc73418a'
)
  AND l."deletedAt" IS NULL
  AND l.status::text = 'SOLD'
  AND l.type::text = 'CLASSIFIED'
  AND l."linkedListingId" IS NULL
  AND l."sellerId" IS NOT NULL
  AND existing_sale.id IS NULL
  AND (
      SELECT count(*)
      FROM public.offers only_accepted
      WHERE only_accepted."listingId" = l.id
        AND only_accepted.status::text = 'ACCEPTED'
  ) = 1
ON CONFLICT ("listingId") DO NOTHING;

-- Two legacy auction winners were created before wonAt became mandatory for the
-- fee-grace timer. They therefore remained SOLD forever despite never paying the
-- £125 buyer fee. Apply the same seller-control outcome as revertUnpaidWins().
DELETE FROM public.sales
WHERE "listingId" IN (
    'ef10ca25-4db1-4c55-b4dd-fb6478692f40',
    '8c6d80bf-7971-4186-a57f-77d34f8a6042'
);

UPDATE public.offers
SET
    status = 'CANCELLED',
    "counterExpiresAt" = NULL,
    "updatedAt" = now()
WHERE "listingId" IN (
    'ef10ca25-4db1-4c55-b4dd-fb6478692f40',
    '8c6d80bf-7971-4186-a57f-77d34f8a6042'
)
  AND status::text = 'ACCEPTED';

UPDATE public.delivery_requests
SET
    status = 'CANCELLED',
    "cancelledAt" = COALESCE("cancelledAt", now()),
    "updatedAt" = now()
WHERE "listingId" IN (
    'ef10ca25-4db1-4c55-b4dd-fb6478692f40',
    '8c6d80bf-7971-4186-a57f-77d34f8a6042'
)
  AND status::text IN ('PENDING', 'ACCEPTED');

UPDATE public.auctions
SET
    status = 'CANCELLED',
    "winnerId" = NULL,
    "winningBidAmount" = NULL,
    "wonAt" = NULL,
    "buyItNowPendingBuyerId" = NULL,
    "buyItNowPendingAt" = NULL,
    "updatedAt" = now()
WHERE id IN (
    '9cbbed3b-0115-436d-9aee-19c98e502a8a',
    '2ab7a1fe-b348-40aa-b914-22fca72d3c27'
);

UPDATE public.listings
SET
    status = 'DRAFT',
    type = 'CLASSIFIED',
    "linkedListingId" = NULL,
    "updatedAt" = now()
WHERE id IN (
    'ef10ca25-4db1-4c55-b4dd-fb6478692f40',
    '8c6d80bf-7971-4186-a57f-77d34f8a6042'
);

-- Mirror revertUnpaidWins(): both historical wins incremented the seller's sale
-- counter when a winner was assigned, so returning the vehicle to inventory must
-- remove that one provisional sale from the stored seller counter.
UPDATE public.seller_profiles sp
SET
    "totalSales" = sp."totalSales" - 1,
    "updatedAt" = now()
FROM public.listings l
WHERE l.id IN (
    'ef10ca25-4db1-4c55-b4dd-fb6478692f40',
    '8c6d80bf-7971-4186-a57f-77d34f8a6042'
)
  AND sp."userId" = l."sellerId"
  AND sp."totalSales" > 0;

DO $$
DECLARE
    remaining_stale_sales integer;
    remaining_stale_accepted integer;
    verified_backfills integer;
    verified_unpaid_reverts integer;
BEGIN
    SELECT count(*)
    INTO remaining_stale_sales
    FROM public.sales s
    JOIN public.listings l ON l.id = s."listingId"
    WHERE l."deletedAt" IS NULL
      AND l.status::text <> 'SOLD';

    IF remaining_stale_sales <> 0 THEN
        RAISE EXCEPTION
            'Block 4 repair postcondition failed: % Sale rows remain on non-SOLD listings',
            remaining_stale_sales;
    END IF;

    SELECT count(*)
    INTO remaining_stale_accepted
    FROM public.offers o
    JOIN public.listings l ON l.id = o."listingId"
    WHERE o.status::text = 'ACCEPTED'
      AND l."deletedAt" IS NULL
      AND l.status::text NOT IN ('OFFER_ACCEPTED', 'SOLD');

    IF remaining_stale_accepted <> 0 THEN
        RAISE EXCEPTION
            'Block 4 repair postcondition failed: % accepted offers remain on invalid listing states',
            remaining_stale_accepted;
    END IF;

    SELECT count(*)
    INTO verified_backfills
    FROM public.listings l
    JOIN public.sales s ON s."listingId" = l.id
    JOIN public.offers o
      ON o."listingId" = l.id
     AND o.status::text = 'ACCEPTED'
    WHERE l.id IN (
        '0ff2795f-7cc5-42e8-adab-5038fed69686',
        '15768ecd-92b9-4086-9f80-d2b4a25ad815',
        '19f67cba-ebaf-4cf9-9030-d56f47269e2f',
        '25148ea5-434f-4fa1-87a6-0a2a41f942af',
        '2839a31c-325b-421a-a30c-7c52a88eabd8',
        '3ff385f2-95ff-46f4-8959-ba04b0fe8eec',
        '60ea67f2-9ffc-4b86-9125-9d1cb1b74194',
        '6490e1a2-3c0f-44bf-93e3-55cc06d0adab',
        '66d578c6-8cfc-4e89-ae85-49682f7e81d0',
        '86826229-6493-4653-b423-aba53724c715',
        'a2690e91-cbbb-47e5-a71f-4813635b7fa5',
        'a4e78207-59d7-46c9-b0cd-759e15e1dbb8',
        'd7fa041d-0f39-4b32-91bb-42dfd90319f8',
        'db94be9e-3a17-4aed-8354-73dfbffaccf1',
        'eb2c7325-cba3-4c40-a2c1-0986cc73418a'
    )
      AND s."buyerId" = o."buyerId"
      AND s."soldPrice" = COALESCE(o."finalAmount", o."counterAmount", o.amount);

    IF verified_backfills <> 15 THEN
        RAISE EXCEPTION
            'Block 4 repair postcondition failed: expected 15 verified Sale backfills, found %',
            verified_backfills;
    END IF;

    SELECT count(*)
    INTO verified_unpaid_reverts
    FROM public.auctions a
    JOIN public.listings l ON l.id = a."listingId"
    LEFT JOIN public.sales s ON s."listingId" = l.id
    WHERE a.id IN (
        '9cbbed3b-0115-436d-9aee-19c98e502a8a',
        '2ab7a1fe-b348-40aa-b914-22fca72d3c27'
    )
      AND a.status::text = 'CANCELLED'
      AND a."winnerId" IS NULL
      AND a."winningBidAmount" IS NULL
      AND l.status::text = 'DRAFT'
      AND l.type::text = 'CLASSIFIED'
      AND s.id IS NULL;

    IF verified_unpaid_reverts <> 2 THEN
        RAISE EXCEPTION
            'Block 4 repair postcondition failed: expected 2 reverted unpaid auction wins, found %',
            verified_unpaid_reverts;
    END IF;
END
$$;

COMMIT;
