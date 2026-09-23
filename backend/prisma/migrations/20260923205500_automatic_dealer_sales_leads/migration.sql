ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "buyerId" text,
  ADD COLUMN IF NOT EXISTS "lastActivityAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "nextFollowUpAt" timestamp(3);

DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "leads_buyerId_idx" ON "leads"("buyerId");
CREATE INDEX IF NOT EXISTS "leads_nextFollowUpAt_idx" ON "leads"("nextFollowUpAt");

CREATE UNIQUE INDEX IF NOT EXISTS "lead_dealer_listing_buyer_unique"
  ON "leads"("dealerProfileId", "listingId", "buyerId");