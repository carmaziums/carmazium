-- AddColumn: Stripe Connect fields for seller payouts
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectAccountId" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectOnboardingComplete" BOOLEAN NOT NULL DEFAULT FALSE;
