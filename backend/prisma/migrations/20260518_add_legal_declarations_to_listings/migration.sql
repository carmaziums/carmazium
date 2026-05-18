-- Add legal declaration fields to listings table for Write-Off & Legal compliance
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "stolenRecovered" BOOLEAN;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "hasOutstandingFinance" BOOLEAN;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "isLegalRegisteredKeeper" BOOLEAN;
