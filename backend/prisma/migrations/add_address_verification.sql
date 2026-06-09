-- Add address verification support (Trader verification / Buyer Protection unlock)
-- Run: psql $DATABASE_URL -f prisma/migrations/add_address_verification.sql

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAddressVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "addressVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "address_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "address_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "address_verifications_userId_idx" ON "address_verifications"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'address_verifications_userId_fkey'
    ) THEN
        ALTER TABLE "address_verifications"
            ADD CONSTRAINT "address_verifications_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
