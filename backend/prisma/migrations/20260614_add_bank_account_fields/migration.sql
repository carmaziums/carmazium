-- Add bank account fields for manual payout fallback
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankSortCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutPreference" TEXT DEFAULT 'STRIPE';
