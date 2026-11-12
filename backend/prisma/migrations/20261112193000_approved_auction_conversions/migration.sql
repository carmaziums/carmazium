CREATE TABLE "seller_conversion_consents" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "allowed" BOOLEAN NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "approved_auction_conversions" (
  "listingId" TEXT PRIMARY KEY REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clientId" TEXT,
  "sessionId" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "state" TEXT NOT NULL DEFAULT 'CAPTURED',
  "dispatchedAt" TIMESTAMP(3),
  "failureCode" TEXT
);
CREATE INDEX "approved_auction_conversions_state_approvedAt_idx" ON "approved_auction_conversions"("state", "approvedAt");
CREATE INDEX "approved_auction_conversions_userId_idx" ON "approved_auction_conversions"("userId");
