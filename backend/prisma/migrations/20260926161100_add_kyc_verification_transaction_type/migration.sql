-- Add the dedicated ledger type first so the following migration can
-- safely backfill rows using the new enum value.
ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'KYC_VERIFICATION';
