-- Block 3 data repair: remove two legacy same-type listing links left behind
-- by the old reserve-not-met auction conversion flow.
--
-- Audited production state on 2026-09-25:
--   * Each pair belongs to the same seller and same VRM.
--   * Both sides are non-deleted CLASSIFIED/DRAFT listings.
--   * Links are reciprocal.
--   * Exactly one side in each pair owns an ENDED auction with no winner.
--   * Neither side has bids or a sale.
--
-- Current application code no longer creates this state: standalone reserve-
-- not-met auctions become CLASSIFIED/DRAFT with linkedListingId = NULL, while
-- linked auction shells remain AUCTION/DRAFT and retain a reciprocal retail link.
--
-- IMPORTANT: This intentionally does NOT touch AUCTION/DRAFT listings without
-- an Auction row. Those are valid pre-scheduling vehicle shells in the current
-- listing workflow and are blocked from admin review until auction setup exists.

BEGIN;

DO $$
DECLARE
    candidate_count integer;
BEGIN
    SELECT count(*)
    INTO candidate_count
    FROM public.listings l
    JOIN public.listings other
      ON other.id = l."linkedListingId"
    WHERE l.id IN (
        '00f87da9-6e70-4414-8d95-0128d20a2a09',
        '0a3c19d8-9a1d-4ef8-8980-5b1fc9f4bc94',
        '1992bb9f-73df-495a-a9be-b1d45a79bb48',
        'e8a1dd5c-e566-4cbb-ab19-a33b45d023bd'
    )
      AND l."deletedAt" IS NULL
      AND other."deletedAt" IS NULL
      AND l.type::text = 'CLASSIFIED'
      AND other.type::text = 'CLASSIFIED'
      AND l.status::text = 'DRAFT'
      AND other.status::text = 'DRAFT'
      AND other."linkedListingId" = l.id
      AND l."sellerId" IS NOT DISTINCT FROM other."sellerId"
      AND regexp_replace(upper(coalesce(l.vrm, '')), '\\s', '', 'g')
          = regexp_replace(upper(coalesce(other.vrm, '')), '\\s', '', 'g')
      AND EXISTS (
          SELECT 1
          FROM public.auctions a
          WHERE a."listingId" IN (l.id, other.id)
            AND a."deletedAt" IS NULL
            AND a.status::text = 'ENDED'
            AND a."winnerId" IS NULL
            AND a."winningBidAmount" IS NULL
      );

    IF candidate_count <> 4 THEN
        RAISE EXCEPTION
            'Block 3 repair aborted: expected 4 guarded stale-link rows, found %',
            candidate_count;
    END IF;
END
$$;

UPDATE public.listings
SET "linkedListingId" = NULL
WHERE id IN (
    '00f87da9-6e70-4414-8d95-0128d20a2a09',
    '0a3c19d8-9a1d-4ef8-8980-5b1fc9f4bc94',
    '1992bb9f-73df-495a-a9be-b1d45a79bb48',
    'e8a1dd5c-e566-4cbb-ab19-a33b45d023bd'
);

COMMIT;
