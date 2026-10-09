-- Fail-closed partner distribution acknowledgement.
-- Existing listings remain NULL and are not eligible for external partner feeds.
ALTER TABLE "listings"
ADD COLUMN "partnerDistributionAcceptedAt" TIMESTAMP(3);
