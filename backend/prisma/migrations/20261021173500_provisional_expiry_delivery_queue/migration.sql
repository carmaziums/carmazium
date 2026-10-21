-- Persist the true 72h deadline separately from cron processing time.
ALTER TABLE "auctions"
  ADD COLUMN IF NOT EXISTS "provisionalExpiryDeadlineAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "provisionalExpiryNotifiedAt" TIMESTAMP(3);

-- Historical expired auctions originally stored the worker execution time.
-- Restore contractual deadlines ONLY from original 13-digit offered-at UTC
-- milliseconds embedded in genuine saved provisional reminder actionTypes.
WITH original_offers AS (
  SELECT DISTINCT ON (n."entityId") n."entityId" AS auction_id,
    (to_timestamp(
      substring(n."actionType" FROM '^PROVISIONAL_REMINDER_(?:24|72)H_([0-9]{13})$')::numeric / 1000
     ) AT TIME ZONE 'UTC') AS offered_at
  FROM "notifications" n
  WHERE n."actionType" ~ '^PROVISIONAL_REMINDER_(24|72)H_[0-9]{13}$'
  ORDER BY n."entityId", n."createdAt" ASC
)
UPDATE "auctions" a
SET "provisionalExpiryDeadlineAt" = o.offered_at + interval '72 hours'
FROM original_offers o
WHERE a.id = o.auction_id
  AND a."provisionalExpiredAt" IS NOT NULL
  AND a."provisionalExpiryDeadlineAt" IS NULL
  AND o.offered_at <= a."provisionalExpiredAt";

-- The old worker already delivered two in-app records per expired auction.
-- Mark only completely-notified historical expiries as processed.
UPDATE "auctions" a
SET "provisionalExpiryNotifiedAt" = a."provisionalExpiredAt"
WHERE a."provisionalExpiredAt" IS NOT NULL
  AND a."provisionalExpiryNotifiedAt" IS NULL
  AND (SELECT COUNT(*) FROM "notifications" n
       WHERE n."entityId"=a.id AND n.type='AUCTION_PROVISIONAL_EXPIRED') >= 2;

CREATE INDEX IF NOT EXISTS "auctions_pending_expiry_notices"
  ON "auctions" ("provisionalExpiredAt", id)
  WHERE "provisionalExpiredBidId" IS NOT NULL
    AND "provisionalExpiryNotifiedAt" IS NULL AND "deletedAt" IS NULL;

-- Bounded email-outbox selector, replacing a full historical auction scan.
CREATE INDEX IF NOT EXISTS "notifications_pending_provisional_expiry_email"
  ON "notifications" ("createdAt", id)
  WHERE type='AUCTION_PROVISIONAL_EXPIRED'
    AND COALESCE(data->>'emailStatus','pending') NOT IN ('submitted','skipped','failed');
