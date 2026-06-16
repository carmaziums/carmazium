-- Allow a listing to be linked to another (e.g. AUCTION ↔ CLASSIFIED simultaneously)
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "linkedListingId" TEXT;

ALTER TABLE "listings"
    ADD CONSTRAINT IF NOT EXISTS "listings_linkedListingId_fkey"
    FOREIGN KEY ("linkedListingId") REFERENCES "listings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "listings_linkedListingId_idx" ON "listings"("linkedListingId");
