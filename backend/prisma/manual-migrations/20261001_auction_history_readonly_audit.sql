-- Block 7 read-only production reconciliation. Do not convert this into a
-- data-changing migration; historic sale/fee evidence requires manual review.
SELECT
 count(*) FILTER (WHERE a."winnerId" IS NOT NULL AND a."wonAt" IS NULL
                 AND a."createdAt" < TIMESTAMP '2026-08-06') AS prefeature_missing_won_at,
 count(*) FILTER (WHERE a."winnerId" IS NOT NULL AND a."wonAt" IS NULL
                 AND a."createdAt" >= TIMESTAMP '2026-08-06') AS newer_missing_won_at,
 count(*) FILTER (WHERE a."sellerBonusReleased" AND NOT a."buyerFeePaid") AS unverified_bonus_approvals,
 count(*) FILTER (WHERE a."handoverSubmittedAt" IS NOT NULL AND NOT a."buyerFeePaid") AS unverified_handovers,
 count(*) FILTER (WHERE a.status::text='CANCELLED' AND a."sellerBonusReleased" AND NOT a."buyerFeePaid") AS cancelled_historical_bonus_rows
FROM public.auctions a WHERE a."deletedAt" IS NULL;
