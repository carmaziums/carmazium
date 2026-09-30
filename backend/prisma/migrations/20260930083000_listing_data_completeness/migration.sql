-- Preserve the DVLA/MOT data that the listing wizard already collects so
-- it survives submission, editing and auction-to-retail conversion.

ALTER TABLE "listings"
    ADD COLUMN IF NOT EXISTS "firstUsedDate" TEXT,
    ADD COLUMN IF NOT EXISTS "dateOfLastV5CIssued" TEXT,
    ADD COLUMN IF NOT EXISTS "motHistory" JSONB;
