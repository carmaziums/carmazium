-- Additive migration. Apply before deploying the routing service; never db push production.
CREATE TABLE "finance_providers" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "applicationUrl" TEXT NOT NULL,
  "disclosure" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_default_requires_enabled" CHECK (NOT "isDefault" OR "enabled")
);
CREATE UNIQUE INDEX "finance_provider_single_default" ON "finance_providers" ("isDefault") WHERE "isDefault";
CREATE TABLE "finance_listing_routes" (
  "listingId" TEXT PRIMARY KEY REFERENCES "listings"("id") ON DELETE CASCADE,
  "providerId" TEXT REFERENCES "finance_providers"("id") ON DELETE RESTRICT,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "finance_listing_routes_providerId_idx" ON "finance_listing_routes"("providerId");
ALTER TABLE "finance_referrals" ADD COLUMN "providerId" TEXT,
 ADD COLUMN "providerName" TEXT, ADD COLUMN "providerUrl" TEXT, ADD COLUMN "providerDisclosure" TEXT;
ALTER TABLE "finance_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_listing_routes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "finance_providers", "finance_listing_routes" FROM anon, authenticated;
GRANT ALL ON "finance_providers", "finance_listing_routes" TO service_role;
INSERT INTO "finance_providers" ("id", "name", "applicationUrl", "disclosure", "enabled", "isDefault") VALUES
 ('jigsaw-finance', 'Jigsaw Finance', 'https://applications.jigsawfinance.com/pulse-cars-limited-1787921597855/', 'Jigsaw Finance is a credit broker, not a lender, and handles the application and its disclosures. Finance is subject to status and lender approval.', true, true);
CREATE INDEX "finance_referrals_createdAt_idx" ON "finance_referrals"("createdAt");
